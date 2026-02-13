/**
 * Hook partagé : useContinueWatching
 * Gère le chargement et la suppression des médias en cours de visionnage.
 * Utilisé par ContinueWatchingRow et ma-liste/page.tsx.
 *
 * Fonctionnalités :
 * - Chargement depuis /api/media/in-progress
 * - Suppression optimiste avec rollback en cas d'erreur
 * - Filtrage par type (films, épisodes, tous)
 */

import { useState, useCallback, useRef } from 'react'
import type { GroupedMedia } from '@/app/api/media/grouped/route'

export interface MediaWithProgress extends GroupedMedia {
  position: number
  saved_duration: number | null
  progress_percent: number
  playback_updated_at: string
  content_type?: 'movie' | 'episode'
  subtitle?: string
  series_id?: string
  season_number?: number
  episode_number?: number
}

export type ContinueWatchingFilter = 'all' | 'movies' | 'episodes'

interface UseContinueWatchingOptions {
  userId: string | null | undefined
  filter?: ContinueWatchingFilter
}

interface UseContinueWatchingReturn {
  media: MediaWithProgress[]
  loading: boolean
  /** Charger/rafraîchir les données. `silent` = pas de loading state. */
  refresh: (silent?: boolean) => Promise<void>
  /** Supprimer un élément (optimiste avec rollback) */
  remove: (mediaId: string) => Promise<void>
}

export function useContinueWatching({
  userId,
  filter = 'all'
}: UseContinueWatchingOptions): UseContinueWatchingReturn {
  const [media, setMedia] = useState<MediaWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const deletedIdsRef = useRef<Set<string>>(new Set())
  const isMountedRef = useRef(true)

  // Garder isMounted à jour
  // (le composant parent doit appeler refresh dans un useEffect pour déclencher le chargement)

  const applyFilter = useCallback((items: MediaWithProgress[]): MediaWithProgress[] => {
    let filtered = items
    if (filter === 'movies') {
      filtered = items.filter(m => m.content_type !== 'episode')
    } else if (filter === 'episodes') {
      filtered = items.filter(m => m.content_type === 'episode')
    }

    // Exclure les éléments supprimés localement
    if (deletedIdsRef.current.size > 0) {
      filtered = filtered.filter(m => !deletedIdsRef.current.has(m.id))
    }

    return filtered
  }, [filter])

  const refresh = useCallback(async (silent = false) => {
    if (!userId) return

    try {
      if (!silent) setLoading(true)
      const response = await fetch(`/api/media/in-progress?userId=${encodeURIComponent(userId)}`)

      if (!response.ok) {
        console.error(`[CONTINUE] Erreur API: ${response.status}`)
        return
      }

      const data = await response.json()

      if (data.success) {
        const allItems = data.media as MediaWithProgress[]
        setMedia(applyFilter(allItems))

        // Nettoyer les IDs supprimés qui ont bien été pris en compte côté serveur
        if (deletedIdsRef.current.size > 0) {
          const serverIds = new Set(allItems.map(m => m.id))
          for (const deletedId of deletedIdsRef.current) {
            if (!serverIds.has(deletedId)) {
              deletedIdsRef.current.delete(deletedId)
            }
          }
        }
      }
    } catch (error) {
      console.error('[CONTINUE] Erreur chargement:', error)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [userId, applyFilter])

  const remove = useCallback(async (mediaId: string) => {
    if (!userId) return

    // Suppression optimiste
    deletedIdsRef.current.add(mediaId)
    setMedia(prev => prev.filter(m => m.id !== mediaId))

    try {
      const params = new URLSearchParams({ mediaId, userId })
      const response = await fetch(`/api/playback-position?${params.toString()}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        console.error(`[CONTINUE] Erreur suppression: ${response.status}`)
        // Rollback
        deletedIdsRef.current.delete(mediaId)
        refresh(true)
      }
    } catch (error) {
      console.error('[CONTINUE] Erreur réseau suppression:', error)
      // Rollback
      deletedIdsRef.current.delete(mediaId)
      refresh(true)
    }
  }, [userId, refresh])

  return { media, loading, refresh, remove }
}
