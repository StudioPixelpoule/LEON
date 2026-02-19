'use client'

import { useState, useEffect, useRef } from 'react'
import { useAdminToast } from '@/components/admin/Toast/Toast'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MediaItem {
  id: string
  title: string
  year?: number
  poster_url?: string
  filepath?: string
  type: 'movie' | 'series'
  episode_count?: number
  tmdb_id?: number
  overview?: string
  trailer_url?: string
}

export interface UseLibrarySearchReturn {
  searchQuery: string
  setSearchQuery: (query: string) => void
  mediaType: 'all' | 'movie' | 'series'
  setMediaType: (type: 'all' | 'movie' | 'series') => void
  results: MediaItem[]
  setResults: React.Dispatch<React.SetStateAction<MediaItem[]>>
  loading: boolean
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useLibrarySearch(): UseLibrarySearchReturn {
  const [searchQuery, setSearchQuery] = useState('')
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'series'>('all')
  const [results, setResults] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)

  const { addToast } = useAdminToast()
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.length < 2) {
      setResults([])
      return
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(searchQuery, mediaType)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, mediaType])

  async function performSearch(query: string, type: 'all' | 'movie' | 'series') {
    setLoading(true)
    try {
      const params = new URLSearchParams({ q: query })
      if (type !== 'all') params.set('type', type)

      const response = await fetch(`/api/admin/library-search?${params}`)
      const data = await response.json()

      if (data.success && data.results) {
        const items: MediaItem[] = []

        if (data.results.movies) {
          items.push(...data.results.movies.map((m: Record<string, unknown>) => ({
            id: m.id as string,
            title: m.title as string,
            year: m.year as number | undefined,
            poster_url: m.poster_url as string | undefined,
            filepath: m.pcloud_fileid as string | undefined,
            type: 'movie' as const
          })))
        }

        if (data.results.series) {
          items.push(...data.results.series.map((s: Record<string, unknown>) => ({
            id: s.id as string,
            title: s.title as string,
            year: s.year as number | undefined,
            poster_url: s.poster_url as string | undefined,
            type: 'series' as const,
            episode_count: s.episode_count as number | undefined
          })))
        }

        setResults(items)
      }
    } catch (error) {
      console.error('[LIBRARY] Erreur recherche:', error)
      addToast('error', 'Erreur', 'Recherche échouée')
    } finally {
      setLoading(false)
    }
  }

  return {
    searchQuery,
    setSearchQuery,
    mediaType,
    setMediaType,
    results,
    setResults,
    loading
  }
}
