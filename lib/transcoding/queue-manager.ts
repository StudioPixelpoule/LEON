/**
 * Gestion de la queue de transcodage
 * Ajout, suppression, réordonnancement, gestion des doublons
 */

import { stat } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import type { TranscodeJob } from './types'
import { getOutputDir, isAlreadyTranscoded } from './media-scanner'

/** Contexte partagé de la queue (état mutable du service) */
export interface QueueContext {
  queue: TranscodeJob[]
  activeJobs: Map<string, TranscodeJob>
  completedJobs: TranscodeJob[]
  saveState: () => Promise<void>
}

/**
 * Ajouter un fichier à la queue avec gestion ultra-stricte des doublons
 */
export async function addToQueue(
  ctx: QueueContext,
  filepath: string,
  highPriority: boolean = false
): Promise<TranscodeJob | null> {
  const normalizedPath = path.normalize(filepath)
  const filename = path.basename(filepath)
  const normalizedFilename = filename.toLowerCase().trim()

  // Vérification par filename (insensible à la casse)
  const existingByFilename = ctx.queue.find(j => j.filename.toLowerCase().trim() === normalizedFilename)
  if (existingByFilename) {
    console.log(`[TRANSCODE] [DOUBLON] Fichier déjà dans la queue: ${filename}`)
    if (highPriority) {
      existingByFilename.priority = Date.now()
      ctx.queue.sort((a, b) => b.priority - a.priority)
      await ctx.saveState()
    }
    return existingByFilename
  }

  // Vérification par chemin complet
  const existingByPath = ctx.queue.find(j => path.normalize(j.filepath) === normalizedPath)
  if (existingByPath) {
    console.log(`[TRANSCODE] [DOUBLON] Chemin déjà dans la queue: ${filename}`)
    if (highPriority) {
      existingByPath.priority = Date.now()
      ctx.queue.sort((a, b) => b.priority - a.priority)
      await ctx.saveState()
    }
    return existingByPath
  }

  // Vérification jobs en cours
  for (const [, activeJob] of ctx.activeJobs) {
    if (activeJob.filename.toLowerCase().trim() === normalizedFilename ||
        path.normalize(activeJob.filepath) === normalizedPath) {
      console.log(`[TRANSCODE] [DOUBLON] Fichier en cours de transcodage: ${filename}`)
      return activeJob
    }
  }

  // Vérification jobs récemment complétés
  const recentlyCompleted = ctx.completedJobs.find(j =>
    j.filename.toLowerCase().trim() === normalizedFilename ||
    path.normalize(j.filepath) === normalizedPath
  )
  if (recentlyCompleted) {
    console.log(`[TRANSCODE] [DOUBLON] Fichier déjà transcodé: ${filename}`)
    return null
  }

  const outputDir = getOutputDir(filepath)

  // Vérification transcodage existant sur disque
  if (await isAlreadyTranscoded(outputDir)) {
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
    ctx.queue.unshift(job)
  } else {
    ctx.queue.push(job)
  }

  await ctx.saveState()
  console.log(`[TRANSCODE] Ajouté à la queue: ${filename} (priorité: ${highPriority ? 'haute' : 'normale'})`)
  return job
}

/**
 * Annuler un job (actif ou en queue)
 */
export async function cancelJob(
  ctx: QueueContext,
  jobId: string,
  activeProcesses: Map<string, { kill: (signal?: number | NodeJS.Signals) => boolean }>
): Promise<boolean> {
  const activeJob = ctx.activeJobs.get(jobId)
  if (activeJob) {
    const process = activeProcesses.get(jobId)
    if (process) {
      process.kill('SIGTERM')
    }
    activeJob.status = 'cancelled'
    ctx.activeJobs.delete(jobId)
    activeProcesses.delete(jobId)
    await ctx.saveState()
    return true
  }

  const index = ctx.queue.findIndex(j => j.id === jobId)
  if (index !== -1) {
    ctx.queue[index].status = 'cancelled'
    ctx.queue.splice(index, 1)
    await ctx.saveState()
    return true
  }

  return false
}

