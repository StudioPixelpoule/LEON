/**
 * HeroSection - Film vedette en plein écran (style Netflix)
 */

'use client'

import { useState, useEffect } from 'react'
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
  const [showOverview, setShowOverview] = useState(true)
  
  useEffect(() => {
    // Masquer le synopsis après 5 secondes
    const timer = setTimeout(() => {
      setShowOverview(false)
    }, 5000)
    
    return () => clearTimeout(timer)
  }, [movie.id])
  
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
            <button className={styles.playButton} onClick={onPlayClick}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5V19L19 12L8 5Z"/>
              </svg>
              Lire
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


