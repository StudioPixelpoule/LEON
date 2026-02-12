'use client'

import { useState } from 'react'
import { useSeriesScanProgress } from './useSeriesScanProgress'
import type { SeriesScanProgress, SeriesScanResult } from './useSeriesScanProgress'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FilmScanResult {
  stats?: {
    total?: number
    new?: number
    updated?: number
  }
}

export interface CleanupResult {
  result?: {
    checked?: number
    missing?: number
    deleted?: number
    details?: Array<{ title: string }>
  }
}

// Ré-export pour usage par les composants
export type { SeriesScanProgress, SeriesScanResult }

interface UseMediaScanReturn {
  // Films
  scanningFilms: boolean
  filmResult: FilmScanResult | null
  handleScanFilms: () => Promise<void>
  // Séries
  scanningSeries: boolean
  seriesResult: SeriesScanResult | null
  seriesScanProgress: SeriesScanProgress | null
  handleScanSeries: () => Promise<void>
  // Nettoyage
  cleaningUp: boolean
  cleanupResult: CleanupResult | null
  handleCleanup: () => Promise<void>
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Gère les opérations de scan média : films, séries et nettoyage.
 * Orchestre les appels API et le suivi de progression.
 */
export function useMediaScan(): UseMediaScanReturn {
  const [scanningFilms, setScanningFilms] = useState(false)
  const [scanningSeries, setScanningSeries] = useState(false)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [filmResult, setFilmResult] = useState<FilmScanResult | null>(null)
  const [seriesResult, setSeriesResult] = useState<SeriesScanResult | null>(null)
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null)

  const { seriesScanProgress, startPolling } = useSeriesScanProgress()

  async function handleScanFilms() {
    setScanningFilms(true)
    setFilmResult(null)
    try {
      const response = await fetch('/api/scan', { method: 'POST', credentials: 'include' })
      const data = await response.json()
      setFilmResult(data)
    } catch (error) {
      console.error('[SCAN] Erreur scan films:', error)
      alert('Erreur lors du scan des films')
    } finally {
      setScanningFilms(false)
    }
  }

  async function handleScanSeries() {
    setScanningSeries(true)
    setSeriesResult(null)

    try {
      // Lancer le scan en mode background pour éviter le timeout Cloudflare
      const response = await fetch('/api/scan-series?background=true', {
        method: 'POST',
        credentials: 'include'
      })
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors du lancement du scan')
      }

      // Polling pour suivre la progression
      startPolling({
        onComplete: (result, error) => {
          if (error) {
            alert(`Erreur: ${error}`)
          } else if (result) {
            setSeriesResult(result)
          }
        },
        onScanEnd: () => {
          setScanningSeries(false)
        }
      })
    } catch (error) {
      console.error('[SCAN] Erreur scan séries:', error)
      alert('Erreur lors du scan des séries')
      setScanningSeries(false)
    }
  }

  async function handleCleanup() {
    if (!confirm('Supprimer les médias dont le fichier n\'existe plus sur le disque ?')) return

    setCleaningUp(true)
    setCleanupResult(null)
    try {
      const response = await fetch('/api/admin/cleanup-missing', {
        method: 'POST',
        credentials: 'include'
      })
      const data = await response.json()
      setCleanupResult(data)
    } catch (error) {
      console.error('[SCAN] Erreur nettoyage:', error)
      alert('Erreur lors du nettoyage')
    } finally {
      setCleaningUp(false)
    }
  }

  return {
    scanningFilms,
    filmResult,
    handleScanFilms,
    scanningSeries,
    seriesResult,
    seriesScanProgress,
    handleScanSeries,
    cleaningUp,
    cleanupResult,
    handleCleanup
  }
}
