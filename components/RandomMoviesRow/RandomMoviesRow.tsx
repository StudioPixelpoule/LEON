/**
 * Composant: RandomMoviesRow
 * Affiche 10 films aléatoires à découvrir
 */

'use client'

import { useState, useEffect } from 'react'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import styles from './RandomMoviesRow.module.css'

interface RandomMoviesRowProps {
  movies: GroupedMedia[]
  onMovieClick: (movie: GroupedMedia) => void
}

export default function RandomMoviesRow({ movies, onMovieClick }: RandomMoviesRowProps) {
  const [randomMovies, setRandomMovies] = useState<GroupedMedia[]>([])

  useEffect(() => {
    // Sélectionner 10 films aléatoires
    const shuffled = [...movies].sort(() => Math.random() - 0.5)
    setRandomMovies(shuffled.slice(0, 10))
  }, [movies])

  if (randomMovies.length === 0) {
    return null
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>À découvrir</h2>
      
      <div className={styles.row}>
        {randomMovies.map((movie) => (
          <div
            key={movie.id}
            className={styles.card}
            onClick={() => onMovieClick(movie)}
          >
            <div className={styles.posterWrapper}>
              <img
                src={movie.poster || '/placeholder-poster.png'}
                alt={movie.title}
                className={styles.poster}
              />
            </div>

            <div className={styles.info}>
              <h3 className={styles.movieTitle}>{movie.title}</h3>
              {movie.year && (
                <p className={styles.year}>{movie.year}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

