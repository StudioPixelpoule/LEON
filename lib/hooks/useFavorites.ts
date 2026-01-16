/**
 * Hook React pour gérer les favoris
 * Permet d'ajouter/supprimer des favoris et de vérifier le statut
 * Gère les favoris par utilisateur connecté
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface UseFavoritesOptions {
  mediaId: string
  mediaType?: 'movie' | 'series'
}

export function useFavorites({ mediaId, mediaType = 'movie' }: UseFavoritesOptions) {
  const { user } = useAuth()
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
        let url = `/api/favorites/check?mediaId=${encodeURIComponent(mediaId)}&mediaType=${mediaType}`
        if (user?.id) {
          url += `&userId=${encodeURIComponent(user.id)}`
        }
        
        const response = await fetch(url)
        
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
  }, [mediaId, mediaType, user?.id])

  // Toggle favori
  const toggleFavorite = useCallback(async () => {
    if (!mediaId) return

    setLoading(true)

    try {
      if (isFavorite) {
        // Supprimer des favoris
        let url = `/api/favorites?mediaId=${encodeURIComponent(mediaId)}&mediaType=${mediaType}`
        if (user?.id) {
          url += `&userId=${encodeURIComponent(user.id)}`
        }
        
        const response = await fetch(url, { method: 'DELETE' })
        
        if (response.ok) {
          setIsFavorite(false)
          console.log('[FAVORITES] 💔 Retiré des favoris')
        }
      } else {
        // Ajouter aux favoris
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            mediaId, 
            mediaType,
            userId: user?.id || null
          })
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
  }, [mediaId, mediaType, isFavorite, user?.id])

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
  const { user } = useAuth()
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
        let url = `/api/favorites?type=${mediaType}`
        if (user?.id) {
          url += `&userId=${encodeURIComponent(user.id)}`
        }
        
        const response = await fetch(url)
        
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
  }, [mediaType, refreshKey, user?.id])

  return {
    favorites,
    loading,
    refresh
  }
}
