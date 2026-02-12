'use client'

import { useState, useRef, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SeriesScanProgress {
  currentSeries: string | null
  processedSeries: number
  totalSeries: number
}

export interface SeriesScanResult {
  stats?: {
    totalSeries?: number
    newSeries?: number
    totalEpisodes?: number
    newEpisodes?: number
    enrichedEpisodes?: number
  }
}

interface PollingCallbacks {
  onComplete: (result: SeriesScanResult | null, error?: string) => void
  onScanEnd: () => void
}

interface UseSeriesScanProgressReturn {
  seriesScanProgress: SeriesScanProgress | null
  startPolling: (callbacks: PollingCallbacks) => void
  stopPolling: () => void
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Gère le polling de progression du scan des séries.
 * Interroge l'API toutes les 2 secondes pour mettre à jour la progression.
 */
export function useSeriesScanProgress(): UseSeriesScanProgressReturn {
  const [seriesScanProgress, setSeriesScanProgress] = useState<SeriesScanProgress | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    setSeriesScanProgress(null)
  }, [])

  const startPolling = useCallback((callbacks: PollingCallbacks) => {
    // Nettoyer un éventuel polling précédent
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusResponse = await fetch('/api/scan-series')
        const statusData = await statusResponse.json()

        if (statusData.scan) {
          // Mettre à jour la progression
          setSeriesScanProgress({
            currentSeries: statusData.scan.currentSeries,
            processedSeries: statusData.scan.progress?.processedSeries || 0,
            totalSeries: statusData.scan.progress?.totalSeries || 0
          })

          // Si le scan est terminé
          if (!statusData.scan.isRunning) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
              pollIntervalRef.current = null
            }
            setSeriesScanProgress(null)
            callbacks.onScanEnd()

            if (statusData.scan.error) {
              callbacks.onComplete(null, statusData.scan.error)
            } else {
              callbacks.onComplete({ stats: statusData.scan.stats })
            }
          }
        }
      } catch (pollError) {
        console.error('[SCAN] Erreur polling:', pollError)
      }
    }, 2000) // Poll toutes les 2 secondes
  }, [])

  return { seriesScanProgress, startPolling, stopPolling }
}
