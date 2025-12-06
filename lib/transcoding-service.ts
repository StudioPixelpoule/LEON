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
   * Toujours trié par date de modification (plus récent en premier)
   */
  async scanAndQueue(): Promise<number> {
    console.log('🔍 Scan des films (priorité: derniers ajouts)...')
    
    const files = await this.scanMediaDirectory()
    let addedCount = 0

    for (const file of files) {
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
        priority: file.mtime.getTime(), // Priorité = timestamp de modification
        fileSize: file.size,
        mtime: file.mtime.toISOString()
      }

      this.queue.push(job)
      addedCount++
    }

    // Trier par priorité (timestamp plus élevé = plus récent = premier)
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
   * Scanner le répertoire media
   */
  private async scanMediaDirectory(): Promise<Array<{ filepath: string; filename: string; mtime: Date; size: number }>> {
    const files: Array<{ filepath: string; filename: string; mtime: Date; size: number }> = []

    const scanDir = async (dir: string) => {
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          
          if (entry.isDirectory()) {
            await scanDir(fullPath)
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            if (VIDEO_EXTENSIONS.includes(ext)) {
              const stats = await stat(fullPath)
              files.push({
                filepath: fullPath,
                filename: entry.name,
                mtime: stats.mtime,
                size: stats.size
              })
            }
          }
        }
      } catch (error) {
        console.error(`❌ Erreur scan ${dir}:`, error)
      }
    }

    await scanDir(MEDIA_DIR)
    
    // Trier par date de modification (plus récent en premier)
    files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    
    return files
  }

  /**
   * Obtenir le répertoire de sortie pour un fichier
   */
  private getOutputDir(filepath: string): string {
    const filename = path.basename(filepath, path.extname(filepath))
    const safeName = filename.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s\-_.()[\]]/gi, '_')
    return path.join(TRANSCODED_DIR, safeName)
  }

  /**
   * Vérifier si un fichier est déjà transcodé
   * Vérifie .done OU (playlist.m3u8 + assez de segments)
   * Retourne false si .transcoding existe (transcodage interrompu)
   */
  async isAlreadyTranscoded(outputDir: string): Promise<boolean> {
    const donePath = path.join(outputDir, '.done')
    const transcodingPath = path.join(outputDir, '.transcoding')
    const playlistPath = path.join(outputDir, 'playlist.m3u8')
    
    // 0. Si .transcoding existe, c'est un transcodage interrompu
    if (existsSync(transcodingPath)) {
      return false
    }
    
    // 1. Vérification rapide : fichier .done existe
    if (existsSync(donePath)) {
      return true
    }
    
    // 2. Vérification approfondie : playlist + segments suffisants
    if (existsSync(playlistPath)) {
      try {
        const playlistContent = await readFile(playlistPath, 'utf-8')
        // Vérifier que le playlist est complet (contient #EXT-X-ENDLIST)
        if (playlistContent.includes('#EXT-X-ENDLIST')) {
          // Compter les segments déclarés dans le playlist
          const segmentCount = (playlistContent.match(/segment\d+\.ts/g) || []).length
          
          if (segmentCount > 100) {
            // Créer le fichier .done pour les prochaines fois
            console.log(`📝 Création .done pour ${outputDir} (${segmentCount} segments détectés)`)
            await writeFile(donePath, new Date().toISOString())
            return true
          }
        }
      } catch (error) {
        console.error(`⚠️ Erreur lecture playlist ${playlistPath}:`, error)
      }
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
    
    try {
      const entries = await readdir(TRANSCODED_DIR, { withFileTypes: true })
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        
        const dirPath = path.join(TRANSCODED_DIR, entry.name)
        const donePath = path.join(dirPath, '.done')
        const transcodingPath = path.join(dirPath, '.transcoding')
        
        // Si .transcoding existe, c'est un transcodage interrompu - supprimer
        if (existsSync(transcodingPath)) {
          console.log(`🗑️ Suppression transcodage interrompu: ${entry.name}`)
          await rm(dirPath, { recursive: true, force: true })
          cleaned.push(entry.name)
          continue
        }
        
        // Si .done existe, garder
        if (existsSync(donePath)) {
          kept.push(entry.name)
          continue
        }
        
        // Compter les segments
        const files = await readdir(dirPath)
        const segmentCount = files.filter(f => f.match(/^segment\d+\.ts$/)).length
        
        if (segmentCount < 100) {
          // Transcodage incomplet - supprimer
          console.log(`🗑️ Suppression transcodage incomplet: ${entry.name} (${segmentCount} segments)`)
          await rm(dirPath, { recursive: true, force: true })
          cleaned.push(entry.name)
        } else {
          // Assez de segments - créer .done
          console.log(`📝 Création .done pour: ${entry.name} (${segmentCount} segments)`)
          await writeFile(donePath, new Date().toISOString())
          kept.push(entry.name)
        }
      }
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
        
        // Réessayer plus tard (ajouter en fin de queue)
        if (!job.error.includes('SIGKILL') && !job.error.includes('SIGTERM')) {
          job.status = 'pending'
          job.priority = 0 // Basse priorité pour les retry
          this.queue.push(job)
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
   * Transcoder un fichier
   */
  private async transcodeFile(job: TranscodeJob): Promise<void> {
    await mkdir(job.outputDir, { recursive: true })
    
    // Créer le fichier verrou .transcoding
    const transcodingLockPath = path.join(job.outputDir, '.transcoding')
    await writeFile(transcodingLockPath, new Date().toISOString())

    // Obtenir la durée du fichier
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${job.filepath}"`
      )
      job.estimatedDuration = parseFloat(stdout.trim())
    } catch {
      job.estimatedDuration = undefined
    }

    const hardware = await detectHardwareCapabilities()
    const playlistPath = path.join(job.outputDir, 'playlist.m3u8')
    
    const ffmpegArgs = [
      ...hardware.decoderArgs,
      '-i', job.filepath,
      '-map', '0:v:0',
      '-map', '0:a?',
      ...(hardware.acceleration === 'vaapi' 
        ? [] 
        : ['-vf', 'format=yuv420p']),
      ...hardware.encoderArgs,
      '-g', '48',
      '-keyint_min', '24',
      '-sc_threshold', '0',
      '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_DURATION})`,
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ac', '2',
      '-ar', '48000',
      '-f', 'hls',
      '-hls_time', String(SEGMENT_DURATION),
      '-hls_list_size', '0',
      '-hls_segment_type', 'mpegts',
      '-hls_flags', 'independent_segments',
      '-hls_segment_filename', path.join(job.outputDir, 'segment%d.ts'),
      '-hls_playlist_type', 'vod',
      '-start_number', '0',
      playlistPath
    ]

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      this.currentProcess = ffmpeg
      job.pid = ffmpeg.pid

      ffmpeg.stderr?.on('data', (data) => {
        const message = data.toString()
        
        const timeMatch = message.match(/time=(\d+):(\d+):(\d+)\.(\d+)/)
        const speedMatch = message.match(/speed=\s*([\d.]+)x/)
        
        if (timeMatch) {
          const hours = parseInt(timeMatch[1])
          const minutes = parseInt(timeMatch[2])
          const seconds = parseInt(timeMatch[3])
          job.currentTime = hours * 3600 + minutes * 60 + seconds
          
          if (job.estimatedDuration && job.estimatedDuration > 0) {
            job.progress = Math.min(99, (job.currentTime / job.estimatedDuration) * 100)
          }
        }
        
        if (speedMatch) {
          job.speed = parseFloat(speedMatch[1])
        }
      })

      ffmpeg.on('close', async (code) => {
        this.currentProcess = null
        
        // Toujours supprimer le verrou .transcoding (succès ou échec)
        try {
          await rm(transcodingLockPath, { force: true })
        } catch {}
        
        if (code === 0) {
          // Créer le fichier .done seulement en cas de succès
          await writeFile(path.join(job.outputDir, '.done'), new Date().toISOString())
          resolve()
        } else {
          reject(new Error(`FFmpeg exit code: ${code}`))
        }
      })

      ffmpeg.on('error', async (err) => {
        this.currentProcess = null
        // Supprimer le verrou en cas d'erreur
        try {
          await rm(transcodingLockPath, { force: true })
        } catch {}
        reject(err)
      })
    })
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
  }> | null = null
  private transcodedCacheTime: number = 0
  private readonly CACHE_TTL = 30000 // 30 secondes

  async listTranscoded(): Promise<Array<{
    name: string
    folder: string
    transcodedAt: string
    segmentCount: number
    isComplete: boolean
  }>> {
    // Utiliser le cache si frais
    const now = Date.now()
    if (this.transcodedCache && (now - this.transcodedCacheTime) < this.CACHE_TTL) {
      return this.transcodedCache
    }

    const transcoded: Array<{
      name: string
      folder: string
      transcodedAt: string
      segmentCount: number
      isComplete: boolean
    }> = []

    try {
      const entries = await readdir(TRANSCODED_DIR, { withFileTypes: true })
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith('.')) continue
        
        const folderPath = path.join(TRANSCODED_DIR, entry.name)
        const donePath = path.join(folderPath, '.done')
        const transcodingPath = path.join(folderPath, '.transcoding')
        
        // Si .transcoding existe, ignorer
        if (existsSync(transcodingPath)) continue
        
        // Vérifier si le transcodage est complet
        if (!existsSync(donePath)) continue
        
        try {
          // Lire la date de completion
          const doneContent = await readFile(donePath, 'utf-8')
          const transcodedAt = doneContent.trim()
          
          // Compter les segments (sans calculer la taille - trop lent)
          const files = await readdir(folderPath)
          const segmentCount = files.filter(f => f.endsWith('.ts')).length
          
          transcoded.push({
            name: entry.name.replace(/_/g, ' '),
            folder: entry.name,
            transcodedAt,
            segmentCount,
            isComplete: true
          })
        } catch (error) {
          // Ignorer silencieusement
        }
      }
      
      // Trier par date de transcodage (plus récent en premier)
      transcoded.sort((a, b) => {
        const dateA = new Date(a.transcodedAt).getTime()
        const dateB = new Date(b.transcodedAt).getTime()
        return dateB - dateA
      })
      
    } catch (error) {
      console.error('Erreur listage transcodés:', error)
    }
    
    // Mettre en cache
    this.transcodedCache = transcoded
    this.transcodedCacheTime = now
    
    return transcoded
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
