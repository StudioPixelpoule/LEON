'use client'

import { useState, useCallback } from 'react'
import { useAdminToast } from '@/components/admin/Toast/Toast'
import type { MediaToValidate, SeriesData } from './usePostersData'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TMDBResult {
  id: number
  title: string
  name?: string
  release_date: string
  first_air_date?: string
  poster_path: string
  overview: string
  vote_average: number
}

interface UsePosterUpdateDeps {
  loadMovies: (forceRefresh?: boolean) => Promise<void>
  loadSeries: (forceRefresh?: boolean) => Promise<void>
}

export interface UsePosterUpdateReturn {
  selectedMovie: MediaToValidate | null
  setSelectedMovie: (movie: MediaToValidate | null) => void
  selectedSeries: SeriesData | null
  setSelectedSeries: (series: SeriesData | null) => void
  suggestions: TMDBResult[]
  searchQuery: string
  setSearchQuery: (query: string) => void
  searching: boolean
  saving: boolean
  searchTMDB: (type: 'movie' | 'tv') => Promise<void>
  updatePoster: (tmdbId: number, type: 'movie' | 'series') => Promise<void>
  closeModal: () => void
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePosterUpdate({ loadMovies, loadSeries }: UsePosterUpdateDeps): UsePosterUpdateReturn {
  const { addToast } = useAdminToast()

  const [selectedMovie, setSelectedMovie] = useState<MediaToValidate | null>(null)
  const [selectedSeries, setSelectedSeries] = useState<SeriesData | null>(null)
  const [suggestions, setSuggestions] = useState<TMDBResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  const closeModal = useCallback(() => {
    setSelectedMovie(null)
    setSelectedSeries(null)
    setSuggestions([])
    setSearchQuery('')
  }, [])

  const searchTMDB = useCallback(async (type: 'movie' | 'tv') => {
    setSearching(true)
    try {
      const query = searchQuery || (type === 'movie' ? selectedMovie?.title : selectedSeries?.title)
      const response = await fetch(
        `/api/admin/search-tmdb?query=${encodeURIComponent(query || '')}&type=${type}`,
        { credentials: 'include' }
      )
      const data = await response.json()
      if (data.results) {
        setSuggestions(data.results.slice(0, 8))
      }
    } catch (error) {
      console.error('[POSTERS] Erreur recherche TMDB:', error)
    } finally {
      setSearching(false)
    }
  }, [searchQuery, selectedMovie?.title, selectedSeries?.title])

  const updatePoster = useCallback(async (tmdbId: number, type: 'movie' | 'series') => {
    setSaving(true)
    try {
      const mediaId = type === 'movie' ? selectedMovie?.id : selectedSeries?.id
      const body = {
        id: mediaId,
        type,
        tmdb_id: tmdbId,
        refreshFromTmdb: true,
      }

      const response = await fetch('/api/admin/update-media-info', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })

      if (response.ok) {
        // Recharger AVANT de fermer le modal pour garantir la mise à jour
        if (type === 'movie') await loadMovies(true)
        else await loadSeries(true)

        // Fermer le modal APRÈS le rechargement
        closeModal()

        addToast('success', 'Affiche mise à jour', 'Les métadonnées ont été synchronisées avec TMDB')
      } else {
        const data = await response.json()
        addToast('error', 'Erreur de mise à jour', data.error || 'Erreur inconnue')
      }
    } catch (error) {
      console.error('[POSTERS] Erreur mise à jour:', error)
      addToast('error', 'Erreur réseau', 'Impossible de communiquer avec le serveur')
    } finally {
      setSaving(false)
    }
  }, [selectedMovie?.id, selectedSeries?.id, loadMovies, loadSeries, closeModal, addToast])

  return {
    selectedMovie,
    setSelectedMovie,
    selectedSeries,
    setSelectedSeries,
    suggestions,
    searchQuery,
    setSearchQuery,
    searching,
    saving,
    searchTMDB,
    updatePoster,
    closeModal,
  }
}
