'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MediaToValidate {
  id: string
  title: string
  year?: number
  poster_url?: string
  tmdb_id?: number
  file_path: string
}

export interface SeriesData {
  id: string
  title: string
  poster_url?: string
  tmdb_id?: number
  first_air_date?: string
  seasons?: { season: number; episodeCount: number }[]
}

export type MediaTab = 'films' | 'series'
export type PosterFilter = 'all' | 'to-validate'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Vérifie si un média nécessite une validation d'affiche */
export function needsPosterValidation(item: { poster_url?: string; tmdb_id?: number }): boolean {
  return !item.poster_url || item.poster_url.includes('placeholder') || !item.tmdb_id
}

// ─── Return Type ─────────────────────────────────────────────────────────────

export interface UsePostersDataReturn {
  loading: boolean
  mediaTab: MediaTab
  setMediaTab: (tab: MediaTab) => void
  posterFilter: PosterFilter
  setPosterFilter: (filter: PosterFilter) => void
  searchFilter: string
  setSearchFilter: (value: string) => void
  allMovies: MediaToValidate[]
  filteredMovies: MediaToValidate[]
  allSeries: SeriesData[]
  filteredSeries: SeriesData[]
  toValidateMovies: number
  toValidateSeries: number
  loadMovies: (forceRefresh?: boolean) => Promise<void>
  loadSeries: (forceRefresh?: boolean) => Promise<void>
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePostersData(): UsePostersDataReturn {
  const [mediaTab, setMediaTab] = useState<MediaTab>('films')
  const [posterFilter, setPosterFilter] = useState<PosterFilter>('to-validate')
  const [searchFilter, setSearchFilter] = useState('')
  const [loading, setLoading] = useState(true)

  // Films
  const [allMovies, setAllMovies] = useState<MediaToValidate[]>([])
  const [filteredMovies, setFilteredMovies] = useState<MediaToValidate[]>([])

  // Séries
  const [allSeries, setAllSeries] = useState<SeriesData[]>([])
  const [filteredSeries, setFilteredSeries] = useState<SeriesData[]>([])

  const loadMovies = useCallback(async (forceRefresh = false) => {
    try {
      // Ajouter nocache=true pour forcer le rafraîchissement après mise à jour
      const url = forceRefresh
        ? '/api/media/grouped?type=movie&nocache=true'
        : '/api/media/grouped?type=movie'
      const response = await fetch(url)
      const data = await response.json()
      if (data.success) {
        setAllMovies(
          data.media.sort((a: MediaToValidate, b: MediaToValidate) =>
            a.title.localeCompare(b.title)
          )
        )
      }
    } catch (error) {
      console.error('[POSTERS] Erreur chargement films:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSeries = useCallback(async (forceRefresh = false) => {
    try {
      const url = forceRefresh
        ? '/api/series/list?nocache=true'
        : '/api/series/list'
      const response = await fetch(url)
      const data = await response.json()
      if (data.success) {
        setAllSeries(
          (data.series || []).sort((a: SeriesData, b: SeriesData) =>
            a.title.localeCompare(b.title)
          )
        )
      }
    } catch (error) {
      console.error('[POSTERS] Erreur chargement séries:', error)
    }
  }, [])

  // Chargement initial
  useEffect(() => {
    loadMovies()
    loadSeries()
  }, [loadMovies, loadSeries])

  // Filtrage films
  useEffect(() => {
    let movies = allMovies
    if (posterFilter === 'to-validate') {
      movies = movies.filter(needsPosterValidation)
    }
    if (searchFilter.trim()) {
      movies = movies.filter(m =>
        m.title.toLowerCase().includes(searchFilter.toLowerCase())
      )
    }
    setFilteredMovies(movies)
  }, [searchFilter, allMovies, posterFilter])

  // Filtrage séries
  useEffect(() => {
    let series = allSeries
    if (posterFilter === 'to-validate') {
      series = series.filter(needsPosterValidation)
    }
    if (searchFilter.trim()) {
      series = series.filter(s =>
        s.title.toLowerCase().includes(searchFilter.toLowerCase())
      )
    }
    setFilteredSeries(series)
  }, [searchFilter, allSeries, posterFilter])

  const toValidateMovies = allMovies.filter(needsPosterValidation).length
  const toValidateSeries = allSeries.filter(needsPosterValidation).length

  return {
    loading,
    mediaTab,
    setMediaTab,
    posterFilter,
    setPosterFilter,
    searchFilter,
    setSearchFilter,
    allMovies,
    filteredMovies,
    allSeries,
    filteredSeries,
    toValidateMovies,
    toValidateSeries,
    loadMovies,
    loadSeries,
  }
}
