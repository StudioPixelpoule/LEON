/**
 * Composant: ContinueWatchingRow
 * Affiche les films en cours de visionnage avec badge de progression
 */

'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import styles from './ContinueWatchingRow.module.css'

interface MediaWithProgress extends GroupedMedia {
  position: number
  saved_duration: number | null
  progress_percent: number
  playback_updated_at: string
}

interface ContinueWatchingRowProps {
  onMovieClick: (movie: GroupedMedia) => void
  onMoviePlay?: (movie: GroupedMedia) => void // Pour lancer directement la lecture
  onRefresh: () => void
  refreshKey?: number // Pour forcer le rafraîchissement depuis le parent
}

export default function ContinueWatchingRow({ onMovieClick, onMoviePlay, onRefresh, refreshKey }: ContinueWatchingRowProps) {
  const [movies, setMovies] = useState<MediaWithProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInProgressMovies() // Chargement initial avec loading
    
    // 🔄 Rafraîchir automatiquement toutes les 30 secondes (en mode silencieux)
    const intervalId = setInterval(() => {
      loadInProgressMovies(true) // silent = true pour ne pas afficher le loading
    }, 30000) // 30 secondes
    
    return () => clearInterval(intervalId)
  }, [refreshKey]) // ✨ Recharger aussi quand refreshKey change

  async function loadInProgressMovies(silent = false) {
    try {
      if (!silent) setLoading(true) // Ne montrer le loading que lors du premier chargement
      const response = await fetch('/api/media/in-progress')
      const data = await response.json()
      
      if (data.success) {
        setMovies(data.media)
      }
    } catch (error) {
      console.error('Erreur chargement films en cours:', error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  async function handleRemove(movieId: string, event: React.MouseEvent) {
    event.stopPropagation()
    
    try {
      // Marquer comme terminé en mettant position = 0
      await fetch('/api/playback-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId: movieId, position: 0, duration: 0 })
      })
      
      // Retirer de la liste
      setMovies(movies.filter(m => m.id !== movieId))
      
      // Rafraîchir la page parent
      onRefresh()
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
      <section className={styles.row}>
        <h2 className={styles.title}>Continuer le visionnage</h2>
        <div className={styles.loading}>Chargement...</div>
      </section>
    )
  }

  return (
    <section className={styles.row}>
      <h2 className={styles.title}>Continuer le visionnage</h2>
      <div className={styles.scroll}>
        {movies.map((movie) => (
          <div
            key={movie.id}
            className={styles.card}
            onClick={() => onMoviePlay ? onMoviePlay(movie) : onMovieClick(movie)}
          >
            {/* Bouton supprimer */}
            <button
              className={styles.removeBtn}
              onClick={(e) => handleRemove(movie.id, e)}
              title="Marquer comme terminé"
            >
              <X size={16} />
            </button>

            {/* Poster avec barre de progression */}
            <div className={styles.posterContainer}>
              <Image
                src={movie.poster_url || '/placeholder-poster.svg'}
                alt={movie.title}
                width={240}
                height={360}
                className={styles.poster}
                unoptimized
              />
              
              {/* Barre de progression EN BAS (comme MovieRow) */}
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${movie.progress_percent}%` }}
                />
              </div>
            </div>

            {/* Info au hover (comme MovieRow) */}
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
              {movie.progress_percent > 0 && (
                <div className={styles.cardProgress}>
                  {movie.progress_percent}% regardé
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

