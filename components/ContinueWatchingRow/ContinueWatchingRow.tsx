/**
 * Composant: ContinueWatchingRow
 * Affiche les films en cours de visionnage avec badge de progression
 */

'use client'

import { useState, useEffect } from 'react'
import { Play, X } from 'lucide-react'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import styles from './ContinueWatchingRow.module.css'

interface MediaWithProgress extends GroupedMedia {
  current_time: number
  saved_duration: number | null
  progress_percent: number
  last_watched: string
}

interface ContinueWatchingRowProps {
  onMovieClick: (movie: GroupedMedia) => void
}

export default function ContinueWatchingRow({ onMovieClick }: ContinueWatchingRowProps) {
  const [movies, setMovies] = useState<MediaWithProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInProgressMovies()
  }, [])

  async function loadInProgressMovies() {
    try {
      setLoading(true)
      const response = await fetch('/api/media/in-progress')
      const data = await response.json()
      
      if (data.success) {
        setMovies(data.media)
      }
    } catch (error) {
      console.error('Erreur chargement films en cours:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove(movieId: string, event: React.MouseEvent) {
    event.stopPropagation()
    
    try {
      await fetch(`/api/playback-position?mediaId=${movieId}`, {
        method: 'DELETE'
      })
      
      // Retirer de la liste
      setMovies(movies.filter(m => m.id !== movieId))
    } catch (error) {
      console.error('Erreur suppression position:', error)
    }
  }

  // Ne rien afficher si pas de films en cours
  if (!loading && movies.length === 0) {
    return null
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Continuer le visionnage</h2>
        <div className={styles.loading}>Chargement...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Continuer le visionnage</h2>
      
      <div className={styles.row}>
        {movies.map((movie) => (
          <div
            key={movie.id}
            className={styles.card}
            onClick={() => onMovieClick(movie)}
          >
            {/* Bouton supprimer */}
            <button
              className={styles.removeBtn}
              onClick={(e) => handleRemove(movie.id, e)}
              title="Marquer comme terminé"
            >
              <X size={16} />
            </button>

            {/* Poster */}
            <div className={styles.posterWrapper}>
              <img
                src={movie.poster_url ? `/api/proxy-image?url=${encodeURIComponent(movie.poster_url)}` : '/placeholder-poster.png'}
                alt={movie.title}
                className={styles.poster}
              />
              
              {/* Badge progression */}
              <div className={styles.progressOverlay}>
                <div className={styles.playIcon}>
                  <Play size={24} fill="white" />
                </div>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${movie.progress_percent}%` }}
                  />
                </div>
                <div className={styles.progressText}>
                  {movie.progress_percent}%
                </div>
              </div>
            </div>

            {/* Info */}
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

