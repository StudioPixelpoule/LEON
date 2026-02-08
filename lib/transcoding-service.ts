/**
 * Service de pré-transcodage automatique pour LEON
 * 
 * Fonctionnalités :
 * - Transcodage batch de tous les films existants
 * - Priorisation par date (derniers ajouts en premier)
 * - Persistance de la queue (reprise après redémarrage)
 * - Démarrage automatique du watcher et du transcodage
 */

import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { mkdir, readdir, stat, writeFile, readFile, rm, access } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { detectHardwareCapabilities } from './hardware-detection'

const execAsync = promisify(exec)

// Configuration - Chemins DANS le conteneur Docker
const TRANSCODED_DIR = process.env.TRANSCODED_DIR || '/leon/transcoded'
const MEDIA_DIR = process.env.MEDIA_DIR || '/leon/media/films'
const SERIES_DIR = process.env.PCLOUD_SERIES_PATH || '/leon/media/series'
const STATE_FILE = path.join(TRANSCODED_DIR, 'queue-state.json')
const MAX_CONCURRENT_TRANSCODES = 2 // 🔧 2 en parallèle avec Quick Sync (CPU à ~8%)
const SEGMENT_DURATION = 2
const AUTO_SAVE_INTERVAL = 30000 // Sauvegarde toutes les 30 secondes

// Extensions vidéo supportées
const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v']

// Types
export interface TranscodeJob {
  id: string
  filepath: string
  filename: string
  outputDir: string
  status: 'pending' | 'transcoding' | 'completed' | 'failed' | 'cancelled'
  progress: number
  startedAt?: string // Date ISO string pour sérialisation JSON
  completedAt?: string
  error?: string
  priority: number // Timestamp de modification (plus récent = plus prioritaire)
  estimatedDuration?: number
  currentTime?: number
  speed?: number
  pid?: number
  fileSize?: number // Taille du fichier en bytes
  mtime?: string // Date de modification du fichier
}

export interface TranscodeStats {
  totalFiles: number
  completedFiles: number
  pendingFiles: number
  failedFiles: number
  currentJob?: TranscodeJob // Premier job actif (compatibilité)
  activeJobs?: TranscodeJob[] // 🔧 Tous les jobs actifs
  activeCount?: number // 🔧 Nombre de jobs actifs
  maxConcurrent?: number // 🔧 Limite max
  isRunning: boolean
  isPaused: boolean
  estimatedTimeRemaining?: number
  diskUsage?: string
  autoStartEnabled: boolean
  watcherActive: boolean
}

interface QueueState {
  queue: TranscodeJob[]
  completedJobs: TranscodeJob[]
  interruptedJob?: TranscodeJob // Job interrompu à reprendre
  isRunning: boolean
  isPaused: boolean
  lastSaved: string
  version: number
}

// Déclaration globale pour le singleton
declare global {
  var __transcodingServiceSingleton: TranscodingService | undefined
}

class TranscodingService {
  private queue: TranscodeJob[] = []
  private completedJobs: TranscodeJob[] = []
  private activeJobs: Map<string, TranscodeJob> = new Map() // 🔧 Support multi-jobs
  private activeProcesses: Map<string, ReturnType<typeof spawn>> = new Map() // 🔧 Support multi-process
  private isRunning: boolean = false
  private isPaused: boolean = false
  private autoSaveInterval: NodeJS.Timeout | null = null
  private autoStartEnabled: boolean = true
  private initialized: boolean = false

  constructor() {
    console.log('[TRANSCODE] Initialisation TranscodingService')
    this.init()
  }

