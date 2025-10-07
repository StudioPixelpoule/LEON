/**
 * Carte de suggestion de film pour validation manuelle
 * Design minimaliste Pixel Poule
 */

'use client'

import Image from 'next/image'
import { getTMDBImageUrl } from '@/lib/tmdb'
import styles from './MediaValidator.module.css'

export interface MovieSuggestion {
  tmdbId: number
  title: string
  originalTitle?: string
  year: number
  posterPath: string | null
  overview: string
  confidence: number
}

interface SuggestionCardProps {
  movie: MovieSuggestion
  onSelect: () => void
}

export function SuggestionCard({ movie, onSelect }: SuggestionCardProps) {
  const posterUrl = movie.posterPath 
    ? getTMDBImageUrl(movie.posterPath, 'w342')
    : '/placeholder-poster.png'
  
  return (
    <div className={styles.suggestionCard} onClick={onSelect}>
      <div className={styles.suggestionPoster}>
        <Image
          src={posterUrl || '/placeholder-poster.png'}
          alt={movie.title}
          fill
          sizes="200px"
          className={styles.posterImage}
        />
        {movie.confidence >= 0 && (
          <div className={styles.confidenceBadge}>
            {Math.round(movie.confidence)}%
          </div>
        )}
      </div>
      
      <div className={styles.suggestionInfo}>
        <h4 className={styles.suggestionTitle}>{movie.title}</h4>
        {movie.originalTitle && movie.originalTitle !== movie.title && (
          <p className={styles.suggestionOriginal}>{movie.originalTitle}</p>
        )}
        <p className={styles.suggestionYear}>{movie.year}</p>
      </div>
    </div>
  )
}




