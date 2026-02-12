/**
 * Hook pour gérer la progression de visionnage des épisodes
 * Charge les positions en batch et calcule le prochain épisode à regarder
 */

import { useState, useCallback } from 'react'
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
}

/**
 * Gère la progression de visionnage des épisodes d'une série.
 * Charge les positions en batch et identifie le prochain épisode.
 * 
 * @param userId - ID de l'utilisateur connecté (optionnel)
 */
export function useEpisodeProgress(userId?: string): UseEpisodeProgressResult {
  const [episodeProgress, setEpisodeProgress] = useState<Map<string, EpisodeProgress>>(new Map())
  const [nextToWatch, setNextToWatch] = useState<Episode | null>(null)

  // Charger la progression de visionnage en batch
  const loadProgress = useCallback(async (episodes: Episode[]) => {
    try {
      const progressMap = new Map<string, EpisodeProgress>()

      const episodeIds = episodes.map(ep => ep.id)

      if (episodeIds.length === 0) {
        setEpisodeProgress(progressMap)
        return
      }

      // Faire un seul appel batch au lieu de N appels individuels
      try {
        const url = userId
          ? `/api/playback-position/batch?mediaIds=${episodeIds.join(',')}&userId=${userId}`
          : `/api/playback-position/batch?mediaIds=${episodeIds.join(',')}`

        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()

          // L'API retourne { success: true, positions: { [mediaId]: { currentTime, duration, updatedAt } } }
          if (data.success && data.positions) {
            for (const [mediaId, pos] of Object.entries(data.positions)) {
              const position = pos as { currentTime: number; duration: number | null; updatedAt: string }

              if (position.currentTime && position.currentTime > 0) {
                const episode = episodes.find(ep => ep.id === mediaId)
                const duration = position.duration || (episode?.runtime ? episode.runtime * 60 : 45 * 60)
                const completed = duration > 0 && position.currentTime >= duration * 0.95

                progressMap.set(mediaId, {
                  episodeId: mediaId,
                  position: position.currentTime,
                  duration,
                  completed,
                })
              }
            }
          }
        }
      } catch (e) {
        console.error('[SERIES_MODAL] Erreur batch positions:', e)
      }

      setEpisodeProgress(progressMap)

      // Trouver le prochain épisode à regarder
      const allEpisodes = [...episodes].sort((a, b) => {
        if (a.season_number !== b.season_number) return a.season_number - b.season_number
        return a.episode_number - b.episode_number
      })

      let found = false
      for (const ep of allEpisodes) {
        const progress = progressMap.get(ep.id)
        if (!progress || !progress.completed) {
          setNextToWatch(ep)
          found = true
          break
        }
      }
      if (!found) {
        setNextToWatch(null)
      }
    } catch (error) {
      console.error('[SERIES_MODAL] Erreur chargement progression:', error)
    }
  }, [userId])

  // Calculer le pourcentage de progression d'un épisode
  const getEpisodeProgressPercent = useCallback((episodeId: string): number => {
    const progress = episodeProgress.get(episodeId)
    if (!progress || progress.duration === 0) return 0
    if (progress.completed) return 100
    return Math.min(100, (progress.position / progress.duration) * 100)
  }, [episodeProgress])

  // Vérifier si un épisode est complété
  const isEpisodeCompleted = useCallback((episodeId: string): boolean => {
    const progress = episodeProgress.get(episodeId)
    return progress?.completed || false
  }, [episodeProgress])

  // Formater le temps restant
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
  }
}
