'use client'

import Image from 'next/image'
import { Image as ImageIcon, Edit3 } from 'lucide-react'
import styles from '@/app/admin/admin.module.css'
import type { MediaToValidate, SeriesData } from '../hooks/usePostersData'
import { needsPosterValidation } from '../hooks/usePostersData'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PostersGridProps {
  type: 'films' | 'series'
  movies: MediaToValidate[]
  series: SeriesData[]
  onSelectMovie: (movie: MediaToValidate) => void
  onSelectSeries: (series: SeriesData) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PostersGrid({
  type,
  movies,
  series,
  onSelectMovie,
  onSelectSeries,
}: PostersGridProps) {
  // Grille films
  if (type === 'films' && movies.length > 0) {
    return (
      <div className={styles.mediaGrid}>
        {movies.map((movie) => {
          const invalid = needsPosterValidation(movie)
          return (
            <div
              key={movie.id}
              className={styles.mediaCard}
              onClick={() => onSelectMovie(movie)}
            >
              <div className={styles.mediaPoster}>
                {movie.poster_url && !movie.poster_url.includes('placeholder') ? (
                  <Image src={movie.poster_url} alt={movie.title} fill sizes="180px" style={{ objectFit: 'cover' }} unoptimized />
                ) : (
                  <div className={styles.mediaNoPoster}>
                    <ImageIcon size={32} />
                  </div>
                )}
                {invalid && <div className={styles.mediaValidationBadge}>À valider</div>}
              </div>
              <div className={styles.mediaInfo}>
                <h4 className={styles.mediaTitle}>{movie.title}</h4>
                {movie.year && <p className={styles.mediaYear}>{movie.year}</p>}
              </div>
              <div className={styles.mediaOverlay}>
                <Edit3 size={24} />
                <span>{invalid ? 'Valider' : 'Modifier'}</span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Grille séries
  if (type === 'series' && series.length > 0) {
    return (
      <div className={styles.mediaGrid}>
        {series.map((s) => {
          const invalid = needsPosterValidation(s)
          return (
            <div
              key={s.id}
              className={styles.mediaCard}
              onClick={() => onSelectSeries(s)}
            >
              <div className={styles.mediaPoster}>
                {s.poster_url && !s.poster_url.includes('placeholder') ? (
                  <Image src={s.poster_url} alt={s.title} fill sizes="180px" style={{ objectFit: 'cover' }} unoptimized />
                ) : (
                  <div className={styles.mediaNoPoster}>
                    <ImageIcon size={32} />
                  </div>
                )}
                {invalid && <div className={styles.mediaValidationBadge}>À valider</div>}
              </div>
              <div className={styles.mediaInfo}>
                <h4 className={styles.mediaTitle}>{s.title}</h4>
                {s.first_air_date && <p className={styles.mediaYear}>{new Date(s.first_air_date).getFullYear()}</p>}
              </div>
              <div className={styles.mediaOverlay}>
                <Edit3 size={24} />
                <span>{invalid ? 'Valider' : 'Modifier'}</span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return null
}
