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
const MAX_CONCURRENT_TRANSCODES = 1
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
  currentJob?: TranscodeJob
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
  private currentJob: TranscodeJob | null = null
  private isRunning: boolean = false
  private isPaused: boolean = false
  private currentProcess: ReturnType<typeof spawn> | null = null
  private autoSaveInterval: NodeJS.Timeout | null = null
  private autoStartEnabled: boolean = true
  private initialized: boolean = false

  constructor() {
    console.log('🎬 Initialisation TranscodingService')
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
        console.log('🔍 Re-scan après nettoyage pour remettre les films en queue...')
        await this.scanAndQueue()
      }
      
      // Démarrer l'auto-save
      this.startAutoSave()
      
      // Démarrer automatiquement si la queue n'était pas en pause
      if (this.queue.length > 0 && !this.isPaused && this.autoStartEnabled) {
        console.log('🔄 Reprise automatique du transcodage...')
        setTimeout(() => this.start(), 5000) // Attendre 5s pour que tout soit initialisé
      }
      
      // Démarrer le watcher automatiquement
      setTimeout(() => this.startWatcher(), 10000) // Attendre 10s
      
      console.log('✅ Service de transcodage initialisé')
    } catch (error) {
      console.error('❌ Erreur initialisation:', error)
    }
  }

  /**
   * Créer les répertoires nécessaires
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await mkdir(TRANSCODED_DIR, { recursive: true })
      console.log(`📁 Répertoire transcodé: ${TRANSCODED_DIR}`)
    } catch (error) {
      console.error('❌ Erreur création répertoire:', error)
    }
  }

  /**
   * Charger l'état depuis le fichier JSON
   */
  private async loadState(): Promise<void> {
    try {
      if (!existsSync(STATE_FILE)) {
        console.log('📄 Pas d\'état sauvegardé, démarrage fresh')
        return
      }

      const data = await readFile(STATE_FILE, 'utf-8')
      const state: QueueState = JSON.parse(data)

      // Restaurer uniquement les jobs pending (pas ceux en cours de transcodage)
      this.queue = state.queue.filter(j => j.status === 'pending')
      this.completedJobs = state.completedJobs || []
      this.isPaused = state.isPaused || false

      // Re-trier par priorité (date de modification)
      this.queue.sort((a, b) => b.priority - a.priority)

      console.log(`📂 État restauré: ${this.queue.length} jobs en attente, ${this.completedJobs.length} terminés`)
      console.log(`   Dernière sauvegarde: ${state.lastSaved}`)
    } catch (error) {
      console.error('❌ Erreur chargement état:', error)
    }
  }

  /**
   * Sauvegarder l'état dans le fichier JSON
   */
  async saveState(): Promise<void> {
    try {
      const state: QueueState = {
        queue: this.queue,
        completedJobs: this.completedJobs.slice(-100), // Garder les 100 derniers
        isRunning: this.isRunning,
        isPaused: this.isPaused,
        lastSaved: new Date().toISOString(),
        version: 1
      }

      await writeFile(STATE_FILE, JSON.stringify(state, null, 2))
    } catch (error) {
      console.error('❌ Erreur sauvegarde état:', error)
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

    console.log(`💾 Auto-save activé (${AUTO_SAVE_INTERVAL / 1000}s)`)
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
        console.log('👁️ Watcher démarré automatiquement')
      }
    } catch (error) {
      console.error('❌ Erreur démarrage watcher:', error)
    }
  }

  /**
   * Scanner les films et créer la queue de transcodage
   * 🔀 Queue mélangée: alterne films et séries
   */
  async scanAndQueue(): Promise<number> {
    console.log('🔍 Scan des films (priorité: alternance films/séries)...')
    
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

    console.log(`✅ ${addedCount} films ajoutés à la queue (${this.queue.length} total)`)
    
    // Afficher les 5 premiers
    if (this.queue.length > 0) {
      console.log('📋 Prochains films à transcoder:')
      this.queue.slice(0, 5).forEach((job, i) => {
        const date = job.mtime ? new Date(job.mtime).toLocaleDateString('fr-FR') : 'N/A'
        console.log(`   ${i + 1}. ${job.filename} (ajouté le ${date})`)
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
          console.error(`❌ Erreur scan ${dir}:`, error)
        }
      }
    }

    // Scanner les films
    await scanDir(MEDIA_DIR, films)
    console.log(`🎬 ${films.length} films trouvés`)
    
    // Scanner les séries (si le dossier existe)
    try {
      await access(SERIES_DIR)
      await scanDir(SERIES_DIR, series)
      console.log(`📺 ${series.length} épisodes de séries trouvés`)
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
    
    console.log(`🔀 Queue mélangée: ${mixed.length} fichiers (alternance films/séries)`)
    
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
    const oldPlaylistPath = path.join(outputDir, 'playlist.m3u8')
    const newPlaylistPath = path.join(outputDir, 'stream_0.m3u8')
    
    const playlistPath = existsSync(newPlaylistPath) ? newPlaylistPath : 
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
          console.log(`📝 Création .done pour ${outputDir} (${segmentCount} segments détectés)`)
          await writeFile(donePath, new Date().toISOString())
          return true
        }
      }
    } catch (error) {
      console.error(`⚠️ Erreur lecture playlist ${playlistPath}:`, error)
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
          console.log(`🧹 Nettoyage transcodage interrompu: ${entry.name}`)
          await rm(dirPath, { recursive: true, force: true })
          cleanedCount++
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`✅ ${cleanedCount} transcodage(s) interrompu(s) nettoyé(s)`)
      }
      
      return cleanedCount
    } catch (error) {
      console.error('❌ Erreur nettoyage en cours:', error)
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
        const playlistPath = path.join(dirPath, 'playlist.m3u8')
        
        // Si .transcoding existe, c'est un transcodage interrompu - supprimer
        if (existsSync(transcodingPath)) {
          console.log(`🗑️ Suppression transcodage interrompu: ${prefix}${entry.name}`)
          await rm(dirPath, { recursive: true, force: true })
          cleaned.push(prefix + entry.name)
          continue
        }
        
        // Si .done existe, garder
        if (existsSync(donePath)) {
          kept.push(prefix + entry.name)
          continue
        }
        
        // Compter les segments
        const files = await readdir(dirPath)
        const segmentCount = files.filter(f => f.match(/^segment\d+\.ts$/)).length
        
        // Vérifier si le playlist est complet
        let playlistComplete = false
        if (existsSync(playlistPath)) {
          try {
            const content = await readFile(playlistPath, 'utf-8')
            playlistComplete = content.includes('#EXT-X-ENDLIST')
          } catch {}
        }
        
        // 🔧 FIX: Seuil réduit à 10 segments + playlist complet
        if (segmentCount < 10 || !playlistComplete) {
          // Transcodage incomplet - supprimer
          console.log(`🗑️ Suppression transcodage incomplet: ${prefix}${entry.name} (${segmentCount} segments, playlist: ${playlistComplete})`)
          await rm(dirPath, { recursive: true, force: true })
          cleaned.push(prefix + entry.name)
        } else {
          // Assez de segments - créer .done
          console.log(`📝 Création .done pour: ${prefix}${entry.name} (${segmentCount} segments)`)
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
      console.error('❌ Erreur cleanup incomplets:', error)
    }
    
    return { cleaned, kept }
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
      console.log('⚠️ Service déjà en cours')
      return
    }

    this.isRunning = true
    this.isPaused = false
    console.log('🚀 Démarrage du service de transcodage')

    await this.saveState()
    await this.processQueue()
  }

  /**
   * Mettre en pause le transcodage
   */
  async pause(): Promise<void> {
    this.isPaused = true
    console.log('⏸️ Transcodage en pause')
    
    // Tuer le processus en cours si existant
    if (this.currentProcess && this.currentJob) {
      // Nettoyer le fichier verrou avant de tuer le processus
      const transcodingLockPath = path.join(this.currentJob.outputDir, '.transcoding')
      try {
        await rm(transcodingLockPath, { force: true })
      } catch {}
      
      this.currentProcess.kill('SIGTERM')
      this.currentJob.status = 'pending'
      this.queue.unshift(this.currentJob)
      this.currentJob = null
    }

    await this.saveState()
  }

  /**
   * Reprendre le transcodage
   */
  async resume(): Promise<void> {
    if (!this.isPaused) return
    
    this.isPaused = false
    console.log('▶️ Reprise du transcodage')
    
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
    
    // Nettoyer le fichier verrou si un job est en cours
    if (this.currentJob) {
      const transcodingLockPath = path.join(this.currentJob.outputDir, '.transcoding')
      try {
        await rm(transcodingLockPath, { force: true })
      } catch {}
    }
    
    if (this.currentProcess) {
      this.currentProcess.kill('SIGKILL')
    }
    
    if (this.currentJob) {
      this.currentJob.status = 'pending'
      this.queue.unshift(this.currentJob)
      this.currentJob = null
    }
    
    await this.saveState()
    console.log('🛑 Service de transcodage arrêté')
  }

  /**
   * Traiter la queue de transcodage
   */
  private async processQueue(): Promise<void> {
    while (this.isRunning && !this.isPaused && this.queue.length > 0) {
      const job = this.queue.shift()
      if (!job) break

      this.currentJob = job
      job.status = 'transcoding'
      job.startedAt = new Date().toISOString()

      console.log(`🎬 Transcodage: ${job.filename}`)
      await this.saveState()

      try {
        await this.transcodeFile(job)
        
        job.status = 'completed'
        job.completedAt = new Date().toISOString()
        job.progress = 100
        
        this.completedJobs.push(job)
        console.log(`✅ Terminé: ${job.filename}`)
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
          console.log(`[TRANSCODE] ⛔ Fichier ignoré définitivement: ${job.filename}`)
        }
        
        console.error(`❌ Échec: ${job.filename}`, error)
      }

      this.currentJob = null
      await this.saveState()
    }

    if (this.queue.length === 0 && this.isRunning) {
      console.log('🎉 Queue de transcodage terminée!')
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
            console.log(`[TRANSCODE] ⏭️ Sous-titre bitmap ignoré: ${s.tags?.language || 'und'} (${codec})`)
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
        console.error('[TRANSCODE] 💀 FICHIER CORROMPU - impossible à transcoder')
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
        console.log(`[TRANSCODE] ✅ Sous-titre extrait: ${sub.language}`)
        extractedSubs.push({
          language: sub.language,
          title: sub.title,
          file: `sub_${sub.language}_${sub.index}.vtt`
        })
      } catch (error) {
        // En cas d'erreur, ignorer ce sous-titre et continuer
        console.warn(`[TRANSCODE] ⚠️ Impossible d'extraire sous-titre ${sub.language} (${sub.codec}) - ignoré`)
      }
    }
    
    // Créer un fichier JSON seulement avec les sous-titres réellement extraits
    if (extractedSubs.length > 0) {
      await writeFile(
        path.join(outputDir, 'subtitles.json'),
        JSON.stringify(extractedSubs, null, 2)
      )
      console.log(`[TRANSCODE] 📝 ${extractedSubs.length}/${subtitles.length} sous-titres extraits`)
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
      console.warn(`[TRANSCODE] ⚠️ Impossible d'obtenir la durée, estimation 2h`)
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
    
    console.log(`[TRANSCODE] 🔊 Mode DEMUXED: vidéo séparée + ${streamInfo.audioCount} audio séparés`)
    
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
      console.log(`[TRANSCODE] 🔊 audio_info.json créé avec ${audioInfo.length} pistes`)
    }
    
    // 📺 PASS 1: Encoder la VIDÉO (sans audio)
    console.log(`[TRANSCODE] 📺 Pass 1: Encodage vidéo...`)
    
    // Filtre vidéo pour conversion 10-bit → 8-bit (requis pour HEVC 10-bit → H.264)
    const videoFilter = hardware.acceleration === 'vaapi' 
      ? 'format=nv12|vaapi,hwupload'
      : 'format=yuv420p'  // Force 8-bit, gère aussi les sources 10-bit
    
    const videoArgs = [
      ...hardware.decoderArgs,
      '-i', job.filepath,
      '-map', '0:v:0',
      '-an', // PAS D'AUDIO dans le flux vidéo
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
    
    console.log(`[TRANSCODE] 🎬 Démarrage FFmpeg vidéo...`)
    console.log(`[TRANSCODE] 📋 Video args: ffmpeg ${videoArgs.slice(0, 10).join(' ')} ...`)

    // Helper pour exécuter FFmpeg et suivre la progression
    const runFFmpeg = (args: string[], label: string, progressWeight: number, progressOffset: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        console.log(`[TRANSCODE] 🔧 FFmpeg ${label}: ffmpeg`, args.join(' ').slice(0, 200) + '...')
        
        const ffmpeg = spawn('ffmpeg', args, {
          stdio: ['ignore', 'pipe', 'pipe']
        })

        this.currentProcess = ffmpeg
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
          this.currentProcess = null
          if (code === 0) {
            console.log(`[TRANSCODE] ✅ ${label} terminé`)
            resolve()
          } else {
            console.error(`[TRANSCODE] ❌ FFmpeg ${label} erreur (code ${code}):`)
            console.error(`[TRANSCODE] 📄 Dernière sortie: ${lastError.slice(-500)}`)
            reject(new Error(`FFmpeg ${label} exit code: ${code}`))
          }
        })

        ffmpeg.on('error', (err) => {
          this.currentProcess = null
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
      console.log(`[TRANSCODE] 📝 Création du master playlist...`)
      
      const masterPlaylist = this.createMasterPlaylist(streamInfo, audioInfo)
      await writeFile(path.join(job.outputDir, 'playlist.m3u8'), masterPlaylist)
      console.log(`[TRANSCODE] ✅ Master playlist créé`)
      
      // Supprimer le verrou et créer .done
      await rm(transcodingLockPath, { force: true })
      await writeFile(path.join(job.outputDir, '.done'), new Date().toISOString())
      
    } catch (error) {
      // Supprimer le verrou en cas d'erreur
      try {
        await rm(transcodingLockPath, { force: true })
      } catch {}
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
    const existing = this.queue.find(j => j.filepath === filepath)
    if (existing) {
      if (highPriority) {
        existing.priority = Date.now()
        this.queue.sort((a, b) => b.priority - a.priority)
        await this.saveState()
      }
      return existing
    }

    const outputDir = this.getOutputDir(filepath)
    const filename = path.basename(filepath)

    // Obtenir les stats du fichier
    let fileSize = 0
    let mtime = new Date().toISOString()
    try {
      const stats = await stat(filepath)
      fileSize = stats.size
      mtime = stats.mtime.toISOString()
    } catch {}

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
    console.log(`➕ Ajouté à la queue: ${filename} (priorité: ${highPriority ? 'haute' : 'normale'})`)
    return job
  }

  /**
   * Annuler un job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    if (this.currentJob?.id === jobId) {
      if (this.currentProcess) {
        this.currentProcess.kill('SIGTERM')
      }
      this.currentJob.status = 'cancelled'
      this.currentJob = null
      await this.saveState()
      return true
    }

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
   * Obtenir les statistiques
   */
  async getStats(): Promise<TranscodeStats> {
    let diskUsage = 'N/A'
    try {
      const { stdout } = await execAsync(`du -sh ${TRANSCODED_DIR} 2>/dev/null`)
      diskUsage = stdout.split('\t')[0]
    } catch {}

    let estimatedTimeRemaining: number | undefined
    if (this.currentJob?.speed && this.currentJob?.estimatedDuration && this.currentJob?.currentTime) {
      const remaining = this.currentJob.estimatedDuration - this.currentJob.currentTime
      estimatedTimeRemaining = remaining / this.currentJob.speed

      for (const job of this.queue) {
        if (job.estimatedDuration) {
          estimatedTimeRemaining += job.estimatedDuration / (this.currentJob.speed || 1)
        } else {
          estimatedTimeRemaining += 7200
        }
      }
    }

    // Vérifier si le watcher est actif
    let watcherActive = false
    try {
      const fileWatcherModule = await import('./file-watcher')
      watcherActive = fileWatcherModule.default.isActive()
    } catch {}

    return {
      totalFiles: this.queue.length + this.completedJobs.length + (this.currentJob ? 1 : 0),
      completedFiles: this.completedJobs.length,
      pendingFiles: this.queue.length,
      failedFiles: this.completedJobs.filter(j => j.status === 'failed').length,
      currentJob: this.currentJob || undefined,
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
      console.log(`🗑️ Nettoyé: ${outputDir}`)
      return true
    } catch (error) {
      console.error(`❌ Erreur nettoyage ${outputDir}:`, error)
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
      console.log(`🗑️ Supprimé: ${outputDir}`)
      return true
    } catch (error) {
      console.error(`❌ Erreur suppression ${outputDir}:`, error)
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
          console.error(`Erreur scan ${baseDir}:`, err)
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
            } catch {}
          }
          
          if (files.includes('subtitles.json')) {
            try {
              const subsInfo = JSON.parse(await readFile(path.join(folderPath, 'subtitles.json'), 'utf-8'))
              subtitleCount = Array.isArray(subsInfo) ? subsInfo.length : 0
            } catch {}
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
      console.error('Erreur listage transcodés:', error)
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
    console.log(`🔧 Auto-start: ${enabled ? 'activé' : 'désactivé'}`)
  }
}

// Singleton global
if (!global.__transcodingServiceSingleton) {
  console.log('🆕 Création du singleton TranscodingService')
  global.__transcodingServiceSingleton = new TranscodingService()
} else {
  console.log('♻️ Réutilisation du singleton TranscodingService')
}

const transcodingService = global.__transcodingServiceSingleton

export default transcodingService
export { TranscodingService, TRANSCODED_DIR, MEDIA_DIR }
