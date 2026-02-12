/**
 * Hook pour charger les détails d'une série depuis l'API
 * Gère le fetch, le loading state et la sélection de saison
 */

import { useState, useEffect, useCallback } from 'react'

export interface Episode {
  id: string
  season_number: number
  episode_number: number
  title: string
  overview: string
  still_url: string | null
  filepath: string
  air_date: string
  rating: number
  runtime?: number
}

export interface Season {
  season: number
  episodes: Episode[]
}

export interface SeriesDetails {
  id: string
  title: string
  overview: string
  poster_url: string | null
  backdrop_url: string | null
  trailer_url: string | null
  rating: number
  first_air_date: string
  seasons: Season[]
  genres: string[]
}

interface UseSeriesDetailsResult {
  seriesDetails: SeriesDetails | null
  loading: boolean
  selectedSeason: number
  setSelectedSeason: (season: number) => void
  currentSeasonData: Season | undefined
  totalEpisodes: number
  year: number | null
  allEpisodes: Episode[]
}

/**
 * Charge les détails d'une série et gère la sélection de saison.
 * 
 * @param seriesId - ID de la série à charger
 * @param onEpisodesLoaded - Callback appelé quand les épisodes sont chargés
 */
export function useSeriesDetails(
  seriesId: string,
  onEpisodesLoaded?: (episodes: Episode[]) => void
): UseSeriesDetailsResult {
  const [seriesDetails, setSeriesDetails] = useState<SeriesDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSeason, setSelectedSeason] = useState(1)

  const loadSeriesDetails = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/series/${seriesId}`)
      const data = await response.json()

      if (data.success) {
        setSeriesDetails(data.serie)
        // Sélectionner la première saison par défaut
        if (data.serie.seasons.length > 0) {
          setSelectedSeason(data.serie.seasons[0].season)

          // Notifier le parent avec tous les épisodes
          const allEps = data.serie.seasons.flatMap((s: Season) => s.episodes)
          onEpisodesLoaded?.(allEps)
        }
      }
    } catch (error) {
      console.error('[SERIES_MODAL] Erreur chargement détails série:', error)
    } finally {
      setLoading(false)
    }
  }, [seriesId, onEpisodesLoaded])

  useEffect(() => {
    loadSeriesDetails()
  }, [loadSeriesDetails])

  const currentSeasonData = seriesDetails?.seasons.find(s => s.season === selectedSeason)
  const totalEpisodes = seriesDetails?.seasons.reduce((acc, s) => acc + s.episodes.length, 0) ?? 0
  const year = seriesDetails?.first_air_date
    ? new Date(seriesDetails.first_air_date).getFullYear()
    : null
  const allEpisodes = seriesDetails?.seasons.flatMap(s => s.episodes) ?? []

  return {
    seriesDetails,
    loading,
    selectedSeason,
    setSelectedSeason,
    currentSeasonData,
    totalEpisodes,
    year,
    allEpisodes,
  }
}
