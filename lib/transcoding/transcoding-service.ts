/**
 * Service de pré-transcodage automatique pour LEON
 * 
 * Orchestrateur principal — délègue aux modules spécialisés :
 * - state-manager : persistance JSON
 * - media-scanner : scan FS + vérification transcodage
 * - cleanup-service : nettoyage incomplets/interrompus
 * - db-sync : synchronisation BDD Supabase
 * - ffmpeg-executor : transcodage FFmpeg
 * - transcoded-lister : listing avec cache
 * - queue-manager : manipulation de la queue
 */

import { spawn } from 'child_process'
import { promisify } from 'util'
import { exec } from 'child_process'
import { mkdir, rm, writeFile } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

import {
  TRANSCODED_DIR, MEDIA_DIR, STATE_FILE,
  MAX_CONCURRENT_TRANSCODES, AUTO_SAVE_INTERVAL,
  type TranscodeJob, type TranscodeStats
} from './types'
import { loadQueueState, saveQueueState } from './state-manager'
import { scanMediaDirectory, getOutputDir, isAlreadyTranscoded } from './media-scanner'
import { cleanupInProgress } from './cleanup-service'
import { cleanupIncomplete as cleanupIncompleteService } from './cleanup-service'
import { markAsTranscoded, syncTranscodedStatus as syncTranscodedStatusService } from './db-sync'
import { transcodeFile as transcodeFileService } from './ffmpeg-executor'
import { listTranscoded as listTranscodedService, invalidateTranscodedCache } from './transcoded-lister'
import {
  addToQueue as addToQueueService,
  cancelJob as cancelJobService,
  removeDuplicates as removeDuplicatesService,
  moveJobUp as moveJobUpService,
  moveJobDown as moveJobDownService,
  moveJobToTop as moveJobToTopService,
  reorderQueue as reorderQueueService,
  removeJobs as removeJobsService,
  type QueueContext
} from './queue-manager'

const execAsync = promisify(exec)

// Déclaration globale pour le singleton
declare global {
  var __transcodingServiceSingleton: TranscodingService | undefined
}

class TranscodingService {
  private queue: TranscodeJob[] = []
  private completedJobs: TranscodeJob[] = []
  private activeJobs: Map<string, TranscodeJob> = new Map()
  private activeProcesses: Map<string, ReturnType<typeof spawn>> = new Map()
  private isRunning: boolean = false
  private isPaused: boolean = false
  private autoSaveInterval: NodeJS.Timeout | null = null
  private autoStartEnabled: boolean = true
  private initialized: boolean = false

  // Cache diskUsage
  private diskUsageCache: { value: string; timestamp: number } | null = null
  private readonly DISK_CACHE_TTL = 10 * 60 * 1000

  constructor() {
    console.log('[TRANSCODE] Initialisation TranscodingService')
    this.init()
  }

  // ─── Initialisation ─────────────────────────────────────────────────────

