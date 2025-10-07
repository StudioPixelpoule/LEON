/**
 * HeroSection - Film vedette en plein écran (style Netflix)
 */

'use client'

import Image from 'next/image'
import type { Media } from '@/lib/supabase'
import styles from './HeroSection.module.css'

type HeroSectionProps = {
  movie: Media
  onPlayClick: () => void
  onInfoClick: () => void
}

export default function HeroSection({ movie, onPlayClick, onInfoClick }: HeroSectionProps) {
  const backdropUrl = movie.backdrop_url || movie.poster_url || '/placeholder-backdrop.png'
  
  return (
    <section className={styles.hero}>
      <div className={styles.backdrop}>
        <Image
          src={backdropUrl}
          alt=""
          fill
          style={{ objectFit: 'cover' }}
          priority
          unoptimized
        />
      </div>
      
      <div className={styles.overlay}>
        <div className={styles.content}>
          <h1 className={styles.title}>{movie.title}</h1>
          
          <div className={styles.meta}>
            {movie.year && <span>{movie.year}</span>}
            {movie.formatted_runtime && (
              <>
                <span className={styles.separator}>·</span>
                <span>{movie.formatted_runtime}</span>
              </>
            )}
            {movie.rating && (
              <>
                <span className={styles.separator}>·</span>
                <span>★ {movie.rating}/10</span>
              </>
            )}
          </div>
          
          {movie.overview && (
            <p className={styles.overview}>{movie.overview}</p>
          )}
          
          <div className={styles.actions}>
            <button className={styles.playButton} onClick={onPlayClick}>
              ▶ Lire
            </button>
            <button className={styles.infoButton} onClick={onInfoClick}>
              Plus d'infos
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}


