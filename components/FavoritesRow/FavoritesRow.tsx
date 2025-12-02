/**
 * FavoritesRow - Carrousel "Ma liste" des films favoris
 * Style identique aux autres carrousels pour harmonie visuelle
 */

'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import styles from './FavoritesRow.module.css'

interface FavoritesRowProps {
  onMovieClick: (movie: GroupedMedia) => void
  refreshKey?: number
}

export default function FavoritesRow({ onMovieClick, refreshKey = 0 }: FavoritesRowProps) {
  const [favorites, setFavorites] = useState<GroupedMedia[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const response = await fetch('/api/favorites?type=movie')
        
        if (response.ok) {
          const data = await response.json()
          setFavorites(data.favorites || [])
        }
      } catch (error) {
        console.error('[FAVORITES] Erreur chargement:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFavorites()
  }, [refreshKey])

  // Ne rien afficher si pas de favoris ou en chargement initial
  if (loading || favorites.length === 0) {
    return null
  }

  return (
    <section className={styles.row}>
      <h2 className={styles.title}>Ma liste</h2>
      <div className={styles.scroll}>
        {favorites.map((movie) => (
          <div
            key={movie.id}
            className={styles.card}
            onClick={() => onMovieClick(movie)}
          >
            <Image
              src={movie.poster_url || '/placeholder-poster.svg'}
              alt={movie.title}
              width={240}
              height={360}
              className={styles.poster}
              unoptimized
            />
            <div className={styles.cardHover}>
              <h3 className={styles.cardTitle}>{movie.title}</h3>
              <div className={styles.cardMeta}>
                {movie.year && <span>{movie.year}</span>}
                {movie.formatted_runtime && (
                  <>
                    <span>·</span>
                    <span>{movie.formatted_runtime}</span>
                  </>
                )}
              </div>
              {movie.rating && movie.rating > 0 && (
                <div className={styles.cardRating}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                  </svg>
                  <span>{movie.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
