/**
 * MovieRow - Rangée horizontale scrollable de films (style Netflix)
 */

'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Media } from '@/lib/supabase'
import styles from './MovieRow.module.css'

type MovieRowProps = {
  title: string
  movies: Media[]
  onMovieClick: (movie: Media) => void
}

export default function MovieRow({ title, movies, onMovieClick }: MovieRowProps) {
  if (movies.length === 0) return null
  
  return (
    <section className={styles.row}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.scroll}>
        {movies.map((movie) => (
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
                  <span>★</span>
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

