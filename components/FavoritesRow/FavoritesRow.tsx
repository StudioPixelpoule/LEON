/**
 * FavoritesRow - Carrousel "Ma liste" des films favoris
 * Style identique aux autres carrousels pour harmonie visuelle
 */

'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import styles from './FavoritesRow.module.css'

interface FavoritesRowProps {
  onMovieClick: (movie: GroupedMedia) => void
  refreshKey?: number
}

export default function FavoritesRow({ onMovieClick, refreshKey = 0 }: FavoritesRowProps) {
  const [favorites, setFavorites] = useState<GroupedMedia[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScrollability = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 20)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 20)
  }, [])

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

  useEffect(() => {
    checkScrollability()
    const el = scrollRef.current
    if (el) {
      el.addEventListener('scroll', checkScrollability)
      window.addEventListener('resize', checkScrollability)
    }
    return () => {
      if (el) {
        el.removeEventListener('scroll', checkScrollability)
        window.removeEventListener('resize', checkScrollability)
      }
    }
  }, [checkScrollability, favorites])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const scrollAmount = el.clientWidth * 0.75
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }

  // Ne rien afficher si pas de favoris ou en chargement initial
  if (loading || favorites.length === 0) {
    return null
  }

  return (
    <section className={styles.row}>
      <h2 className={styles.title}>Ma liste</h2>
      
      <div className={styles.scrollContainer}>
        <button
          className={`${styles.navArrow} ${styles.navLeft} ${canScrollLeft ? styles.visible : ''}`}
          onClick={() => scroll('left')}
          aria-label="Précédent"
        >
          <ChevronLeft size={32} strokeWidth={2.5} />
        </button>

        <div className={styles.scroll} ref={scrollRef}>
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

        <button
          className={`${styles.navArrow} ${styles.navRight} ${canScrollRight ? styles.visible : ''}`}
          onClick={() => scroll('right')}
          aria-label="Suivant"
        >
          <ChevronRight size={32} strokeWidth={2.5} />
        </button>
      </div>
    </section>
  )
}
