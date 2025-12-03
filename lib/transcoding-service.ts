/**
 * Service de pré-transcodage automatique pour LEON
 * 
 * Fonctionnalités :
 * - Transcodage batch de tous les films existants
 * - Watcher pour les nouveaux fichiers ajoutés
 * - Gestion des priorités (films populaires, récents, etc.)
 * - Pause/reprise du transcodage
 * - Statistiques et progression
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
const MAX_CONCURRENT_TRANSCODES = 1 // Un seul transcodage à la fois pour ne pas surcharger
const SEGMENT_DURATION = 2 // Durée des segments HLS en secondes

// Extensions vidéo supportées
const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v']

// Types
export interface TranscodeJob {
  id: string
  filepath: string
  filename: string
  outputDir: string
  status: 'pending' | 'transcoding' | 'completed' | 'failed' | 'cancelled'
  progress: number // 0-100
  startedAt?: Date
  completedAt?: Date
  error?: string
  priority: number // Plus élevé = plus prioritaire
  estimatedDuration?: number // Durée estimée en secondes
  currentTime?: number // Temps actuel transcodé
  speed?: number // Vitesse de transcodage (ex: 2.5x)
  pid?: number
}

export interface TranscodeStats {
  totalFiles: number
  completedFiles: number
  pendingFiles: number
  failedFiles: number
  currentJob?: TranscodeJob
  isRunning: boolean
  isPaused: boolean
  estimatedTimeRemaining?: number // En secondes
  diskUsage?: string
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

  constructor() {
    console.log('🎬 Initialisation TranscodingService')
    this.ensureDirectories()
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
   * Scanner les films et créer la queue de transcodage
   */
  async scanAndQueue(priorityMode: 'alphabetical' | 'recent' | 'popular' = 'alphabetical'): Promise<number> {
    console.log(`🔍 Scan des films (mode: ${priorityMode})...`)
    
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

      // Calculer la priorité
      let priority = 0
      switch (priorityMode) {
        case 'recent':
          priority = file.mtime.getTime()
          break
        case 'popular':
          // TODO: Récupérer depuis la DB les films les plus regardés
          priority = Math.random() * 1000
          break
        case 'alphabetical':
        default:
          priority = -file.filename.charCodeAt(0)
      }

      const job: TranscodeJob = {
        id: crypto.randomUUID(),
        filepath: file.filepath,
        filename: file.filename,
        outputDir,
        status: 'pending',
        progress: 0,
        priority
      }

      this.queue.push(job)
      addedCount++
    }

    // Trier par priorité (plus élevé en premier)
    this.queue.sort((a, b) => b.priority - a.priority)

    console.log(`✅ ${addedCount} films ajoutés à la queue (${this.queue.length} total)`)
    return addedCount
  }

  /**
   * Scanner le répertoire media
   */
  private async scanMediaDirectory(): Promise<Array<{ filepath: string; filename: string; mtime: Date }>> {
    const files: Array<{ filepath: string; filename: string; mtime: Date }> = []

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
                mtime: stats.mtime
              })
            }
          }
        }
      } catch (error) {
        console.error(`❌ Erreur scan ${dir}:`, error)
      }
    }

    await scanDir(MEDIA_DIR)
    return files
  }

  /**
   * Obtenir le répertoire de sortie pour un fichier
   */
  private getOutputDir(filepath: string): string {
    const filename = path.basename(filepath, path.extname(filepath))
    // Nettoyer le nom de fichier pour éviter les problèmes
    const safeName = filename.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s\-_.()[\]]/gi, '_')
    return path.join(TRANSCODED_DIR, safeName)
  }

  /**
   * Vérifier si un fichier est déjà transcodé
   */
  async isAlreadyTranscoded(outputDir: string): Promise<boolean> {
    const playlistPath = path.join(outputDir, 'playlist.m3u8')
    const donePath = path.join(outputDir, '.done')
    
    // Vérifier si le fichier .done existe (transcodage complet)
    if (existsSync(donePath)) {
      return true
    }
    
    return false
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
    if (this.isRunning) {
      console.log('⚠️ Service déjà en cours')
      return
    }

    this.isRunning = true
    this.isPaused = false
    console.log('🚀 Démarrage du service de transcodage')

    await this.processQueue()
  }

  /**
   * Mettre en pause le transcodage
   */
  pause(): void {
    this.isPaused = true
    console.log('⏸️ Transcodage en pause')
    
    // Tuer le processus en cours si existant
    if (this.currentProcess && this.currentJob) {
      this.currentProcess.kill('SIGTERM')
      this.currentJob.status = 'pending'
      this.queue.unshift(this.currentJob)
      this.currentJob = null
    }
  }

  /**
   * Reprendre le transcodage
   */
  async resume(): Promise<void> {
    if (!this.isPaused) return
    
    this.isPaused = false
    console.log('▶️ Reprise du transcodage')
    
    if (this.isRunning) {
      await this.processQueue()
    }
  }

  /**
   * Arrêter complètement le service
   */
  stop(): void {
    this.isRunning = false
    this.isPaused = false
    
    if (this.currentProcess) {
      this.currentProcess.kill('SIGKILL')
    }
    
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
      job.startedAt = new Date()

      console.log(`🎬 Transcodage: ${job.filename}`)

      try {
        await this.transcodeFile(job)
        
        job.status = 'completed'
        job.completedAt = new Date()
        job.progress = 100
        
        this.completedJobs.push(job)
        console.log(`✅ Terminé: ${job.filename}`)
      } catch (error) {
        job.status = 'failed'
        job.error = error instanceof Error ? error.message : String(error)
        job.completedAt = new Date()
        
        console.error(`❌ Échec: ${job.filename}`, error)
      }

      this.currentJob = null
    }

    if (this.queue.length === 0) {
      console.log('🎉 Queue de transcodage terminée!')
    }
  }

  /**
   * Transcoder un fichier
   */
  private async transcodeFile(job: TranscodeJob): Promise<void> {
    // Créer le répertoire de sortie
    await mkdir(job.outputDir, { recursive: true })

    // Obtenir la durée du fichier
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${job.filepath}"`
      )
      job.estimatedDuration = parseFloat(stdout.trim())
    } catch {
      job.estimatedDuration = undefined
    }

    // Détecter le hardware
    const hardware = await detectHardwareCapabilities()
    
    const playlistPath = path.join(job.outputDir, 'playlist.m3u8')
    
    // Construire la commande FFmpeg
    const ffmpegArgs = [
      // Décodage matériel si disponible
      ...hardware.decoderArgs,
      '-i', job.filepath,
      // Mapper toutes les pistes audio
      '-map', '0:v:0',
      '-map', '0:a?', // Toutes les pistes audio
      // Encodage vidéo
      ...(hardware.acceleration === 'vaapi' 
        ? [] 
        : ['-vf', 'format=yuv420p']),
      ...hardware.encoderArgs,
      // GOP et keyframes pour seek précis
      '-g', '48',
      '-keyint_min', '24',
      '-sc_threshold', '0',
      '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_DURATION})`,
      // Audio : haute qualité
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ac', '2',
      '-ar', '48000',
      // HLS
      '-f', 'hls',
      '-hls_time', String(SEGMENT_DURATION),
      '-hls_list_size', '0',
      '-hls_segment_type', 'mpegts',
      '-hls_flags', 'independent_segments',
      '-hls_segment_filename', path.join(job.outputDir, 'segment%d.ts'),
      '-hls_playlist_type', 'vod', // VOD car fichier complet
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
        
        // Parser la progression
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
        
        if (code === 0) {
          // Créer le fichier .done
          await writeFile(path.join(job.outputDir, '.done'), new Date().toISOString())
          resolve()
        } else {
          reject(new Error(`FFmpeg exit code: ${code}`))
        }
      })

      ffmpeg.on('error', (err) => {
        this.currentProcess = null
        reject(err)
      })
    })
  }

  /**
   * Ajouter un fichier à la queue avec haute priorité
   */
  addToQueue(filepath: string, highPriority: boolean = false): TranscodeJob | null {
    // Vérifier si déjà dans la queue
    const existing = this.queue.find(j => j.filepath === filepath)
    if (existing) {
      if (highPriority) {
        existing.priority = Date.now() // Mettre en haut de la queue
        this.queue.sort((a, b) => b.priority - a.priority)
      }
      return existing
    }

    const outputDir = this.getOutputDir(filepath)
    const filename = path.basename(filepath)

    const job: TranscodeJob = {
      id: crypto.randomUUID(),
      filepath,
      filename,
      outputDir,
      status: 'pending',
      progress: 0,
      priority: highPriority ? Date.now() : 0
    }

    if (highPriority) {
      this.queue.unshift(job)
    } else {
      this.queue.push(job)
    }

    console.log(`➕ Ajouté à la queue: ${filename} (priorité: ${highPriority ? 'haute' : 'normale'})`)
    return job
  }

  /**
   * Annuler un job
   */
  cancelJob(jobId: string): boolean {
    // Si c'est le job en cours
    if (this.currentJob?.id === jobId) {
      if (this.currentProcess) {
        this.currentProcess.kill('SIGTERM')
      }
      this.currentJob.status = 'cancelled'
      this.currentJob = null
      return true
    }

    // Sinon, le retirer de la queue
    const index = this.queue.findIndex(j => j.id === jobId)
    if (index !== -1) {
      this.queue[index].status = 'cancelled'
      this.queue.splice(index, 1)
      return true
    }

    return false
  }

  /**
   * Obtenir les statistiques
   */
  async getStats(): Promise<TranscodeStats> {
    // Calculer l'espace disque utilisé
    let diskUsage = 'N/A'
    try {
      const { stdout } = await execAsync(`du -sh ${TRANSCODED_DIR} 2>/dev/null`)
      diskUsage = stdout.split('\t')[0]
    } catch {}

    // Estimer le temps restant
    let estimatedTimeRemaining: number | undefined
    if (this.currentJob?.speed && this.currentJob?.estimatedDuration && this.currentJob?.currentTime) {
      const remaining = this.currentJob.estimatedDuration - this.currentJob.currentTime
      estimatedTimeRemaining = remaining / this.currentJob.speed

      // Ajouter le temps pour les jobs en attente (estimation grossière)
      for (const job of this.queue) {
        if (job.estimatedDuration) {
          estimatedTimeRemaining += job.estimatedDuration / (this.currentJob.speed || 1)
        } else {
          estimatedTimeRemaining += 7200 // Estimation 2h par film
        }
      }
    }

    return {
      totalFiles: this.queue.length + this.completedJobs.length + (this.currentJob ? 1 : 0),
      completedFiles: this.completedJobs.length,
      pendingFiles: this.queue.length,
      failedFiles: this.completedJobs.filter(j => j.status === 'failed').length,
      currentJob: this.currentJob || undefined,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      estimatedTimeRemaining,
      diskUsage
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
      console.log(`🗑️ Nettoyé: ${outputDir}`)
      return true
    } catch (error) {
      console.error(`❌ Erreur nettoyage ${outputDir}:`, error)
      return false
    }
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

