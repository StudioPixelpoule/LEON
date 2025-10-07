/**
 * MovieModal - Modale de détails de film (style Netflix minimaliste)
 */

'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import type { Media } from '@/lib/supabase'
import styles from './MovieModal.module.css'

type MovieModalProps = {
  movie: Media
  isOpen: boolean
  onClose: () => void
  onPlayClick: (filepath: string) => void
}

export default function MovieModal({ movie, isOpen, onClose, onPlayClick }: MovieModalProps) {
  // Bloquer le scroll du body quand la modale est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [isOpen])
  
  if (!isOpen) return null
  
  const backdropUrl = movie.backdrop_url || movie.poster_url || '/placeholder-backdrop.png'
  const posterUrl = movie.poster_url || '/placeholder-poster.png'
  
  
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Hero Section */}
        <div className={styles.hero}>
          <Image
            src={backdropUrl}
            alt=""
            fill
            style={{ objectFit: 'cover' }}
            unoptimized
          />
          <div className={styles.heroOverlay}>
            <button className={styles.closeButton} onClick={onClose}>
              ×
            </button>
            <div className={styles.heroContent}>
              <h1 className={styles.title}>{movie.title}</h1>
              {movie.original_title && movie.original_title !== movie.title && (
                <p className={styles.originalTitle}>{movie.original_title}</p>
              )}
              <button 
                className={styles.playButton}
                onClick={() => onPlayClick(movie.pcloud_fileid)}
              >
                ▶ Lire
              </button>
            </div>
          </div>
        </div>
        
        {/* Content Section */}
        <div className={styles.content}>
          {/* Métadonnées */}
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
                <span>⭐ {movie.rating}/10</span>
              </>
            )}
            {movie.quality && (
              <>
                <span className={styles.separator}>·</span>
                <span>{movie.quality}</span>
              </>
            )}
          </div>
          
          {/* Genres */}
          {movie.genres && movie.genres.length > 0 && (
            <div className={styles.genres}>
              {movie.genres.slice(0, 3).map((genre, i) => (
                <span key={i} className={styles.genre}>{genre}</span>
              ))}
            </div>
          )}
          
          {/* Synopsis */}
          {movie.overview && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Synopsis</h2>
              <p className={styles.overview}>{movie.overview}</p>
            </div>
          )}
          
          {/* Réalisateur */}
          {movie.director && movie.director.name && (
            <div className={styles.director}>
              <span className={styles.label}>Réalisation :</span>
              <span className={styles.value}>{movie.director.name}</span>
            </div>
          )}
          
          {/* Sous-titres */}
          {movie.subtitles && Object.keys(movie.subtitles).length > 0 && (
            <div className={styles.subtitles}>
              <span className={styles.label}>Sous-titres :</span>
              <span className={styles.value}>
                {Object.keys(movie.subtitles).join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


