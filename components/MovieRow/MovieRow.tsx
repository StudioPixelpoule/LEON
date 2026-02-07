/**
 * MovieRow - Rangée horizontale scrollable de films (style Netflix)
 * Avec navigation par flèches élégantes
 */

'use client'

import { useState, useRef, useEffect, useCallback, memo } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './MovieRow.module.css'

// Type minimal pour les films affichés dans une row
interface MovieRowItem {
  id: string
  title: string
  poster_url: string | null
  year?: number | null
  rating?: number | null
  genres?: string[] | null
  formatted_runtime?: string | null
}

type MovieRowProps<T extends MovieRowItem> = {
  title: string
  movies: T[]
  onMovieClick: (movie: T) => void
}

function MovieRowComponent<T extends MovieRowItem>({ title, movies, onMovieClick }: MovieRowProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Vérifie si on peut scroller dans chaque direction
  const checkScrollability = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    
    setCanScrollLeft(el.scrollLeft > 20)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 20)
  }, [])

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
  }, [checkScrollability, movies])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    
    // Scroll d'environ 3-4 cartes
    const scrollAmount = el.clientWidth * 0.75
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }

  if (movies.length === 0) return null
  
  return (
    <section className={styles.row}>
      <h2 className={styles.title}>{title}</h2>
      
      {/* Conteneur avec flèches */}
      <div className={styles.scrollContainer}>
        {/* Flèche gauche */}
        <button
          className={`${styles.navArrow} ${styles.navLeft} ${canScrollLeft ? styles.visible : ''}`}
          onClick={() => scroll('left')}
          aria-label="Précédent"
        >
          <ChevronLeft size={32} strokeWidth={2.5} />
        </button>

        <div className={styles.scroll} ref={scrollRef}>
          {movies.map((movie) => (
            <div
              key={movie.id}
              className={styles.card}
              onClick={() => onMovieClick(movie)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onMovieClick(movie)
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Lire ${movie.title}`}
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

        {/* Flèche droite */}
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

export default memo(MovieRowComponent) as typeof MovieRowComponent

