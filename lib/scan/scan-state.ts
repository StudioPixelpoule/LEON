/**
 * Gestion de l'état global du scan (singleton)
 * Persiste entre les requêtes HTTP pendant la durée de vie du processus
 */

import type { ScanState } from './types'

// Singleton pour l'état du scan
const scanState: ScanState = {
  isRunning: false,
  startedAt: null,
  currentSeries: null,
  progress: {
    totalSeries: 0,
    processedSeries: 0,
    currentEpisode: null
  },
  stats: {
    totalSeries: 0,
    totalEpisodes: 0,
    newSeries: 0,
    updatedSeries: 0,
    enrichedSeries: 0,
    newEpisodes: 0,
    enrichedEpisodes: 0
  },
  error: null,
  completedAt: null
}

/** Retourne une copie shallow de l'état actuel (pour les réponses HTTP) */
export function getScanState(): ScanState {
  return { ...scanState }
}

/** Retourne la référence mutable à l'état (pour le scanner) */
export function getScanStateRef(): ScanState {
  return scanState
}

/** Réinitialise l'état pour un nouveau scan */
export function resetScanState(): void {
  scanState.isRunning = true
  scanState.startedAt = new Date().toISOString()
  scanState.currentSeries = null
  scanState.progress = { totalSeries: 0, processedSeries: 0, currentEpisode: null }
  scanState.stats = {
    totalSeries: 0, totalEpisodes: 0, newSeries: 0,
    updatedSeries: 0, enrichedSeries: 0, newEpisodes: 0, enrichedEpisodes: 0
  }
  scanState.error = null
  scanState.completedAt = null
}

/** Marque le scan comme terminé avec succès */
export function completeScan(): void {
  scanState.isRunning = false
  scanState.currentSeries = null
  scanState.completedAt = new Date().toISOString()
}

/** Marque le scan comme terminé avec erreur */
export function failScan(errorMessage: string): void {
  scanState.error = errorMessage
  scanState.isRunning = false
  scanState.completedAt = new Date().toISOString()
}
