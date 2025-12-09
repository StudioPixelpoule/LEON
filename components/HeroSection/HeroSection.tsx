/**
 * HeroSection - Film vedette en plein écran (style Netflix)
 * Avec lecture automatique du trailer en fond
 */

'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import type { Media } from '@/lib/supabase'
import TrailerPlayer from '@/components/TrailerPlayer/TrailerPlayer'
import styles from './HeroSection.module.css'

// Type partiel pour accepter Media et GroupedMedia
type HeroMovie = Pick<Media, 'id' | 'title' | 'overview' | 'backdrop_url' | 'poster_url' | 'rating' | 'year' | 'genres' | 'formatted_runtime'> & {
  trailerKey?: string | null // ID YouTube du trailer
}

type HeroSectionProps = {
  movie: HeroMovie
  onPlayClick?: () => void
  onInfoClick: () => void
  showPlayButton?: boolean
}

export default function HeroSection({ movie, onPlayClick, onInfoClick, showPlayButton = true }: HeroSectionProps) {
  const backdropUrl = movie.backdrop_url || movie.poster_url || '/placeholder-backdrop.png'
  const [showOverview, setShowOverview] = useState(true)
  const [trailerEnded, setTrailerEnded] = useState(false)
  
  useEffect(() => {
    // Masquer le synopsis après 8 secondes (plus long si trailer)
    const timer = setTimeout(() => {
      setShowOverview(false)
    }, movie.trailerKey ? 8000 : 5000)
    
    return () => clearTimeout(timer)
  }, [movie.id, movie.trailerKey])

  // Reset quand le film change
  useEffect(() => {
    setTrailerEnded(false)
  }, [movie.id])
  
  return (
    <section className={styles.hero}>
      {/* 🎬 Trailer auto-play ou image de fond */}
      {movie.trailerKey && !trailerEnded ? (
        <TrailerPlayer
          youtubeKey={movie.trailerKey}
          backdropUrl={backdropUrl}
          onEnded={() => setTrailerEnded(true)}
          className={styles.trailerContainer}
        />
      ) : (
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
      )}
      
      <div className={styles.overlay}>
        <div className={`${styles.content} ${!showOverview ? styles.contentCollapsed : ''}`}>
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
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                  </svg>
                  {movie.rating}/10
                </span>
              </>
            )}
          </div>
          
          {movie.overview && (
            <p className={`${styles.overview} ${!showOverview ? styles.overviewHidden : ''}`}>
              {movie.overview}
            </p>
          )}
          
          <div className={styles.actions}>
            {showPlayButton && onPlayClick && (
              <button className={styles.playButton} onClick={onPlayClick}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5V19L19 12L8 5Z"/>
                </svg>
                Lire
              </button>
            )}
            <button className={styles.infoButton} onClick={onInfoClick}>
              Plus d&apos;infos
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}


