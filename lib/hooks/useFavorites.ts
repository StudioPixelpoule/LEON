/**
 * Hook React pour gérer les favoris
 * Permet d'ajouter/supprimer des favoris et de vérifier le statut
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

interface UseFavoritesOptions {
  mediaId: string
  mediaType?: 'movie' | 'series'
}

export function useFavorites({ mediaId, mediaType = 'movie' }: UseFavoritesOptions) {
  const [isFavorite, setIsFavorite] = useState(false)
  const [loading, setLoading] = useState(true)

  // Vérifier si le média est en favori au montage
  useEffect(() => {
    if (!mediaId) {
      setLoading(false)
      return
    }

    const checkFavorite = async () => {
      try {
        const response = await fetch(
          `/api/favorites/check?mediaId=${encodeURIComponent(mediaId)}&mediaType=${mediaType}`
        )
        
        if (response.ok) {
          const data = await response.json()
          setIsFavorite(data.isFavorite)
        }
      } catch (error) {
        console.error('[FAVORITES] Erreur vérification:', error)
      } finally {
        setLoading(false)
      }
    }

    checkFavorite()
  }, [mediaId, mediaType])

  // Toggle favori
  const toggleFavorite = useCallback(async () => {
    if (!mediaId) return

    setLoading(true)

    try {
      if (isFavorite) {
        // Supprimer des favoris
        const response = await fetch(
          `/api/favorites?mediaId=${encodeURIComponent(mediaId)}&mediaType=${mediaType}`,
          { method: 'DELETE' }
        )
        
        if (response.ok) {
          setIsFavorite(false)
          console.log('[FAVORITES] 💔 Retiré des favoris')
        }
      } else {
        // Ajouter aux favoris
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaId, mediaType })
        })
        
        if (response.ok) {
          setIsFavorite(true)
          console.log('[FAVORITES] ❤️ Ajouté aux favoris')
        }
      }
    } catch (error) {
      console.error('[FAVORITES] Erreur toggle:', error)
    } finally {
      setLoading(false)
    }
  }, [mediaId, mediaType, isFavorite])

  return {
    isFavorite,
    loading,
    toggleFavorite
  }
}

/**
 * Hook pour récupérer la liste complète des favoris
 */
export function useFavoritesList(mediaType: 'movie' | 'series' = 'movie') {
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/favorites?type=${mediaType}`)
        
        if (response.ok) {
          const data = await response.json()
          setFavorites(data.favorites || [])
        }
      } catch (error) {
        console.error('[FAVORITES] Erreur chargement liste:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFavorites()
  }, [mediaType, refreshKey])

  return {
    favorites,
    loading,
    refresh
  }
}