  /**
   * Initialisation asynchrone au démarrage
   */
  private async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    try {
      // Créer les répertoires
      await this.ensureDirectories()
      
      // Nettoyer les transcodages interrompus (avec .transcoding)
      const cleanedCount = await this.cleanupInProgress()
      
      // Charger l'état sauvegardé
      await this.loadState()
      
      // Si des transcodages ont été nettoyés, re-scanner pour les remettre en queue
      if (cleanedCount > 0) {
        console.log('[TRANSCODE] Re-scan après nettoyage pour remettre les films en queue...')
        await this.scanAndQueue()
      }
      
      // Démarrer l'auto-save
      this.startAutoSave()
      
      // Démarrer automatiquement si la queue n'était pas en pause
      if (this.queue.length > 0 && !this.isPaused && this.autoStartEnabled) {
        console.log('[TRANSCODE] Reprise automatique du transcodage...')
        setTimeout(() => this.start(), 5000) // Attendre 5s pour que tout soit initialisé
      }
      
      // Démarrer le watcher automatiquement
      setTimeout(() => this.startWatcher(), 10000) // Attendre 10s
      
      console.log('[TRANSCODE] Service de transcodage initialisé')
    } catch (error) {
      console.error('[TRANSCODE] Erreur initialisation:', error)
    }
  }

  /**
   * Créer les répertoires nécessaires
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await mkdir(TRANSCODED_DIR, { recursive: true })
      console.log(`[TRANSCODE] Répertoire transcodé: ${TRANSCODED_DIR}`)
    } catch (error) {
      console.error('[TRANSCODE] Erreur création répertoire:', error)
    }
  }

  /**
   * Charger l'état depuis le fichier JSON
   */
  private async loadState(): Promise<void> {
    try {
      if (!existsSync(STATE_FILE)) {
        console.log('[TRANSCODE] Pas d\'état sauvegardé, démarrage fresh')
        return
      }

      const data = await readFile(STATE_FILE, 'utf-8')
      const state: QueueState = JSON.parse(data)

      // Restaurer uniquement les jobs pending (pas ceux en cours de transcodage)
      this.queue = state.queue.filter(j => j.status === 'pending')
      this.completedJobs = state.completedJobs || []
      this.isPaused = state.isPaused || false
      
      // REPRISE DU JOB INTERROMPU
      // Si un job était en cours lors du dernier arrêt, le remettre en tête de queue
      if (state.interruptedJob) {
        const interruptedFilename = state.interruptedJob.filename.toLowerCase().trim()
        const alreadyInQueue = this.queue.some(j => j.filename.toLowerCase().trim() === interruptedFilename)
        
        if (!alreadyInQueue) {
          // Remettre le job interrompu en tête de queue avec haute priorité
          const resumedJob: TranscodeJob = {
            ...state.interruptedJob,
            status: 'pending',
            progress: 0,
            priority: Date.now() // Haute priorité pour être traité en premier
          }
          this.queue.unshift(resumedJob)
          console.log(`[TRANSCODE] Job interrompu remis en tête de queue: ${state.interruptedJob.filename}`)
        } else {
          console.log(`[TRANSCODE] Job interrompu déjà dans la queue: ${state.interruptedJob.filename}`)
        }
      }

      // NETTOYAGE ULTRA-STRICT AU CHARGEMENT (insensible à la casse)
      const seenFilenames = new Set<string>()
      const cleanQueue: TranscodeJob[] = []
      let duplicatesRemoved = 0
      
      for (const job of this.queue) {
        const normalizedName = job.filename.toLowerCase().trim()
        if (!seenFilenames.has(normalizedName)) {
          seenFilenames.add(normalizedName)
          cleanQueue.push(job)
        } else {
          duplicatesRemoved++
          console.log(`[TRANSCODE] Doublon supprimé au chargement: ${job.filename}`)
        }
      }
      
      if (duplicatesRemoved > 0) {
        console.log(`[TRANSCODE] Nettoyage auto: ${duplicatesRemoved} doublon(s) supprimé(s) au chargement`)
      }
      
      this.queue = cleanQueue

      // Re-trier par priorité (date de modification)
      this.queue.sort((a, b) => b.priority - a.priority)

      console.log(`[TRANSCODE] État restauré: ${this.queue.length} jobs en attente, ${this.completedJobs.length} terminés`)
      console.log(`[TRANSCODE] Dernière sauvegarde: ${state.lastSaved}`)
    } catch (error) {
      console.error('[TRANSCODE] Erreur chargement état:', error)
    }
  }

  /**
   * Sauvegarder l'état dans le fichier JSON
   */
  async saveState(): Promise<void> {
    try {
      // NETTOYAGE SYSTÉMATIQUE AVANT SAUVEGARDE
      // Garantit qu'on ne sauvegarde jamais de doublons
      this.cleanDuplicatesSync()
      
      // Sauvegarder tous les jobs actifs pour reprise après redémarrage
      const activeJobsArray = Array.from(this.activeJobs.values()).map(job => ({
        ...job,
        status: 'pending' as const, // Remettre en pending pour reprise
        progress: 0 // Réinitialiser la progression (FFmpeg doit recommencer)
      }))
      
      const state: QueueState = {
        queue: [...activeJobsArray, ...this.queue], // Jobs actifs + queue
        completedJobs: this.completedJobs.slice(-100), // Garder les 100 derniers
        interruptedJob: undefined, // Deprecated, on utilise activeJobs maintenant
        isRunning: this.isRunning,
        isPaused: this.isPaused,
        lastSaved: new Date().toISOString(),
        version: 1
      }

      await writeFile(STATE_FILE, JSON.stringify(state, null, 2))
    } catch (error) {
      console.error('[TRANSCODE] Erreur sauvegarde état:', error)
    }
  }
  
  /**
   * Nettoyage synchrone des doublons (utilisé avant chaque sauvegarde)
   */
  private cleanDuplicatesSync(): void {
    const seenFilenames = new Set<string>()
    const cleanQueue: TranscodeJob[] = []
    let removed = 0
    
    for (const job of this.queue) {
      // Normaliser le nom de fichier (lower case pour éviter les variations)
      const normalizedName = job.filename.toLowerCase().trim()
      
      if (!seenFilenames.has(normalizedName)) {
        seenFilenames.add(normalizedName)
        cleanQueue.push(job)
      } else {
        removed++
      }
    }
    
    if (removed > 0) {
      console.log(`[TRANSCODE] Nettoyage auto: ${removed} doublon(s) supprimé(s)`)
      this.queue = cleanQueue
    }
  }

  /**
   * Démarrer l'auto-save périodique
   */
  private startAutoSave(): void {
    if (this.autoSaveInterval) return

    this.autoSaveInterval = setInterval(() => {
      this.saveState()
    }, AUTO_SAVE_INTERVAL)

    console.log(`[TRANSCODE] Auto-save activé (${AUTO_SAVE_INTERVAL / 1000}s)`)
  }

  /**
   * Démarrer le watcher automatiquement
   */
  private async startWatcher(): Promise<void> {
    try {
      // Import dynamique pour éviter les problèmes de dépendances circulaires
      const fileWatcherModule = await import('./file-watcher')
      const fileWatcher = fileWatcherModule.default
      
      if (!fileWatcher.isActive()) {
        await fileWatcher.start()
        console.log('[TRANSCODE] Watcher démarré automatiquement')
      }
    } catch (error) {
      console.error('[TRANSCODE] Erreur démarrage watcher:', error)
    }
  }

  /**
   * Scanner les films et créer la queue de transcodage
   * 🔀 Queue mélangée: alterne films et séries
   */
  async scanAndQueue(): Promise<number> {
    console.log('[TRANSCODE] Scan des films (priorité: alternance films/séries)...')
    
    const files = await this.scanMediaDirectory()
    let addedCount = 0

    // 🔀 Utiliser l'index dans le tableau mélangé comme priorité
    // Plus l'index est petit = priorité plus haute
    const maxPriority = Date.now()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const outputDir = this.getOutputDir(file.filepath)
      
      // Vérifier si déjà transcodé
      if (await this.isAlreadyTranscoded(outputDir)) {
        continue
      }

      // Vérifier si déjà dans la queue
      if (this.queue.some(j => j.filepath === file.filepath)) {
        continue
      }

      const job: TranscodeJob = {
        id: crypto.randomUUID(),
        filepath: file.filepath,
        filename: file.filename,
        outputDir,
        status: 'pending',
        progress: 0,
        // 🔀 Priorité basée sur la position dans le tableau mélangé (pas la date)
        priority: maxPriority - i,
        fileSize: file.size,
        mtime: file.mtime.toISOString()
      }

      this.queue.push(job)
      addedCount++
    }

    // Trier par priorité (priorité plus élevée = premier)
    this.queue.sort((a, b) => b.priority - a.priority)

    // Sauvegarder l'état
    await this.saveState()

    console.log(`[TRANSCODE] ${addedCount} films ajoutés à la queue (${this.queue.length} total)`)
    
    // Afficher les 5 premiers
    if (this.queue.length > 0) {
      console.log('[TRANSCODE] Prochains films à transcoder:')
      this.queue.slice(0, 5).forEach((job, i) => {
        const date = job.mtime ? new Date(job.mtime).toLocaleDateString('fr-FR') : 'N/A'
        console.log(`[TRANSCODE] ${i + 1}. ${job.filename} (ajouté le ${date})`)
      })
    }

    return addedCount
  }

  /**
   * Scanner le répertoire media (films + séries)
   * 🔀 MÉLANGE: Alterne films et séries pour une queue équilibrée
   */
  private async scanMediaDirectory(): Promise<Array<{ filepath: string; filename: string; mtime: Date; size: number }>> {
    const films: Array<{ filepath: string; filename: string; mtime: Date; size: number }> = []
    const series: Array<{ filepath: string; filename: string; mtime: Date; size: number }> = []

    const scanDir = async (dir: string, targetArray: typeof films) => {
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          
          if (entry.isDirectory()) {
            await scanDir(fullPath, targetArray)
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            if (VIDEO_EXTENSIONS.includes(ext)) {
              const stats = await stat(fullPath)
              targetArray.push({
                filepath: fullPath,
                filename: entry.name,
                mtime: stats.mtime,
                size: stats.size
              })
            }
          }
        }
      } catch (error) {
        // Silencieux si le dossier n'existe pas
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.error(`[TRANSCODE] Erreur scan ${dir}:`, error)
        }
      }
    }

    // Scanner les films
    await scanDir(MEDIA_DIR, films)
    console.log(`[TRANSCODE] ${films.length} films trouvés`)
    
    // Scanner les séries (si le dossier existe)
    try {
      await access(SERIES_DIR)
      await scanDir(SERIES_DIR, series)
      console.log(`[TRANSCODE] ${series.length} épisodes de séries trouvés`)
    } catch {
      // Le dossier series n'existe pas encore, c'est normal
    }
    
    // Trier chaque catégorie par date (plus récent en premier)
    films.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    series.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    
    // 🔀 MÉLANGER: Alterner films et séries
    const mixed: typeof films = []
    const maxLength = Math.max(films.length, series.length)
    
    for (let i = 0; i < maxLength; i++) {
      if (i < films.length) mixed.push(films[i])
      if (i < series.length) mixed.push(series[i])
    }
    
    console.log(`[TRANSCODE] Queue mélangée: ${mixed.length} fichiers (alternance films/séries)`)
    
    return mixed
  }

  /**
   * Obtenir le répertoire de sortie pour un fichier
   * Organise les séries dans un sous-dossier 'series'
   */
  private getOutputDir(filepath: string): string {
    const filename = path.basename(filepath, path.extname(filepath))
    const safeName = filename.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s\-_.()[\]]/gi, '_')
    
    // Vérifier si c'est un épisode de série (contient SxxExx)
    const isSeriesEpisode = /S\d{1,2}E\d{1,2}/i.test(filename)
    
    if (isSeriesEpisode || filepath.includes(SERIES_DIR)) {
      // Stocker les épisodes dans transcoded/series/
      return path.join(TRANSCODED_DIR, 'series', safeName)
    }
    
    return path.join(TRANSCODED_DIR, safeName)
  }

  /**
   * Vérifier si un fichier est déjà transcodé
   * Supporte l'ancien format (playlist.m3u8) et le nouveau format (stream_0.m3u8 + master.m3u8)
   * Retourne false si .transcoding existe (transcodage interrompu)
   */
  async isAlreadyTranscoded(outputDir: string): Promise<boolean> {
    const donePath = path.join(outputDir, '.done')
    const transcodingPath = path.join(outputDir, '.transcoding')
    
    // 0. Si .transcoding existe, c'est un transcodage interrompu
    if (existsSync(transcodingPath)) {
      return false
    }
    
    // 1. Vérification rapide : fichier .done existe
    if (existsSync(donePath)) {
      return true
    }
    
    // 2. Trouver une playlist (ancien ou nouveau format)
    // Priorité: video.m3u8 (nouveau format) > stream_0.m3u8 > playlist.m3u8 (master)
    const videoPlaylistPath = path.join(outputDir, 'video.m3u8')
    const newPlaylistPath = path.join(outputDir, 'stream_0.m3u8')
    const oldPlaylistPath = path.join(outputDir, 'playlist.m3u8')
    
    const playlistPath = existsSync(videoPlaylistPath) ? videoPlaylistPath :
                         existsSync(newPlaylistPath) ? newPlaylistPath : 
                         existsSync(oldPlaylistPath) ? oldPlaylistPath : null
    
    if (!playlistPath) {
      return false
    }
    
    // 3. Vérification approfondie : playlist + segments suffisants
    try {
      const playlistContent = await readFile(playlistPath, 'utf-8')
      // Vérifier que le playlist est complet (contient #EXT-X-ENDLIST)
      if (playlistContent.includes('#EXT-X-ENDLIST')) {
        // Compter les segments déclarés dans le playlist (nouveau format: stream_X_segmentY.ts)
        const oldSegments = (playlistContent.match(/segment\d+\.ts/g) || []).length
        const newSegments = (playlistContent.match(/stream_\d+_segment\d+\.ts/g) || []).length
        const segmentCount = oldSegments + newSegments
        
        // 🔧 Seuil réduit à 10 segments (les épisodes courts ont ~50 segments)
        if (segmentCount >= 10) {
          // Créer le fichier .done pour les prochaines fois
          console.log(`[TRANSCODE] Création .done pour ${outputDir} (${segmentCount} segments détectés)`)
          await writeFile(donePath, new Date().toISOString())
          return true
        }
      }
    } catch (error) {
      console.error(`[TRANSCODE] Erreur lecture playlist ${playlistPath}:`, error)
    }
    
    return false
  }
  
  /**
   * Nettoyer les transcodages en cours (interrompus)
   * Appelé au démarrage pour supprimer les dossiers avec .transcoding
   * @returns Le nombre de transcodages nettoyés
   */
  private async cleanupInProgress(): Promise<number> {
    try {
      if (!existsSync(TRANSCODED_DIR)) return 0
      
      const entries = await readdir(TRANSCODED_DIR, { withFileTypes: true })
      let cleanedCount = 0
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        
        const dirPath = path.join(TRANSCODED_DIR, entry.name)
        const transcodingPath = path.join(dirPath, '.transcoding')
        
        // Si .transcoding existe, le transcodage a été interrompu
        if (existsSync(transcodingPath)) {
          console.log(`[TRANSCODE] Nettoyage transcodage interrompu: ${entry.name}`)
          await rm(dirPath, { recursive: true, force: true })
          cleanedCount++
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`[TRANSCODE] ${cleanedCount} transcodage(s) interrompu(s) nettoyé(s)`)
      }
      
      return cleanedCount
    } catch (error) {
      console.error('[TRANSCODE] Erreur nettoyage en cours:', error)
      return 0
    }
  }
  
  /**
   * Nettoyer les transcodages incomplets
   * Supprime les dossiers avec .transcoding ou qui n'ont pas assez de segments
   */
  async cleanupIncomplete(): Promise<{ cleaned: string[], kept: string[] }> {
    const cleaned: string[] = []
    const kept: string[] = []
    
    // Helper pour scanner un répertoire
    const scanDir = async (baseDir: string, prefix: string = '') => {
      if (!existsSync(baseDir)) return
      
      const entries = await readdir(baseDir, { withFileTypes: true })
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        // Ne pas traiter le dossier "series" ici, on le fait séparément
        if (entry.name === 'series' && prefix === '') continue
        
        const dirPath = path.join(baseDir, entry.name)
        const donePath = path.join(dirPath, '.done')
        const transcodingPath = path.join(dirPath, '.transcoding')
        const masterPlaylistPath = path.join(dirPath, 'playlist.m3u8')
        const videoPlaylistPath = path.join(dirPath, 'video.m3u8')
        const streamPlaylistPath = path.join(dirPath, 'stream_0.m3u8')
        
        // Si .transcoding existe, c'est un transcodage interrompu - supprimer
        if (existsSync(transcodingPath)) {
          console.log(`[TRANSCODE] Suppression transcodage interrompu: ${prefix}${entry.name}`)
          await rm(dirPath, { recursive: true, force: true })
          cleaned.push(prefix + entry.name)
          continue
        }
        
        // Si .done existe, garder
        if (existsSync(donePath)) {
          kept.push(prefix + entry.name)
          continue
        }
        
        // Compter les segments (tous formats)
        const files = await readdir(dirPath)
        const oldSegments = files.filter(f => f.match(/^segment\d+\.ts$/)).length
        const videoSegments = files.filter(f => f.match(/^video_segment\d+\.ts$/)).length
        const segmentCount = oldSegments + videoSegments
        
        // Vérifier si le playlist est complet
        // Priorité: video.m3u8 > stream_0.m3u8 > playlist.m3u8
        let playlistComplete = false
        const playlistToCheck = existsSync(videoPlaylistPath) ? videoPlaylistPath :
                                existsSync(streamPlaylistPath) ? streamPlaylistPath :
                                existsSync(masterPlaylistPath) ? masterPlaylistPath : null
        
        if (playlistToCheck) {
          try {
            const content = await readFile(playlistToCheck, 'utf-8')
            playlistComplete = content.includes('#EXT-X-ENDLIST')
          } catch (error) {
            console.error('[TRANSCODE] Erreur lecture playlist:', error instanceof Error ? error.message : error)
          }
        }
        
        // 🔧 FIX: Seuil réduit à 10 segments + playlist complet
        if (segmentCount < 10 || !playlistComplete) {
          // Transcodage incomplet - supprimer
          console.log(`[TRANSCODE] Suppression transcodage incomplet: ${prefix}${entry.name} (${segmentCount} segments, playlist: ${playlistComplete})`)
          await rm(dirPath, { recursive: true, force: true })
          cleaned.push(prefix + entry.name)
        } else {
          // Assez de segments - créer .done
          console.log(`[TRANSCODE] Création .done pour: ${prefix}${entry.name} (${segmentCount} segments)`)
          await writeFile(donePath, new Date().toISOString())
          kept.push(prefix + entry.name)
        }
      }
    }
    
    try {
      // Scanner le dossier racine (films)
      await scanDir(TRANSCODED_DIR)
      
      // Scanner le sous-dossier series/ (épisodes)
      const seriesDir = path.join(TRANSCODED_DIR, 'series')
      await scanDir(seriesDir, 'series/')
    } catch (error) {
      console.error('[TRANSCODE] Erreur cleanup incomplets:', error)
    }
    
    return { cleaned, kept }
  }

  /**
   * Marquer un média comme transcodé en BDD
   * Met à jour is_transcoded = true pour permettre l'affichage dans l'interface
   */
  private async markAsTranscoded(filepath: string): Promise<void> {
    try {
      const { supabase } = await import('./supabase')
      
      // Déterminer si c'est un film ou un épisode de série
      const isSeries = filepath.includes('/series/')
      
      if (isSeries) {
        // C'est un épisode - mettre à jour dans la table episodes
        const { data, error } = await supabase
          .from('episodes')
          .update({ is_transcoded: true })
          .eq('filepath', filepath)
          .select('id')
        
        if (error) {
          console.warn(`[TRANSCODE] Erreur mise à jour is_transcoded épisode:`, error.message)
        } else if (data && data.length > 0) {
          console.log(`[TRANSCODE] Épisode marqué comme transcodé (visible dans l'interface)`)
        }
      } else {
        // C'est un film - mettre à jour dans la table media
        // Le filepath en BDD est stocké dans pcloud_fileid
        const { data, error } = await supabase
          .from('media')
          .update({ is_transcoded: true })
          .eq('pcloud_fileid', filepath)
          .select('id, title')
        
        if (error) {
          console.warn(`[TRANSCODE] Erreur mise à jour is_transcoded film:`, error.message)
        } else if (data && data.length > 0) {
          console.log(`[TRANSCODE] Film "${data[0].title}" marqué comme transcodé (visible dans l'interface)`)
        }
      }
    } catch (error) {
      console.error(`[TRANSCODE] Erreur markAsTranscoded:`, error)
    }
  }

  /**
   * Synchroniser le statut is_transcoded en BDD avec les fichiers réellement transcodés sur disque
   * Corrige les cas où le transcodage a réussi mais is_transcoded est resté à false
   */
  async syncTranscodedStatus(): Promise<number> {
    let fixed = 0
    try {
      const { supabase } = await import('./supabase')

      // Films non marqués comme transcodés
      const { data: untranscodedMedia } = await supabase
        .from('media')
        .select('id, title, pcloud_fileid')
        .eq('is_transcoded', false)

      if (untranscodedMedia) {
        for (const media of untranscodedMedia) {
          if (!media.pcloud_fileid) continue
          const outputDir = this.getOutputDir(media.pcloud_fileid)
          if (await this.isAlreadyTranscoded(outputDir)) {
            await supabase
              .from('media')
              .update({ is_transcoded: true })
              .eq('id', media.id)
            console.log(`[TRANSCODE] Sync: film "${media.title}" marqué comme transcodé`)
            fixed++
          }
        }
      }

      // Épisodes non marqués comme transcodés
      const { data: untranscodedEpisodes } = await supabase
        .from('episodes')
        .select('id, filepath, season_number, episode_number')
        .eq('is_transcoded', false)

      if (untranscodedEpisodes) {
        for (const ep of untranscodedEpisodes) {
          if (!ep.filepath) continue
          const outputDir = this.getOutputDir(ep.filepath)
          if (await this.isAlreadyTranscoded(outputDir)) {
            await supabase
              .from('episodes')
              .update({ is_transcoded: true })
              .eq('id', ep.id)
            console.log(`[TRANSCODE] Sync: épisode S${ep.season_number}E${ep.episode_number} marqué comme transcodé`)
            fixed++
          }
        }
      }

      if (fixed > 0) {
        console.log(`[TRANSCODE] Sync terminée: ${fixed} média(s) corrigé(s)`)
      }
    } catch (error) {
      console.error('[TRANSCODE] Erreur sync statut transcodage:', error)
    }
    return fixed
  }

  /**
   * Obtenir le chemin du fichier transcodé si disponible
   */
  async getTranscodedPath(originalPath: string): Promise<string | null> {
    const outputDir = this.getOutputDir(originalPath)
    const playlistPath = path.join(outputDir, 'playlist.m3u8')
    
    if (await this.isAlreadyTranscoded(outputDir)) {
      return playlistPath
    }
    
    return null
  }

  /**
   * Démarrer le service de transcodage
   */
  async start(): Promise<void> {
    if (this.isRunning && !this.isPaused) {
      console.log('[TRANSCODE] Service déjà en cours')
      return
    }

    this.isRunning = true
    this.isPaused = false
    console.log('[TRANSCODE] Démarrage du service de transcodage')

    // Synchroniser les statuts is_transcoded au démarrage
    // Corrige les fichiers transcodés sur disque mais non marqués en BDD
    await this.syncTranscodedStatus()

    await this.saveState()
    await this.processQueue()
  }

  /**
   * Mettre en pause le transcodage
   */
  async pause(): Promise<void> {
    this.isPaused = true
    console.log('[TRANSCODE] Transcodage en pause')
    
    // Tuer tous les processus actifs
    for (const [jobId, job] of this.activeJobs) {
      const process = this.activeProcesses.get(jobId)
      if (process) {
        // Nettoyer le fichier verrou avant de tuer le processus
        const transcodingLockPath = path.join(job.outputDir, '.transcoding')
        try {
          await rm(transcodingLockPath, { force: true })
        } catch (error) {
          console.warn('[TRANSCODE] Erreur suppression lock:', error instanceof Error ? error.message : error)
        }
        
        process.kill('SIGTERM')
        job.status = 'pending'
        this.queue.unshift(job)
      }
    }
    this.activeJobs.clear()
    this.activeProcesses.clear()

    await this.saveState()
  }

  /**
   * Reprendre le transcodage
   */
  async resume(): Promise<void> {
    if (!this.isPaused) return
    
    this.isPaused = false
    console.log('[TRANSCODE] Reprise du transcodage')
    
    await this.saveState()
    
    if (this.isRunning) {
      await this.processQueue()
    }
  }

  /**
   * Arrêter complètement le service
   */
  async stop(): Promise<void> {
    this.isRunning = false
    this.isPaused = false
    
    // Arrêter tous les jobs actifs
    for (const [jobId, job] of this.activeJobs) {
      // Nettoyer le fichier verrou
      const transcodingLockPath = path.join(job.outputDir, '.transcoding')
      try {
        await rm(transcodingLockPath, { force: true })
      } catch (error) {
        console.warn('[TRANSCODE] Erreur suppression lock stop:', error instanceof Error ? error.message : error)
      }
      
      // Tuer le processus
      const process = this.activeProcesses.get(jobId)
      if (process) {
        process.kill('SIGKILL')
      }
      
      // Remettre en queue
      job.status = 'pending'
      this.queue.unshift(job)
    }
    
    this.activeJobs.clear()
    this.activeProcesses.clear()
    
    await this.saveState()
    console.log('[TRANSCODE] Service de transcodage arrêté')
  }

  /**
   * Traiter la queue de transcodage (support multi-jobs parallèles)
   */
  private async processQueue(): Promise<void> {
    // Démarrer les workers parallèles
    const startWorker = async (workerId: number): Promise<void> => {
      while (this.isRunning && !this.isPaused) {
        // Vérifier si on peut prendre un nouveau job
        if (this.activeJobs.size >= MAX_CONCURRENT_TRANSCODES) {
          // Attendre qu'un slot se libère
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        }

        const job = this.queue.shift()
        if (!job) {
          // Plus de jobs dans la queue, ce worker s'arrête
          break
        }

        // Marquer le job comme actif
        this.activeJobs.set(job.id, job)
        job.status = 'transcoding'
        job.startedAt = new Date().toISOString()

        console.log(`[TRANSCODE] [Worker ${workerId}] Transcodage: ${job.filename} (${this.activeJobs.size}/${MAX_CONCURRENT_TRANSCODES} actifs)`)
        await this.saveState()

        try {
          await this.transcodeFile(job)
          
          job.status = 'completed'
          job.completedAt = new Date().toISOString()
          job.progress = 100
          
          this.completedJobs.push(job)
          // Limiter la croissance mémoire des jobs terminés
          if (this.completedJobs.length > 200) {
            this.completedJobs = this.completedJobs.slice(-100)
          }
          console.log(`[TRANSCODE] [Worker ${workerId}] Terminé: ${job.filename}`)
        } catch (error) {
          job.status = 'failed'
          job.error = error instanceof Error ? error.message : String(error)
          job.completedAt = new Date().toISOString()
          
          // Réessayer plus tard SAUF si fichier corrompu ou erreur fatale
          const isFatalError = job.error.includes('SIGKILL') || 
                              job.error.includes('SIGTERM') ||
                              job.error.includes('corrompu') ||
                              job.error.includes('Invalid data')
          
          if (!isFatalError) {
            job.status = 'pending'
            job.priority = 0 // Basse priorité pour les retry
            this.queue.push(job)
          } else {
            console.log(`[TRANSCODE] [Worker ${workerId}] Fichier ignoré définitivement: ${job.filename}`)
          }
          
          console.error(`[TRANSCODE] [Worker ${workerId}] Échec: ${job.filename}`, error)
        }

        // Retirer le job des actifs
        this.activeJobs.delete(job.id)
        this.activeProcesses.delete(job.id)
        await this.saveState()
      }
    }

    // Démarrer MAX_CONCURRENT_TRANSCODES workers en parallèle
    const workers: Promise<void>[] = []
    for (let i = 0; i < MAX_CONCURRENT_TRANSCODES; i++) {
      workers.push(startWorker(i + 1))
    }

    // Attendre que tous les workers terminent
    await Promise.all(workers)

    if (this.queue.length === 0 && this.activeJobs.size === 0 && this.isRunning) {
      console.log('[TRANSCODE] Queue de transcodage terminée!')
      this.isRunning = false
      await this.saveState()
    }
  }

  /**
   * Échapper les caractères spéciaux pour les commandes shell
   */
  private escapeFilePath(filepath: string): string {
    // Échapper les guillemets et autres caractères problématiques
    return filepath.replace(/'/g, "'\\''")
  }

  /**
   * Détecter le codec vidéo source (pour savoir si HEVC)
   */
  private async detectVideoCodec(filepath: string): Promise<string> {
    try {
      const escapedPath = this.escapeFilePath(filepath)
      const { stdout } = await execAsync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 '${escapedPath}'`,
        { timeout: 30000 }
      )
      // 🔧 FIX: Retirer la virgule finale que ffprobe ajoute parfois (ex: "hevc," -> "hevc")
      const codec = stdout.trim().toLowerCase().replace(/,+$/, '')
      console.log(`[TRANSCODE] Codec détecté: "${codec}" (raw: "${stdout.trim()}")`)
      return codec
    } catch (error) {
      console.error('[TRANSCODE] Erreur détection codec:', error)
      return 'unknown'
    }
  }

  /**
   * Analyser un fichier pour obtenir les infos sur les pistes audio et sous-titres
   */
  private async probeStreams(filepath: string): Promise<{
    audioCount: number
    subtitleCount: number
    audios: Array<{ index: number; language: string; title?: string }>
    subtitles: Array<{ index: number; language: string; title?: string; codec: string }>
  }> {
    // Liste des codecs sous-titres bitmap (non convertibles en WebVTT)
    const BITMAP_SUBTITLE_CODECS = [
      'hdmv_pgs_subtitle', 'pgssub', 'pgs',
      'dvd_subtitle', 'dvdsub', 'dvbsub',
      'xsub', 'vobsub'
    ]
    
    try {
      // Utiliser des guillemets simples pour les caractères spéciaux (accents, espaces)
      const escapedPath = this.escapeFilePath(filepath)
      const { stdout } = await execAsync(
        `ffprobe -v quiet -print_format json -show_streams '${escapedPath}'`
      )
      const data = JSON.parse(stdout)
      const streams = data.streams || []
      
      const audios = streams
        .filter((s: any) => s.codec_type === 'audio')
        .map((s: any, idx: number) => ({
          index: idx,
          language: s.tags?.language || 'und',
          title: s.tags?.title
        }))
      
      // Filtrer les sous-titres bitmap (PGS, DVD) qui ne peuvent pas être convertis en WebVTT
      const subtitles = streams
        .filter((s: any) => s.codec_type === 'subtitle')
        .filter((s: any) => {
          const codec = (s.codec_name || '').toLowerCase()
          const isBitmap = BITMAP_SUBTITLE_CODECS.some(bc => codec.includes(bc))
          if (isBitmap) {
            console.log(`[TRANSCODE] Sous-titre bitmap ignoré: ${s.tags?.language || 'und'} (${codec})`)
          }
          return !isBitmap
        })
        .map((s: any, idx: number) => ({
          index: idx,
          language: s.tags?.language || 'und',
          title: s.tags?.title,
          codec: s.codec_name
        }))
      
      return {
        audioCount: audios.length,
        subtitleCount: subtitles.length,
        audios,
        subtitles
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('[TRANSCODE] Erreur probe streams:', errorMsg)
      
      // Détecter les fichiers corrompus
      if (errorMsg.includes('Invalid data') || errorMsg.includes('EBML header') || errorMsg.includes('parsing failed')) {
        console.error('[TRANSCODE] FICHIER CORROMPU - impossible à transcoder')
        throw new Error('Fichier corrompu: ' + errorMsg.slice(0, 100))
      }
      
      // Retourner des valeurs par défaut avec 1 audio pour ne pas bloquer
      return { 
        audioCount: 1, // Supposer au moins 1 piste audio
        subtitleCount: 0, 
        audios: [{ index: 0, language: 'und', title: 'Audio' }], 
        subtitles: [] 
      }
    }
  }

  /**
   * Extraire les sous-titres en fichiers WebVTT
   * Note: Les sous-titres bitmap (PGS, DVD) sont déjà filtrés dans probeStreams()
   */
  private async extractSubtitles(
    filepath: string,
    outputDir: string,
    subtitles: Array<{ index: number; language: string; title?: string; codec: string }>
  ): Promise<void> {
    if (subtitles.length === 0) {
      console.log(`[TRANSCODE] Aucun sous-titre texte à extraire`)
      return
    }
    
    console.log(`[TRANSCODE] Extraction de ${subtitles.length} sous-titres texte...`)
    
    const extractedSubs: Array<{ language: string; title?: string; file: string }> = []
    const escapedPath = this.escapeFilePath(filepath)
    
    for (const sub of subtitles) {
      const outputFile = path.join(outputDir, `sub_${sub.language}_${sub.index}.vtt`)
      
      try {
        // Convertir en WebVTT avec guillemets simples pour les caractères spéciaux
        await execAsync(
          `ffmpeg -y -i '${escapedPath}' -map 0:s:${sub.index} -c:s webvtt "${outputFile}"`
        )
        console.log(`[TRANSCODE] Sous-titre extrait: ${sub.language}`)
        extractedSubs.push({
          language: sub.language,
          title: sub.title,
          file: `sub_${sub.language}_${sub.index}.vtt`
        })
      } catch (error) {
        // En cas d'erreur, ignorer ce sous-titre et continuer
        console.warn(`[TRANSCODE] Impossible d'extraire sous-titre ${sub.language} (${sub.codec}) - ignoré`)
      }
    }
    
    // Créer un fichier JSON seulement avec les sous-titres réellement extraits
    if (extractedSubs.length > 0) {
      await writeFile(
        path.join(outputDir, 'subtitles.json'),
        JSON.stringify(extractedSubs, null, 2)
      )
      console.log(`[TRANSCODE] ${extractedSubs.length}/${subtitles.length} sous-titres extraits`)
    }
  }

  /**
   * Transcoder un fichier
   */
  private async transcodeFile(job: TranscodeJob): Promise<void> {
    await mkdir(job.outputDir, { recursive: true })
    
    // Créer le fichier verrou .transcoding
    const transcodingLockPath = path.join(job.outputDir, '.transcoding')
    await writeFile(transcodingLockPath, new Date().toISOString())

    // Obtenir la durée du fichier
    const escapedFilePath = this.escapeFilePath(job.filepath)
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 '${escapedFilePath}'`
      )
      job.estimatedDuration = parseFloat(stdout.trim())
    } catch {
      // Si ffprobe échoue, estimer 2h par défaut
      job.estimatedDuration = 7200
      console.warn(`[TRANSCODE] Impossible d'obtenir la durée, estimation 2h`)
    }

    const hardware = await detectHardwareCapabilities()
    
    // 🔊 Étape 1: Analyser le fichier pour les pistes audio et sous-titres
    const streamInfo = await this.probeStreams(job.filepath)
    console.log(`[TRANSCODE] Pistes détectées: ${streamInfo.audioCount} audio, ${streamInfo.subtitleCount} sous-titres`)
    
    // 🔊 Étape 2: Extraire les sous-titres en WebVTT (si présents)
    if (streamInfo.subtitleCount > 0) {
      await this.extractSubtitles(job.filepath, job.outputDir, streamInfo.subtitles)
    }
    
    // 🔊 Étape 3: DEMUXED HLS - Standard Netflix/YouTube
    // Stratégie: Vidéo séparée + chaque audio séparé + master playlist
    // C'est LA méthode correcte pour multi-audio HLS compatible partout
    
    console.log(`[TRANSCODE] Mode DEMUXED: vidéo séparée + ${streamInfo.audioCount} audio séparés`)
    
    // 🔊 Sauvegarder les infos audio
    const audioInfo = streamInfo.audios.map((audio, idx) => ({
      index: idx,
      language: audio.language || 'und',
      title: audio.title || `Audio ${idx + 1}`,
      playlist: `audio_${idx}.m3u8`,
      isDefault: idx === 0
    }))
    
    if (streamInfo.audioCount > 0) {
      await writeFile(
        path.join(job.outputDir, 'audio_info.json'),
        JSON.stringify(audioInfo, null, 2)
      )
      console.log(`[TRANSCODE] audio_info.json créé avec ${audioInfo.length} pistes`)
    }
    
    // 📺 PASS 1: Encoder la VIDÉO (sans audio)
    console.log(`[TRANSCODE] Pass 1: Encodage vidéo...`)
    
    // 🔍 Détecter le codec source pour adapter le décodage
    const sourceCodec = await this.detectVideoCodec(job.filepath)
    const isHEVC = sourceCodec === 'hevc' || sourceCodec === 'h265'
    
    if (isHEVC) {
      console.log(`[TRANSCODE] Source HEVC détectée - décodage software (CPU) + encodage hardware (GPU)`)
    }
    
    // Pour HEVC: ne pas utiliser le décodeur VAAPI (non supporté sur Celeron J3455)
    // On utilise le décodeur software CPU puis on upload vers le GPU pour l'encodage
    const useHardwareDecoder = hardware.acceleration === 'vaapi' && !isHEVC
    
    // Arguments de décodage adaptés
    let decoderArgs: string[] = []
    let videoFilter: string
    
    if (hardware.acceleration === 'vaapi') {
      if (isHEVC) {
        // HEVC: décodage CPU + init device VAAPI pour encodage
        decoderArgs = ['-init_hw_device', 'vaapi=va:/dev/dri/renderD128', '-filter_hw_device', 'va']
        videoFilter = 'format=nv12,hwupload'  // Convert puis upload vers GPU
      } else {
        // H.264: décodage + encodage VAAPI
        decoderArgs = hardware.decoderArgs
        videoFilter = 'format=nv12|vaapi,hwupload'
      }
    } else {
      // CPU pur
      decoderArgs = []
      videoFilter = 'format=yuv420p'
    }
    
    const videoArgs = [
      ...decoderArgs,
      '-i', job.filepath,
      '-map', '0:v:0',
      '-an', // PAS D'AUDIO dans le flux vidéo
      '-map_metadata', '-1', // Ignorer les métadonnées (évite "Too long service name" en MPEG-TS)
      '-vf', videoFilter,
      ...hardware.encoderArgs,
      '-g', '48',
      '-keyint_min', '24',
      '-sc_threshold', '0',
      '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_DURATION})`,
      '-f', 'hls',
      '-hls_time', String(SEGMENT_DURATION),
      '-hls_list_size', '0',
      '-hls_segment_type', 'mpegts',
      '-hls_flags', 'independent_segments',
      '-hls_segment_filename', path.join(job.outputDir, 'video_segment%d.ts'),
      '-hls_playlist_type', 'vod',
      '-start_number', '0',
      path.join(job.outputDir, 'video.m3u8')
    ]
    
    // 🔊 PASS 2+: Encoder chaque piste AUDIO séparément
    const audioArgsList: string[][] = []
    
    for (let i = 0; i < streamInfo.audioCount; i++) {
      const audioArgs = [
        '-i', job.filepath,
        '-map', `0:a:${i}`,
        '-vn', // PAS DE VIDÉO
        '-map_metadata', '-1', // Ignorer les métadonnées
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ac', '2',
        '-ar', '48000',
        '-f', 'hls',
        '-hls_time', String(SEGMENT_DURATION),
        '-hls_list_size', '0',
        '-hls_segment_type', 'mpegts',
        '-hls_flags', 'independent_segments',
        '-hls_segment_filename', path.join(job.outputDir, `audio_${i}_segment%d.ts`),
        '-hls_playlist_type', 'vod',
        '-start_number', '0',
        path.join(job.outputDir, `audio_${i}.m3u8`)
      ]
      audioArgsList.push(audioArgs)
    }
    
    // Si pas d'audio, créer un flux vidéo+audio simple
    if (streamInfo.audioCount === 0) {
      // Fallback: vidéo avec audio optionnel
      videoArgs.splice(videoArgs.indexOf('-an'), 1) // Retirer -an
      videoArgs.splice(videoArgs.indexOf('-map'), 0, '-map', '0:a?')
    }
    
    console.log(`[TRANSCODE] Démarrage FFmpeg vidéo...`)
    console.log(`[TRANSCODE] Video args: ffmpeg ${videoArgs.slice(0, 10).join(' ')} ...`)

    // Helper pour exécuter FFmpeg et suivre la progression
    // 🔧 Utilise nice/ionice pour priorité basse (n'impacte pas la lecture)
    const runFFmpeg = (args: string[], label: string, progressWeight: number, progressOffset: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        console.log(`[TRANSCODE] FFmpeg ${label}: nice -n 19 ffmpeg`, args.join(' ').slice(0, 200) + '...')
        
        // nice -n 19 = priorité CPU la plus basse
        // ionice -c 3 = priorité I/O idle (seulement quand le disque est libre)
        const ffmpeg = spawn('nice', ['-n', '19', 'ionice', '-c', '3', 'ffmpeg', ...args], {
          stdio: ['ignore', 'pipe', 'pipe']
        })

        // 🔧 Enregistrer le processus pour ce job (support multi-jobs)
        this.activeProcesses.set(job.id, ffmpeg)
        job.pid = ffmpeg.pid
        
        let lastError = ''

        ffmpeg.stderr?.on('data', (data) => {
          const message = data.toString()
          lastError = message // Garder la dernière sortie pour debug
          
          const timeMatch = message.match(/time=(\d+):(\d+):(\d+)\.(\d+)/)
          const speedMatch = message.match(/speed=\s*([\d.]+)x/)
          
          if (timeMatch) {
            const hours = parseInt(timeMatch[1])
            const minutes = parseInt(timeMatch[2])
            const seconds = parseInt(timeMatch[3])
            job.currentTime = hours * 3600 + minutes * 60 + seconds
            
            if (job.estimatedDuration && job.estimatedDuration > 0) {
              const passProgress = (job.currentTime / job.estimatedDuration) * 100
              job.progress = Math.min(99, progressOffset + (passProgress * progressWeight / 100))
            }
          }
          
          if (speedMatch) {
            job.speed = parseFloat(speedMatch[1])
          }
        })

        ffmpeg.on('close', (code) => {
          // Le processus sera nettoyé par processQueue après completion
          if (code === 0) {
            console.log(`[TRANSCODE] ${label} terminé`)
            resolve()
          } else {
            console.error(`[TRANSCODE] FFmpeg ${label} erreur (code ${code}):`)
            console.error(`[TRANSCODE] Dernière sortie: ${lastError.slice(-500)}`)
            reject(new Error(`FFmpeg ${label} exit code: ${code}`))
          }
        })

        ffmpeg.on('error', (err) => {
          reject(err)
        })
      })
    }

    try {
      // Calculer les poids de progression
      const videoWeight = streamInfo.audioCount > 0 ? 70 : 100 // Vidéo = 70% si audio présent
      const audioWeight = streamInfo.audioCount > 0 ? 30 / streamInfo.audioCount : 0
      
      // PASS 1: Vidéo
      await runFFmpeg(videoArgs, 'Vidéo', videoWeight, 0)
      
      // PASS 2+: Audio(s)
      for (let i = 0; i < audioArgsList.length; i++) {
        const audioOffset = videoWeight + (i * audioWeight)
        await runFFmpeg(audioArgsList[i], `Audio ${i + 1}/${audioArgsList.length}`, audioWeight, audioOffset)
      }
      
      // PASS FINAL: Créer le master playlist
      console.log(`[TRANSCODE] Création du master playlist...`)
      
      const masterPlaylist = this.createMasterPlaylist(streamInfo, audioInfo)
      await writeFile(path.join(job.outputDir, 'playlist.m3u8'), masterPlaylist)
      console.log(`[TRANSCODE] Master playlist créé`)
      
      // Supprimer le verrou et créer .done
      await rm(transcodingLockPath, { force: true })
      await writeFile(path.join(job.outputDir, '.done'), new Date().toISOString())
      
      // Marquer comme transcodé en BDD pour l'affichage dans l'interface
      await this.markAsTranscoded(job.filepath)
      
    } catch (error) {
      // Supprimer le verrou en cas d'erreur
      try {
        await rm(transcodingLockPath, { force: true })
      } catch (rmError) {
        console.warn('[TRANSCODE] Erreur suppression lock erreur:', rmError instanceof Error ? rmError.message : rmError)
      }
      throw error
    }
  }

  /**
   * Créer le master playlist HLS avec EXT-X-MEDIA pour chaque piste audio
   */
  private createMasterPlaylist(
    streamInfo: { audioCount: number; audios: Array<{ index: number; language: string; title?: string }> },
    audioInfo: Array<{ index: number; language: string; title: string; playlist: string; isDefault: boolean }>
  ): string {
    const lines: string[] = [
      '#EXTM3U',
      '#EXT-X-VERSION:6'
    ]
    
    // Ajouter les pistes audio avec EXT-X-MEDIA
    if (audioInfo.length > 0) {
      for (const audio of audioInfo) {
        const defaultAttr = audio.isDefault ? 'YES' : 'NO'
        const name = audio.title || `Audio ${audio.index + 1}`
        const lang = audio.language || 'und'
        
        lines.push(
          `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${name}",LANGUAGE="${lang}",DEFAULT=${defaultAttr},AUTOSELECT=YES,URI="${audio.playlist}"`
        )
      }
      
      // Stream principal avec référence au groupe audio
      lines.push('#EXT-X-STREAM-INF:BANDWIDTH=5000000,CODECS="avc1.640028,mp4a.40.2",AUDIO="audio"')
      lines.push('video.m3u8')
    } else {
      // Pas d'audio séparé, juste la vidéo
      lines.push('#EXT-X-STREAM-INF:BANDWIDTH=5000000,CODECS="avc1.640028"')
      lines.push('video.m3u8')
    }
    
    return lines.join('\n')
  }

  /**
   * Ajouter un fichier à la queue avec haute priorité (nouveau fichier)
   */
  async addToQueue(filepath: string, highPriority: boolean = false): Promise<TranscodeJob | null> {
    // Normaliser le chemin et le nom pour éviter les doublons
    const normalizedPath = path.normalize(filepath)
    const filename = path.basename(filepath)
    const normalizedFilename = filename.toLowerCase().trim() // Comparaison insensible à la casse
    
    // VÉRIFICATION ULTRA-STRICTE DES DOUBLONS PAR FILENAME (insensible à la casse)
    const existingByFilename = this.queue.find(j => j.filename.toLowerCase().trim() === normalizedFilename)
    if (existingByFilename) {
      console.log(`[TRANSCODE] [DOUBLON] Fichier déjà dans la queue: ${filename}`)
      if (highPriority) {
        existingByFilename.priority = Date.now()
        this.queue.sort((a, b) => b.priority - a.priority)
        await this.saveState()
      }
      return existingByFilename
    }
    
    // Vérifier aussi par chemin complet (double sécurité)
    const existingByPath = this.queue.find(j => path.normalize(j.filepath) === normalizedPath)
    if (existingByPath) {
      console.log(`[TRANSCODE] [DOUBLON] Chemin déjà dans la queue: ${filename}`)
      if (highPriority) {
        existingByPath.priority = Date.now()
        this.queue.sort((a, b) => b.priority - a.priority)
        await this.saveState()
      }
      return existingByPath
    }
    
    // Vérifier si c'est un des jobs en cours (insensible à la casse)
    for (const [, activeJob] of this.activeJobs) {
      if (activeJob.filename.toLowerCase().trim() === normalizedFilename || 
          path.normalize(activeJob.filepath) === normalizedPath) {
        console.log(`[TRANSCODE] [DOUBLON] Fichier en cours de transcodage: ${filename}`)
        return activeJob
      }
    }
    
    // Vérifier si déjà complété récemment (insensible à la casse)
    const recentlyCompleted = this.completedJobs.find(j => 
      j.filename.toLowerCase().trim() === normalizedFilename || 
      path.normalize(j.filepath) === normalizedPath
    )
    if (recentlyCompleted) {
      console.log(`[TRANSCODE] [DOUBLON] Fichier déjà transcodé: ${filename}`)
      return null
    }

    const outputDir = this.getOutputDir(filepath)
    
    // Vérifier si déjà transcodé sur le disque
    if (await this.isAlreadyTranscoded(outputDir)) {
      console.log(`[TRANSCODE] Fichier déjà transcodé (sur disque): ${filename}`)
      return null
    }

    // Obtenir les stats du fichier
    let fileSize = 0
    let mtime = new Date().toISOString()
    try {
      const stats = await stat(filepath)
      fileSize = stats.size
      mtime = stats.mtime.toISOString()
    } catch (error) {
      console.warn('[TRANSCODE] Impossible d\'obtenir stats fichier:', error instanceof Error ? error.message : error)
    }

    const job: TranscodeJob = {
      id: crypto.randomUUID(),
      filepath,
      filename,
      outputDir,
      status: 'pending',
      progress: 0,
      priority: highPriority ? Date.now() : 0,
      fileSize,
      mtime
    }

    if (highPriority) {
      this.queue.unshift(job)
    } else {
      this.queue.push(job)
    }

    await this.saveState()
    console.log(`[TRANSCODE] Ajouté à la queue: ${filename} (priorité: ${highPriority ? 'haute' : 'normale'})`)
    return job
  }

  /**
   * Annuler un job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    // Vérifier si c'est un job actif
    const activeJob = this.activeJobs.get(jobId)
    if (activeJob) {
      const process = this.activeProcesses.get(jobId)
      if (process) {
        process.kill('SIGTERM')
      }
      activeJob.status = 'cancelled'
      this.activeJobs.delete(jobId)
      this.activeProcesses.delete(jobId)
      await this.saveState()
      return true
    }

    // Sinon vérifier dans la queue
    const index = this.queue.findIndex(j => j.id === jobId)
    if (index !== -1) {
      this.queue[index].status = 'cancelled'
      this.queue.splice(index, 1)
      await this.saveState()
      return true
    }

    return false
  }

  /**
   * Supprimer les doublons de la queue
   * Garde le premier job pour chaque fichier unique
   */
  async removeDuplicates(): Promise<number> {
    // Utiliser le FILENAME NORMALISÉ comme clé (insensible à la casse)
    const seenByFilename = new Map<string, TranscodeJob>()
    const duplicateIds: string[] = []
    
    for (const job of this.queue) {
      const key = job.filename.toLowerCase().trim() // Clé normalisée
      
      if (seenByFilename.has(key)) {
        // Garder celui avec la plus haute priorité ou le premier
        const existing = seenByFilename.get(key)!
        if (job.priority > existing.priority) {
          // Le nouveau a plus de priorité, supprimer l'ancien
          duplicateIds.push(existing.id)
          seenByFilename.set(key, job)
          console.log(`[TRANSCODE] Doublon supprimé (priorité inférieure): ${existing.filename}`)
        } else {
          // L'ancien a plus de priorité, supprimer le nouveau
          duplicateIds.push(job.id)
          console.log(`[TRANSCODE] Doublon supprimé: ${job.filename}`)
        }
      } else {
        seenByFilename.set(key, job)
      }
    }
    
    if (duplicateIds.length > 0) {
      this.queue = this.queue.filter(j => !duplicateIds.includes(j.id))
      await this.saveState()
      console.log(`[TRANSCODE] ${duplicateIds.length} doublon(s) supprimé(s) de la queue`)
    }
    
    return duplicateIds.length
  }

  /**
   * Déplacer un job vers le haut dans la queue (plus prioritaire)
   */
  async moveJobUp(jobId: string): Promise<boolean> {
    const index = this.queue.findIndex(j => j.id === jobId)
    if (index <= 0) return false // Déjà en haut ou non trouvé
    
    // Échanger avec le job précédent
    const temp = this.queue[index - 1]
    this.queue[index - 1] = this.queue[index]
    this.queue[index] = temp
    
    await this.saveState()
    console.log(`[TRANSCODE] Job déplacé: ${this.queue[index - 1].filename}`)
    return true
  }

  /**
   * Déplacer un job vers le bas dans la queue (moins prioritaire)
   */
  async moveJobDown(jobId: string): Promise<boolean> {
    const index = this.queue.findIndex(j => j.id === jobId)
    if (index === -1 || index >= this.queue.length - 1) return false // En bas ou non trouvé
    
    // Échanger avec le job suivant
    const temp = this.queue[index + 1]
    this.queue[index + 1] = this.queue[index]
    this.queue[index] = temp
    
    await this.saveState()
    console.log(`[TRANSCODE] Job déplacé: ${this.queue[index + 1].filename}`)
    return true
  }

  /**
   * Déplacer un job en première position (prochaine à transcoder)
   */
  async moveJobToTop(jobId: string): Promise<boolean> {
    const index = this.queue.findIndex(j => j.id === jobId)
    if (index <= 0) return false // Déjà en haut ou non trouvé
    
    const job = this.queue.splice(index, 1)[0]
    this.queue.unshift(job)
    
    await this.saveState()
    console.log(`[TRANSCODE] Job en tête: ${job.filename}`)
    return true
  }

  /**
   * Réordonner la queue complète (nouvelle liste d'IDs dans l'ordre souhaité)
   */
  async reorderQueue(jobIds: string[]): Promise<boolean> {
    // Créer une map des jobs existants
    const jobMap = new Map(this.queue.map(j => [j.id, j]))
    
    // Vérifier que tous les IDs sont valides
    for (const id of jobIds) {
      if (!jobMap.has(id)) {
        console.error(`[TRANSCODE] Job non trouvé: ${id}`)
        return false
      }
    }
    
    // Réordonner selon la nouvelle liste
    const newQueue: TranscodeJob[] = []
    for (const id of jobIds) {
      const job = jobMap.get(id)
      if (job) {
        newQueue.push(job)
        jobMap.delete(id)
      }
    }
    
    // Ajouter les jobs restants (au cas où certains IDs manquent)
    for (const job of jobMap.values()) {
      newQueue.push(job)
    }
    
    this.queue = newQueue
    await this.saveState()
    console.log(`[TRANSCODE] Queue réordonnée: ${this.queue.length} jobs`)
    return true
  }

  /**
   * Supprimer plusieurs jobs de la queue
   */
  async removeJobs(jobIds: string[]): Promise<number> {
    let removedCount = 0
    
    for (const id of jobIds) {
      const index = this.queue.findIndex(j => j.id === id)
      if (index !== -1) {
        this.queue.splice(index, 1)
        removedCount++
      }
    }
    
    if (removedCount > 0) {
      await this.saveState()
      console.log(`[TRANSCODE] ${removedCount} jobs supprimés de la queue`)
    }
    
    return removedCount
  }

  /**
   * Obtenir les statistiques
   */
  // Cache pour diskUsage (évite le du -sh lent)
  private diskUsageCache: { value: string; timestamp: number } | null = null
  private readonly DISK_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

  async getStats(): Promise<TranscodeStats> {
    // Utiliser le cache pour diskUsage
    let diskUsage = this.diskUsageCache?.value || 'N/A'
    const now = Date.now()
    
    // Recalculer en arrière-plan si le cache est expiré
    if (!this.diskUsageCache || (now - this.diskUsageCache.timestamp) > this.DISK_CACHE_TTL) {
      // Lancer en arrière-plan sans bloquer
      execAsync(`du -sh ${TRANSCODED_DIR} 2>/dev/null`).then(({ stdout }) => {
        this.diskUsageCache = { value: stdout.split('\t')[0], timestamp: Date.now() }
      }).catch(() => {})
    }

    // Calculer le temps restant estimé basé sur tous les jobs actifs
    let estimatedTimeRemaining: number | undefined
    const activeJobsArray = Array.from(this.activeJobs.values())
    const firstActiveJob = activeJobsArray[0] // Utiliser le premier job actif pour la vitesse moyenne
    
    if (firstActiveJob?.speed && firstActiveJob?.estimatedDuration && firstActiveJob?.currentTime) {
      estimatedTimeRemaining = 0
      
      // Temps restant pour tous les jobs actifs
      for (const activeJob of activeJobsArray) {
        if (activeJob.estimatedDuration && activeJob.currentTime) {
          const remaining = activeJob.estimatedDuration - activeJob.currentTime
          estimatedTimeRemaining += remaining / (activeJob.speed || firstActiveJob.speed || 1)
        }
      }

      // Temps pour les jobs en queue (divisé par le nombre de workers)
      for (const job of this.queue) {
        if (job.estimatedDuration) {
          estimatedTimeRemaining += job.estimatedDuration / (firstActiveJob.speed || 1) / MAX_CONCURRENT_TRANSCODES
        } else {
          estimatedTimeRemaining += 7200 / MAX_CONCURRENT_TRANSCODES
        }
      }
    }

    // Vérifier si le watcher est actif
    let watcherActive = false
    try {
      const fileWatcherModule = await import('./file-watcher')
      watcherActive = fileWatcherModule.default.isActive()
    } catch (error) {
      console.warn('[TRANSCODE] Erreur vérification watcher:', error instanceof Error ? error.message : error)
    }

    return {
      totalFiles: this.queue.length + this.completedJobs.length + this.activeJobs.size,
      completedFiles: this.completedJobs.length,
      pendingFiles: this.queue.length,
      failedFiles: this.completedJobs.filter(j => j.status === 'failed').length,
      currentJob: firstActiveJob || undefined, // Premier job actif pour compatibilité
      activeJobs: activeJobsArray, // 🔧 Tous les jobs actifs
      activeCount: this.activeJobs.size, // 🔧 Nombre de jobs actifs
      maxConcurrent: MAX_CONCURRENT_TRANSCODES, // 🔧 Limite max
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      estimatedTimeRemaining,
      diskUsage,
      autoStartEnabled: this.autoStartEnabled,
      watcherActive
    }
  }

  /**
   * Obtenir la queue complète
   */
  getQueue(): TranscodeJob[] {
    return [...this.queue]
  }

  /**
   * Obtenir les jobs terminés
   */
  getCompletedJobs(): TranscodeJob[] {
    return [...this.completedJobs]
  }

  /**
   * Nettoyer les fichiers transcodés d'un film
   */
  async cleanupTranscoded(filepath: string): Promise<boolean> {
    const outputDir = this.getOutputDir(filepath)
    
    try {
      await rm(outputDir, { recursive: true, force: true })
      this.invalidateTranscodedCache()
      console.log(`[TRANSCODE] Nettoyé: ${outputDir}`)
      return true
    } catch (error) {
      console.error(`[TRANSCODE] Erreur nettoyage ${outputDir}:`, error)
      return false
    }
  }

  /**
   * Supprimer un film transcodé par son nom de dossier
   */
  async deleteTranscoded(folderName: string): Promise<boolean> {
    const outputDir = path.join(TRANSCODED_DIR, folderName)
    
    try {
      await rm(outputDir, { recursive: true, force: true })
      this.invalidateTranscodedCache()
      console.log(`[TRANSCODE] Supprimé: ${outputDir}`)
      return true
    } catch (error) {
      console.error(`[TRANSCODE] Erreur suppression ${outputDir}:`, error)
      return false
    }
  }

  /**
   * Lister tous les films transcodés (avec cache)
   */
  private transcodedCache: Array<{
    name: string
    folder: string
    transcodedAt: string
    segmentCount: number
    isComplete: boolean
    hasMultiAudio: boolean
    hasSubtitles: boolean
    audioCount: number
    subtitleCount: number
  }> | null = null
  private transcodedCacheTime: number = 0
  private readonly CACHE_TTL = 120000 // 2 minutes (était 30s)

  async listTranscoded(): Promise<Array<{
    name: string
    folder: string
    transcodedAt: string
    segmentCount: number
    isComplete: boolean
    hasMultiAudio: boolean
    hasSubtitles: boolean
    audioCount: number
    subtitleCount: number
  }>> {
    // Utiliser le cache si frais
    const now = Date.now()
    if (this.transcodedCache && (now - this.transcodedCacheTime) < this.CACHE_TTL) {
      return this.transcodedCache
    }

    type TranscodedItem = {
      name: string
      folder: string
      transcodedAt: string
      segmentCount: number
      isComplete: boolean
      hasMultiAudio: boolean
      hasSubtitles: boolean
      audioCount: number
      subtitleCount: number
    }

    const transcoded: TranscodedItem[] = []

    try {
      // Collecter tous les dossiers candidats (async)
      const collectCandidates = async (baseDir: string, prefix: string = ''): Promise<Array<{ folderPath: string; entryName: string; prefix: string }>> => {
        const candidates: Array<{ folderPath: string; entryName: string; prefix: string }> = []
        
        if (!existsSync(baseDir)) return candidates
        
        try {
          const entries = await readdir(baseDir, { withFileTypes: true })
          
          for (const entry of entries) {
            if (!entry.isDirectory()) continue
            if (entry.name.startsWith('.')) continue
            if (entry.name === 'series' && prefix === '') continue
            
            const folderPath = path.join(baseDir, entry.name)
            const transcodingPath = path.join(folderPath, '.transcoding')
            const donePath = path.join(folderPath, '.done')
            
            // Skip si en cours ou pas terminé
            if (existsSync(transcodingPath)) continue
            if (!existsSync(donePath)) continue
            
            candidates.push({ folderPath, entryName: entry.name, prefix })
          }
        } catch (err) {
          console.error(`[TRANSCODE] Erreur scan ${baseDir}:`, err)
        }
        
        return candidates
      }
      
      // Collecter les films et séries en parallèle
      const [filmCandidates, seriesCandidates] = await Promise.all([
        collectCandidates(TRANSCODED_DIR),
        collectCandidates(path.join(TRANSCODED_DIR, 'series'), '📺 ')
      ])
      
      const allCandidates = [...filmCandidates, ...seriesCandidates]
      console.log(`[TRANSCODE] Scan: ${allCandidates.length} dossiers transcodés trouvés`)
      
      // Traiter tous les candidats EN PARALLÈLE (par lots de 50)
      const BATCH_SIZE = 50
      
      const processCandidate = async (candidate: { folderPath: string; entryName: string; prefix: string }): Promise<TranscodedItem | null> => {
        const { folderPath, entryName, prefix } = candidate
        
        try {
          const donePath = path.join(folderPath, '.done')
          
          // Lire date + fichiers en parallèle
          const [doneContent, files] = await Promise.all([
            readFile(donePath, 'utf-8'),
            readdir(folderPath)
          ])
          
          const transcodedAt = doneContent.trim()
          const segmentCount = files.filter(f => f.endsWith('.ts')).length
          
          // Audio et sous-titres (lecture conditionnelle)
          let audioCount = 1
          let subtitleCount = 0
          
          if (files.includes('audio_info.json')) {
            try {
              const audioInfo = JSON.parse(await readFile(path.join(folderPath, 'audio_info.json'), 'utf-8'))
              audioCount = Array.isArray(audioInfo) ? audioInfo.length : 1
            } catch (error) {
              // Fichier corrompu ou illisible, utiliser valeur par défaut
            }
          }
          
          if (files.includes('subtitles.json')) {
            try {
              const subsInfo = JSON.parse(await readFile(path.join(folderPath, 'subtitles.json'), 'utf-8'))
              subtitleCount = Array.isArray(subsInfo) ? subsInfo.length : 0
            } catch (error) {
              // Fichier corrompu ou illisible, utiliser valeur par défaut
            }
          }
          
          return {
            name: prefix + entryName.replace(/_/g, ' '),
            folder: prefix ? `series/${entryName}` : entryName,
            transcodedAt,
            segmentCount,
            isComplete: true,
            hasMultiAudio: audioCount > 1,
            hasSubtitles: subtitleCount > 0,
            audioCount,
            subtitleCount
          }
        } catch {
          return null
        }
      }
      
      // Traiter par lots pour éviter trop de file handles
      for (let i = 0; i < allCandidates.length; i += BATCH_SIZE) {
        const batch = allCandidates.slice(i, i + BATCH_SIZE)
        const results = await Promise.all(batch.map(processCandidate))
        transcoded.push(...results.filter((r): r is TranscodedItem => r !== null))
      }
      
      // Trier par date de transcodage (plus récent en premier)
      transcoded.sort((a, b) => {
        const dateA = new Date(a.transcodedAt).getTime()
        const dateB = new Date(b.transcodedAt).getTime()
        return dateB - dateA
      })
      
      console.log(`[TRANSCODE] ${transcoded.length} films/séries transcodés listés`)
      
      // Mettre en cache
      this.transcodedCache = transcoded
      this.transcodedCacheTime = now
      
      return transcoded
    } catch (error) {
      console.error('[TRANSCODE] Erreur listage transcodés:', error)
      return []
    }
  }
  
  /**
   * Invalider le cache des transcodés
   */
  invalidateTranscodedCache(): void {
    this.transcodedCache = null
  }

  /**
   * Activer/désactiver le démarrage automatique
   */
  setAutoStart(enabled: boolean): void {
    this.autoStartEnabled = enabled
    console.log(`[TRANSCODE] Auto-start: ${enabled ? 'activé' : 'désactivé'}`)
  }
}

// Singleton global
if (!global.__transcodingServiceSingleton) {
  console.log('[TRANSCODE] Création du singleton TranscodingService')
  global.__transcodingServiceSingleton = new TranscodingService()
} else {
  console.log('[TRANSCODE] Réutilisation du singleton TranscodingService')
}

const transcodingService = global.__transcodingServiceSingleton

export default transcodingService
export { TranscodingService, TRANSCODED_DIR, MEDIA_DIR }
