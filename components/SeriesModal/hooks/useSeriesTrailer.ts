/**
 * Hook pour charger et gérer le trailer YouTube d'une série
 * Priorité : trailer stocké en BDD > fallback API TMDB
 */

import { useState, useEffect, useRef } from 'react'
import type { TrailerPlayerRef } from '@/components/TrailerPlayer/TrailerPlayer'
import { extractYoutubeId } from '@/lib/youtube'

interface SeriesTrailerInput {
  id: string
  title: string
  tmdb_id?: number | null
  trailer_url?: string | null
}

interface UseSeriesTrailerResult {
  trailerKey: string | null
  trailerEnded: boolean
  trailerMuted: boolean
  trailerRef: React.RefObject<TrailerPlayerRef>
  setTrailerEnded: (ended: boolean) => void
  setTrailerMuted: (muted: boolean) => void
}

/**
 * Charge le trailer YouTube d'une série.
 * Utilise d'abord l'URL stockée en BDD, puis fallback sur l'API TMDB.
 * 
 * @param series - Informations de la série (id, tmdb_id, trailer_url)
 */
export function useSeriesTrailer(series: SeriesTrailerInput): UseSeriesTrailerResult {
  const [trailerKey, setTrailerKey] = useState<string | null>(null)
  const [trailerEnded, setTrailerEnded] = useState(false)
  const [trailerMuted, setTrailerMuted] = useState(true)
  const trailerRef = useRef<TrailerPlayerRef>(null)

  useEffect(() => {
    async function loadTrailer() {
      if (series.trailer_url) {
        const key = extractYoutubeId(series.trailer_url)
        if (key) {
          setTrailerKey(key)
          return
        }
      }

      // 2. Fallback: appel API TMDB si pas de trailer stocké
      const tmdbId = series.tmdb_id
      if (!tmdbId) {
        setTrailerKey(null)
        return
      }

      try {
        const response = await fetch(`/api/trailer?tmdb_id=${tmdbId}&type=tv`)
        const result = await response.json()

        if (result.success && result.trailer?.key) {
          console.log(`[SERIES_MODAL] 🎬 Trailer API pour ${series.title}: ${result.trailer.key}`)
          setTrailerKey(result.trailer.key)
        } else {
          setTrailerKey(null)
        }
      } catch (error) {
        console.error('[SERIES_MODAL] Erreur chargement trailer:', error)
        setTrailerKey(null)
      }
    }

    loadTrailer()
    setTrailerEnded(false) // Reset quand la série change
  }, [series.id, series.tmdb_id, series.title, series.trailer_url])

  return {
    trailerKey,
    trailerEnded,
    trailerMuted,
    trailerRef,
    setTrailerEnded,
    setTrailerMuted,
  }
}
