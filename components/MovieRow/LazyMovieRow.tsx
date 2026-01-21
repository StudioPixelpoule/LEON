/**
 * LazyMovieRow - Version lazy-loaded de MovieRow
 * Ne rend le contenu que quand le composant entre dans le viewport
 */

'use client'

import { useLazyLoad } from '@/lib/hooks/useLazyLoad'
import MovieRow from './MovieRow'
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

type LazyMovieRowProps<T extends MovieRowItem> = {
  title: string
  movies: T[]
  onMovieClick: (movie: T) => void
}

export default function LazyMovieRow<T extends MovieRowItem>({ 
  title, 
  movies, 
  onMovieClick 
}: LazyMovieRowProps<T>) {
  const { ref, isVisible } = useLazyLoad<HTMLDivElement>({
    rootMargin: '200px', // Précharger 200px avant d'entrer dans le viewport
    triggerOnce: true
  })

  return (
    <div ref={ref} className={styles.lazyContainer}>
      {isVisible ? (
        <MovieRow title={title} movies={movies} onMovieClick={onMovieClick} />
      ) : (
        // Placeholder avec la hauteur approximative d'une row
        <div className={styles.rowPlaceholder}>
          <h3 className={styles.rowTitle}>{title}</h3>
          <div className={styles.placeholderCards}>
            {/* Afficher des placeholders pour les cartes */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.placeholderCard} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