/**
 * Supprimer les doublons de la queue (insensible à la casse)
 */
export async function removeDuplicates(ctx: QueueContext): Promise<number> {
  const seenByFilename = new Map<string, TranscodeJob>()
  const duplicateIds: string[] = []

  for (const job of ctx.queue) {
    const key = job.filename.toLowerCase().trim()

    if (seenByFilename.has(key)) {
      const existing = seenByFilename.get(key)!
      if (job.priority > existing.priority) {
        duplicateIds.push(existing.id)
        seenByFilename.set(key, job)
        console.log(`[TRANSCODE] Doublon supprimé (priorité inférieure): ${existing.filename}`)
      } else {
        duplicateIds.push(job.id)
        console.log(`[TRANSCODE] Doublon supprimé: ${job.filename}`)
      }
    } else {
      seenByFilename.set(key, job)
    }
  }

  if (duplicateIds.length > 0) {
    ctx.queue = ctx.queue.filter(j => !duplicateIds.includes(j.id))
    await ctx.saveState()
    console.log(`[TRANSCODE] ${duplicateIds.length} doublon(s) supprimé(s) de la queue`)
  }

  return duplicateIds.length
}

/** Déplacer un job vers le haut */
export async function moveJobUp(ctx: QueueContext, jobId: string): Promise<boolean> {
  const index = ctx.queue.findIndex(j => j.id === jobId)
  if (index <= 0) return false

  const temp = ctx.queue[index - 1]
  ctx.queue[index - 1] = ctx.queue[index]
  ctx.queue[index] = temp

  await ctx.saveState()
  console.log(`[TRANSCODE] Job déplacé: ${ctx.queue[index - 1].filename}`)
  return true
}

/** Déplacer un job vers le bas */
export async function moveJobDown(ctx: QueueContext, jobId: string): Promise<boolean> {
  const index = ctx.queue.findIndex(j => j.id === jobId)
  if (index === -1 || index >= ctx.queue.length - 1) return false

  const temp = ctx.queue[index + 1]
  ctx.queue[index + 1] = ctx.queue[index]
  ctx.queue[index] = temp

  await ctx.saveState()
  console.log(`[TRANSCODE] Job déplacé: ${ctx.queue[index + 1].filename}`)
  return true
}

/** Déplacer un job en première position */
export async function moveJobToTop(ctx: QueueContext, jobId: string): Promise<boolean> {
  const index = ctx.queue.findIndex(j => j.id === jobId)
  if (index <= 0) return false

  const job = ctx.queue.splice(index, 1)[0]
  ctx.queue.unshift(job)

  await ctx.saveState()
  console.log(`[TRANSCODE] Job en tête: ${job.filename}`)
  return true
}

/** Réordonner la queue complète */
export async function reorderQueue(ctx: QueueContext, jobIds: string[]): Promise<boolean> {
  const jobMap = new Map(ctx.queue.map(j => [j.id, j]))

  for (const id of jobIds) {
    if (!jobMap.has(id)) {
      console.error(`[TRANSCODE] Job non trouvé: ${id}`)
      return false
    }
  }

  const newQueue: TranscodeJob[] = []
  for (const id of jobIds) {
    const job = jobMap.get(id)
    if (job) {
      newQueue.push(job)
      jobMap.delete(id)
    }
  }

  for (const job of jobMap.values()) {
    newQueue.push(job)
  }

  ctx.queue = newQueue
  await ctx.saveState()
  console.log(`[TRANSCODE] Queue réordonnée: ${ctx.queue.length} jobs`)
  return true
}

/** Supprimer plusieurs jobs de la queue */
export async function removeJobs(ctx: QueueContext, jobIds: string[]): Promise<number> {
  let removedCount = 0

  for (const id of jobIds) {
    const index = ctx.queue.findIndex(j => j.id === id)
    if (index !== -1) {
      ctx.queue.splice(index, 1)
      removedCount++
    }
  }

  if (removedCount > 0) {
    await ctx.saveState()
    console.log(`[TRANSCODE] ${removedCount} jobs supprimés de la queue`)
  }

  return removedCount
}
