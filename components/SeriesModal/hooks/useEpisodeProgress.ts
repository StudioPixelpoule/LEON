/**
 * Hook pour gérer la progression de visionnage des épisodes
 * Charge les positions en batch (avec support > 50 épisodes)
 * Cache local pour éviter de recharger les positions déjà connues
 * Gestion d'erreur robuste (ne crash pas silencieusement)
 */

import { useState, useCallback, useRef } from 'react'
import type { Episode } from './useSeriesDetails'

export interface EpisodeProgress {
  episodeId: string
  position: number
  duration: number
  completed: boolean
}

interface UseEpisodeProgressResult {
  episodeProgress: Map<string, EpisodeProgress>
  nextToWatch: Episode | null
  loadProgress: (episodes: Episode[]) => Promise<void>
  getEpisodeProgressPercent: (episodeId: string) => number
  isEpisodeCompleted: (episodeId: string) => boolean
  formatTimeRemaining: (episodeId: string, runtime?: number) => string
  /** Vider le cache (utile après un changement de saison ou de série) */
  clearCache: () => void
  /** Indique si le chargement a rencontré une erreur */
  hasError: boolean
}

const BATCH_SIZE = 50 // Limite de l'API batch

/**
 * Découpe un tableau en chunks de taille donnée
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Gère la progression de visionnage des épisodes d'une série.
 * Charge les positions en batch, avec support pour > 50 épisodes.
 * Cache local pour éviter les appels API redondants.
 */
export function useEpisodeProgress(userId?: string): UseEpisodeProgressResult {
  const [episodeProgress, setEpisodeProgress] = useState<Map<string, EpisodeProgress>>(new Map())
  const [nextToWatch, setNextToWatch] = useState<Episode | null>(null)
  const [hasError, setHasError] = useState(false)

  // Cache local : stocke les progressions déjà chargées pour éviter les re-fetches
  const cacheRef = useRef<Map<string, EpisodeProgress>>(new Map())
  // IDs déjà chargés (même ceux sans progression)
  const loadedIdsRef = useRef<Set<string>>(new Set())

  const clearCache = useCallback(() => {
    cacheRef.current.clear()
    loadedIdsRef.current.clear()
  }, [])

  const loadProgress = useCallback(async (episodes: Episode[]) => {
    setHasError(false)

    try {
      const allEpisodeIds = episodes.map(ep => ep.id)

      if (allEpisodeIds.length === 0) {
        setEpisodeProgress(new Map())
        setNextToWatch(null)
        return
      }

      // Déterminer quels IDs doivent être chargés (pas encore en cache)
      const idsToFetch = allEpisodeIds.filter(id => !loadedIdsRef.current.has(id))

      // Construire la map à partir du cache existant
      const progressMap = new Map<string, EpisodeProgress>()
      for (const id of allEpisodeIds) {
        const cached = cacheRef.current.get(id)
        if (cached) {
          progressMap.set(id, cached)
        }
      }

      // Charger les IDs manquants en chunks de 50
      if (idsToFetch.length > 0) {
        const chunks = chunkArray(idsToFetch, BATCH_SIZE)

        // Exécuter tous les chunks en parallèle
        const results = await Promise.allSettled(
          chunks.map(async (chunk) => {
            const url = userId
              ? `/api/playback-position/batch?mediaIds=${chunk.join(',')}&userId=${userId}`
              : `/api/playback-position/batch?mediaIds=${chunk.join(',')}`

            const response = await fetch(url)
            if (!response.ok) {
              throw new Error(`Erreur API batch: ${response.status}`)
            }
            return response.json()
          })
        )

        let anyError = false

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value?.success && result.value.positions) {
            for (const [mediaId, pos] of Object.entries(result.value.positions)) {
              const position = pos as { currentTime: number; duration: number | null; updatedAt: string }

              if (position.currentTime && position.currentTime > 0) {
                const episode = episodes.find(ep => ep.id === mediaId)
                const duration = position.duration || (episode?.runtime ? episode.runtime * 60 : 45 * 60)
                const completed = duration > 0 && position.currentTime >= duration * 0.95

                const progress: EpisodeProgress = {
                  episodeId: mediaId,
                  position: position.currentTime,
                  duration,
                  completed,
                }

                progressMap.set(mediaId, progress)
                cacheRef.current.set(mediaId, progress)
              }
            }
          } else if (result.status === 'rejected') {
            console.error('[EPISODE_PROGRESS] Erreur batch chunk:', result.reason)
            anyError = true
          }
        }

        // Marquer tous les IDs comme chargés (même ceux sans progression)
        for (const id of idsToFetch) {
          loadedIdsRef.current.add(id)
        }

        if (anyError) setHasError(true)
      }

      setEpisodeProgress(progressMap)

      // Trouver le prochain épisode à regarder
      const sortedEpisodes = [...episodes].sort((a, b) => {
        if (a.season_number !== b.season_number) return a.season_number - b.season_number
        return a.episode_number - b.episode_number
      })

      let foundNext = false
      for (const ep of sortedEpisodes) {
        const progress = progressMap.get(ep.id)
        if (!progress || !progress.completed) {
          setNextToWatch(ep)
          foundNext = true
          break
        }
      }
      if (!foundNext) {
        setNextToWatch(null)
      }
    } catch (error) {
      console.error('[EPISODE_PROGRESS] Erreur chargement progression:', error)
      setHasError(true)
    }
  }, [userId])

  const getEpisodeProgressPercent = useCallback((episodeId: string): number => {
    const progress = episodeProgress.get(episodeId)
    if (!progress || progress.duration === 0) return 0
    if (progress.completed) return 100
    return Math.min(100, (progress.position / progress.duration) * 100)
  }, [episodeProgress])

  const isEpisodeCompleted = useCallback((episodeId: string): boolean => {
    const progress = episodeProgress.get(episodeId)
    return progress?.completed || false
  }, [episodeProgress])

  const formatTimeRemaining = useCallback((episodeId: string, runtime?: number): string => {
    const progress = episodeProgress.get(episodeId)
    if (!progress) return runtime ? `${runtime} min` : ''

    const remaining = Math.max(0, progress.duration - progress.position)
    const minutes = Math.ceil(remaining / 60)

    if (progress.position > 0 && !progress.completed) {
      return `${minutes} min restantes`
    }
    return runtime ? `${runtime} min` : ''
  }, [episodeProgress])

  return {
    episodeProgress,
    nextToWatch,
    loadProgress,
    getEpisodeProgressPercent,
    isEpisodeCompleted,
    formatTimeRemaining,
    clearCache,
    hasError,
  }
}
