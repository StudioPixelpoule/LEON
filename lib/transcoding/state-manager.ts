/**
 * Gestion de l'état persistant de la queue de transcodage
 * Lecture/écriture du fichier JSON, nettoyage des doublons
 */

import { writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import type { TranscodeJob, QueueState } from './types'

/**
 * Charger l'état depuis le fichier JSON
 * Restaure les jobs pending, gère la reprise des jobs interrompus
 */
export async function loadQueueState(stateFile: string): Promise<{
  queue: TranscodeJob[]
  completedJobs: TranscodeJob[]
  isPaused: boolean
} | null> {
  try {
    if (!existsSync(stateFile)) {
      console.log('[TRANSCODE] Pas d\'état sauvegardé, démarrage fresh')
      return null
    }

    const data = await readFile(stateFile, 'utf-8')
    const state: QueueState = JSON.parse(data)

    // Restaurer uniquement les jobs pending
    let queue = state.queue.filter(j => j.status === 'pending')
    const completedJobs = state.completedJobs || []
    const isPaused = state.isPaused || false

    // Reprise du job interrompu (remettre en tête de queue)
    if (state.interruptedJob) {
      const interruptedFilename = state.interruptedJob.filename.toLowerCase().trim()
      const alreadyInQueue = queue.some(j => j.filename.toLowerCase().trim() === interruptedFilename)

      if (!alreadyInQueue) {
        const resumedJob: TranscodeJob = {
          ...state.interruptedJob,
          status: 'pending',
          progress: 0,
          priority: Date.now()
        }
        queue.unshift(resumedJob)
        console.log(`[TRANSCODE] Job interrompu remis en tête de queue: ${state.interruptedJob.filename}`)
      } else {
        console.log(`[TRANSCODE] Job interrompu déjà dans la queue: ${state.interruptedJob.filename}`)
      }
    }

    // Nettoyage ultra-strict des doublons (insensible à la casse)
    queue = deduplicateQueue(queue)

    // Tri par priorité (plus récent = plus prioritaire)
    queue.sort((a, b) => b.priority - a.priority)

    console.log(`[TRANSCODE] État restauré: ${queue.length} jobs en attente, ${completedJobs.length} terminés`)
    console.log(`[TRANSCODE] Dernière sauvegarde: ${state.lastSaved}`)

    return { queue, completedJobs, isPaused }
  } catch (error) {
    console.error('[TRANSCODE] Erreur chargement état:', error)
    return null
  }
}

/**
 * Sauvegarder l'état dans le fichier JSON
 */
export async function saveQueueState(
  stateFile: string,
  queue: TranscodeJob[],
  completedJobs: TranscodeJob[],
  activeJobs: Map<string, TranscodeJob>,
  isRunning: boolean,
  isPaused: boolean
): Promise<void> {
  try {
    // Nettoyage des doublons avant sauvegarde
    const cleanQueue = deduplicateQueue(queue)

    // Sauvegarder les jobs actifs pour reprise après redémarrage
    const activeJobsArray = Array.from(activeJobs.values()).map(job => ({
      ...job,
      status: 'pending' as const,
      progress: 0
    }))

    const state: QueueState = {
      queue: [...activeJobsArray, ...cleanQueue],
      completedJobs: completedJobs.slice(-100),
      interruptedJob: undefined,
      isRunning,
      isPaused,
      lastSaved: new Date().toISOString(),
      version: 1
    }

    await writeFile(stateFile, JSON.stringify(state, null, 2))
  } catch (error) {
    console.error('[TRANSCODE] Erreur sauvegarde état:', error)
  }
}

/**
 * Supprimer les doublons de la queue (insensible à la casse)
 * Retourne une nouvelle queue nettoyée
 */
export function deduplicateQueue(queue: TranscodeJob[]): TranscodeJob[] {
  const seenFilenames = new Set<string>()
  const clean: TranscodeJob[] = []
  let removed = 0

  for (const job of queue) {
    const normalizedName = job.filename.toLowerCase().trim()
    if (!seenFilenames.has(normalizedName)) {
      seenFilenames.add(normalizedName)
      clean.push(job)
    } else {
      removed++
    }
  }

  if (removed > 0) {
    console.log(`[TRANSCODE] Nettoyage auto: ${removed} doublon(s) supprimé(s)`)
  }

  return clean
}