  private async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    try {
      await mkdir(TRANSCODED_DIR, { recursive: true })
      console.log(`[TRANSCODE] Répertoire transcodé: ${TRANSCODED_DIR}`)

      const cleanedCount = await cleanupInProgress()
      await this.loadState()

      if (cleanedCount > 0) {
        console.log('[TRANSCODE] Re-scan après nettoyage pour remettre les films en queue...')
        await this.scanAndQueue()
      }

      this.startAutoSave()

      console.log('[TRANSCODE] Synchronisation is_transcoded au boot...')
      await syncTranscodedStatusService()

      if (this.queue.length > 0 && !this.isPaused && this.autoStartEnabled) {
        console.log('[TRANSCODE] Reprise automatique du transcodage...')
        setTimeout(() => this.start(), 5000)
      }

      setTimeout(() => this.startWatcher(), 10000)
      console.log('[TRANSCODE] Service de transcodage initialisé')
    } catch (error) {
      console.error('[TRANSCODE] Erreur initialisation:', error)
    }
  }

  private async loadState(): Promise<void> {
    const loaded = await loadQueueState(STATE_FILE)
    if (loaded) {
      this.queue = loaded.queue
      this.completedJobs = loaded.completedJobs
      this.isPaused = loaded.isPaused
    }
  }

  async saveState(): Promise<void> {
    await saveQueueState(
      STATE_FILE, this.queue, this.completedJobs,
      this.activeJobs, this.isRunning, this.isPaused
    )
  }

  private startAutoSave(): void {
    if (this.autoSaveInterval) return
    this.autoSaveInterval = setInterval(() => { this.saveState() }, AUTO_SAVE_INTERVAL)
    console.log(`[TRANSCODE] Auto-save activé (${AUTO_SAVE_INTERVAL / 1000}s)`)
  }

  private async startWatcher(): Promise<void> {
    try {
      const fileWatcherModule = await import('../file-watcher')
      const fileWatcher = fileWatcherModule.default
      if (!fileWatcher.isActive()) {
        await fileWatcher.start()
        console.log('[TRANSCODE] Watcher démarré automatiquement')
      }
    } catch (error) {
      console.error('[TRANSCODE] Erreur démarrage watcher:', error)
    }
  }

  // ─── Scan et queue ──────────────────────────────────────────────────────

  async scanAndQueue(): Promise<number> {
    console.log('[TRANSCODE] Scan des films (priorité: alternance films/séries)...')

    const files = await scanMediaDirectory()
    let addedCount = 0
    const maxPriority = Date.now()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const outputDir = getOutputDir(file.filepath)

      if (await isAlreadyTranscoded(outputDir)) continue
      if (this.queue.some(j => j.filepath === file.filepath)) continue

      const job: TranscodeJob = {
        id: crypto.randomUUID(),
        filepath: file.filepath,
        filename: file.filename,
        outputDir,
        status: 'pending',
        progress: 0,
        priority: maxPriority - i,
        fileSize: file.size,
        mtime: file.mtime.toISOString()
      }

      this.queue.push(job)
      addedCount++
    }

    this.queue.sort((a, b) => b.priority - a.priority)
    await this.saveState()

    console.log(`[TRANSCODE] ${addedCount} films ajoutés à la queue (${this.queue.length} total)`)

    if (this.queue.length > 0) {
      console.log('[TRANSCODE] Prochains films à transcoder:')
      this.queue.slice(0, 5).forEach((job, i) => {
        const date = job.mtime ? new Date(job.mtime).toLocaleDateString('fr-FR') : 'N/A'
        console.log(`[TRANSCODE] ${i + 1}. ${job.filename} (ajouté le ${date})`)
      })
    }

    return addedCount
  }

  // ─── Délégations directes ───────────────────────────────────────────────

  getOutputDir(filepath: string): string {
    return getOutputDir(filepath)
  }

  async isAlreadyTranscoded(outputDir: string): Promise<boolean> {
    return isAlreadyTranscoded(outputDir)
  }

  async getTranscodedPath(originalPath: string): Promise<string | null> {
    const outputDir = getOutputDir(originalPath)
    const playlistPath = path.join(outputDir, 'playlist.m3u8')
    if (await isAlreadyTranscoded(outputDir)) return playlistPath
    return null
  }

  async cleanupIncomplete(): Promise<{ cleaned: string[], kept: string[] }> {
    return cleanupIncompleteService()
  }

  async syncTranscodedStatus(): Promise<number> {
    return syncTranscodedStatusService()
  }

  async listTranscoded() {
    return listTranscodedService()
  }

  invalidateTranscodedCache(): void {
    invalidateTranscodedCache()
  }

  // ─── Contrôle du service ────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isRunning && !this.isPaused) {
      console.log('[TRANSCODE] Service déjà en cours')
      return
    }
    this.isRunning = true
    this.isPaused = false
    console.log('[TRANSCODE] Démarrage du service de transcodage')
    await this.saveState()
    await this.processQueue()
  }

  async pause(): Promise<void> {
    this.isPaused = true
    console.log('[TRANSCODE] Transcodage en pause')

    for (const [jobId, job] of this.activeJobs) {
      const process = this.activeProcesses.get(jobId)
      if (process) {
        const transcodingLockPath = path.join(job.outputDir, '.transcoding')
        try { await rm(transcodingLockPath, { force: true }) } catch (error) {
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

  async resume(): Promise<void> {
    if (!this.isPaused) return
    this.isPaused = false
    console.log('[TRANSCODE] Reprise du transcodage')
    await this.saveState()
    if (this.isRunning) await this.processQueue()
  }

  async stop(): Promise<void> {
    this.isRunning = false
    this.isPaused = false

    for (const [jobId, job] of this.activeJobs) {
      const transcodingLockPath = path.join(job.outputDir, '.transcoding')
      try { await rm(transcodingLockPath, { force: true }) } catch (error) {
        console.warn('[TRANSCODE] Erreur suppression lock stop:', error instanceof Error ? error.message : error)
      }
      const process = this.activeProcesses.get(jobId)
      if (process) process.kill('SIGKILL')
      job.status = 'pending'
      this.queue.unshift(job)
    }

    this.activeJobs.clear()
    this.activeProcesses.clear()
    await this.saveState()
    console.log('[TRANSCODE] Service de transcodage arrêté')
  }

  // ─── Traitement de la queue ─────────────────────────────────────────────

  private async processQueue(): Promise<void> {
    const startWorker = async (workerId: number): Promise<void> => {
      while (this.isRunning && !this.isPaused) {
        if (this.activeJobs.size >= MAX_CONCURRENT_TRANSCODES) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        }

        const job = this.queue.shift()
        if (!job) break

        this.activeJobs.set(job.id, job)
        job.status = 'transcoding'
        job.startedAt = new Date().toISOString()

        console.log(`[TRANSCODE] [Worker ${workerId}] Transcodage: ${job.filename} (${this.activeJobs.size}/${MAX_CONCURRENT_TRANSCODES} actifs)`)
        await this.saveState()

        try {
          await transcodeFileService(job, {
            setActiveProcess: (jobId, process) => {
              this.activeProcesses.set(jobId, process)
            }
          })

          job.status = 'completed'
          job.completedAt = new Date().toISOString()
          job.progress = 100

          this.completedJobs.push(job)
          if (this.completedJobs.length > 200) {
            this.completedJobs = this.completedJobs.slice(-100)
          }
          console.log(`[TRANSCODE] [Worker ${workerId}] Terminé: ${job.filename}`)
        } catch (error) {
          job.status = 'failed'
          job.error = error instanceof Error ? error.message : String(error)
          job.completedAt = new Date().toISOString()

          const retryCount = (job.retryCount || 0) + 1
          const MAX_RETRIES = 3

          const isFatalError = job.error.includes('SIGKILL') ||
                              job.error.includes('SIGTERM') ||
                              job.error.includes('corrompu') ||
                              job.error.includes('Invalid data')

          if (!isFatalError && retryCount < MAX_RETRIES) {
            job.status = 'pending'
            job.retryCount = retryCount
            job.priority = 0
            this.queue.push(job)
            console.log(`[TRANSCODE] [Worker ${workerId}] Retry ${retryCount}/${MAX_RETRIES} pour: ${job.filename}`)
          } else {
            const reason = isFatalError ? 'erreur fatale' : `${MAX_RETRIES} tentatives échouées`
            console.log(`[TRANSCODE] [Worker ${workerId}] Fichier ignoré définitivement (${reason}): ${job.filename}`)
          }

          console.error(`[TRANSCODE] [Worker ${workerId}] Échec: ${job.filename}`, error)
        }

        this.activeJobs.delete(job.id)
        this.activeProcesses.delete(job.id)
        await this.saveState()
      }
    }

    const workers: Promise<void>[] = []
    for (let i = 0; i < MAX_CONCURRENT_TRANSCODES; i++) {
      workers.push(startWorker(i + 1))
    }
    await Promise.all(workers)

    if (this.queue.length === 0 && this.activeJobs.size === 0 && this.isRunning) {
      console.log('[TRANSCODE] Queue de transcodage terminée!')
      this.isRunning = false
      await this.saveState()
    }
  }

  // ─── Queue management (délégation) ──────────────────────────────────────

  private get queueContext(): QueueContext {
    return {
      queue: this.queue,
      activeJobs: this.activeJobs,
      completedJobs: this.completedJobs,
      saveState: () => this.saveState()
    }
  }

  async addToQueue(filepath: string, highPriority: boolean = false): Promise<TranscodeJob | null> {
    return addToQueueService(this.queueContext, filepath, highPriority)
  }

  async cancelJob(jobId: string): Promise<boolean> {
    return cancelJobService(this.queueContext, jobId, this.activeProcesses)
  }

  async removeDuplicates(): Promise<number> {
    return removeDuplicatesService(this.queueContext)
  }

  async moveJobUp(jobId: string): Promise<boolean> {
    return moveJobUpService(this.queueContext, jobId)
  }

  async moveJobDown(jobId: string): Promise<boolean> {
    return moveJobDownService(this.queueContext, jobId)
  }

  async moveJobToTop(jobId: string): Promise<boolean> {
    return moveJobToTopService(this.queueContext, jobId)
  }

  async reorderQueue(jobIds: string[]): Promise<boolean> {
    return reorderQueueService(this.queueContext, jobIds)
  }

  async removeJobs(jobIds: string[]): Promise<number> {
    return removeJobsService(this.queueContext, jobIds)
  }

  // ─── Stats ──────────────────────────────────────────────────────────────

  async getStats(): Promise<TranscodeStats> {
    let diskUsage = this.diskUsageCache?.value || 'N/A'
    const now = Date.now()

    if (!this.diskUsageCache || (now - this.diskUsageCache.timestamp) > this.DISK_CACHE_TTL) {
      execAsync(`du -sh ${TRANSCODED_DIR} 2>/dev/null`).then(({ stdout }) => {
        this.diskUsageCache = { value: stdout.split('\t')[0], timestamp: Date.now() }
      }).catch(() => {})
    }

    let estimatedTimeRemaining: number | undefined
    const activeJobsArray = Array.from(this.activeJobs.values())
    const firstActiveJob = activeJobsArray[0]

    if (firstActiveJob?.speed && firstActiveJob?.estimatedDuration && firstActiveJob?.currentTime) {
      estimatedTimeRemaining = 0

      for (const activeJob of activeJobsArray) {
        if (activeJob.estimatedDuration && activeJob.currentTime) {
          const remaining = activeJob.estimatedDuration - activeJob.currentTime
          estimatedTimeRemaining += remaining / (activeJob.speed || firstActiveJob.speed || 1)
        }
      }

      for (const job of this.queue) {
        if (job.estimatedDuration) {
          estimatedTimeRemaining += job.estimatedDuration / (firstActiveJob.speed || 1) / MAX_CONCURRENT_TRANSCODES
        } else {
          estimatedTimeRemaining += 7200 / MAX_CONCURRENT_TRANSCODES
        }
      }
    }

    let watcherActive = false
    try {
      const fileWatcherModule = await import('../file-watcher')
      watcherActive = fileWatcherModule.default.isActive()
    } catch (error) {
      console.warn('[TRANSCODE] Erreur vérification watcher:', error instanceof Error ? error.message : error)
    }

    return {
      totalFiles: this.queue.length + this.completedJobs.length + this.activeJobs.size,
      completedFiles: this.completedJobs.length,
      pendingFiles: this.queue.length,
      failedFiles: this.completedJobs.filter(j => j.status === 'failed').length,
      currentJob: firstActiveJob || undefined,
      activeJobs: activeJobsArray,
      activeCount: this.activeJobs.size,
      maxConcurrent: MAX_CONCURRENT_TRANSCODES,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      estimatedTimeRemaining,
      diskUsage,
      autoStartEnabled: this.autoStartEnabled,
      watcherActive
    }
  }

  getQueue(): TranscodeJob[] { return [...this.queue] }
  getCompletedJobs(): TranscodeJob[] { return [...this.completedJobs] }

  // ─── Nettoyage fichiers transcodés ──────────────────────────────────────

  async cleanupTranscoded(filepath: string): Promise<boolean> {
    const outputDir = getOutputDir(filepath)
    try {
      await rm(outputDir, { recursive: true, force: true })
      invalidateTranscodedCache()
      console.log(`[TRANSCODE] Nettoyé: ${outputDir}`)
      return true
    } catch (error) {
      console.error(`[TRANSCODE] Erreur nettoyage ${outputDir}:`, error)
      return false
    }
  }

  async deleteTranscoded(folderName: string): Promise<boolean> {
    const outputDir = path.join(TRANSCODED_DIR, folderName)
    try {
      await rm(outputDir, { recursive: true, force: true })
      invalidateTranscodedCache()
      console.log(`[TRANSCODE] Supprimé: ${outputDir}`)
      return true
    } catch (error) {
      console.error(`[TRANSCODE] Erreur suppression ${outputDir}:`, error)
      return false
    }
  }

  setAutoStart(enabled: boolean): void {
    this.autoStartEnabled = enabled
    console.log(`[TRANSCODE] Auto-start: ${enabled ? 'activé' : 'désactivé'}`)
  }
}

export { TranscodingService }
export default TranscodingService
