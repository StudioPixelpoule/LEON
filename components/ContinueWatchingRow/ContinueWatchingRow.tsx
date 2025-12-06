/**
 * Composant: ContinueWatchingRow
 * Affiche les films ET épisodes en cours de visionnage avec badge de progression
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
  content_type?: 'movie' | 'episode'
  subtitle?: string // Pour les épisodes: "S1E3 · Titre épisode"
  series_id?: string
  season_number?: number
  episode_number?: number
}

interface ContinueWatchingRowProps {
  onMovieClick: (movie: GroupedMedia) => void
  onMoviePlay?: (movie: GroupedMedia) => void
  onEpisodeClick?: (episode: MediaWithProgress) => void // Pour les épisodes
  onRefresh: () => void
  refreshKey?: number
  filter?: 'all' | 'movies' | 'episodes' // Filtrer par type
}

export default function ContinueWatchingRow({ 
  onMovieClick, 
  onMoviePlay, 
  onEpisodeClick,
  onRefresh, 
  refreshKey,
  filter = 'all'
}: ContinueWatchingRowProps) {
  const [media, setMedia] = useState<MediaWithProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInProgressMedia()
    
    const intervalId = setInterval(() => {
      loadInProgressMedia(true)
    }, 30000)
    
    return () => clearInterval(intervalId)
  }, [refreshKey])

  async function loadInProgressMedia(silent = false) {
    try {
      if (!silent) setLoading(true)
      const response = await fetch('/api/media/in-progress')
      const data = await response.json()
      
      if (data.success) {
        let filtered = data.media
        // Filtrer par type si demandé
        if (filter === 'movies') {
          filtered = data.media.filter((m: MediaWithProgress) => m.content_type !== 'episode')
        } else if (filter === 'episodes') {
          filtered = data.media.filter((m: MediaWithProgress) => m.content_type === 'episode')
        }
        setMedia(filtered)
      }
    } catch (error) {
      console.error('Erreur chargement médias en cours:', error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  async function handleRemove(mediaId: string, mediaType: string | undefined, event: React.MouseEvent) {
    event.stopPropagation()
    
    try {
      await fetch('/api/playback-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mediaId, 
          position: 0, 
          duration: 0,
          media_type: mediaType || 'movie'
        })
      })
      
      setMedia(media.filter(m => m.id !== mediaId))
      onRefresh()
    } catch (error) {
      console.error('Erreur suppression position:', error)
    }
  }

  function handleClick(item: MediaWithProgress) {
    if (item.content_type === 'episode' && onEpisodeClick) {
      onEpisodeClick(item)
    } else if (onMoviePlay) {
      onMoviePlay(item)
    } else {
      onMovieClick(item)
    }
  }

  // Ne rien afficher si pas de médias en cours
  if (!loading && media.length === 0) {
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
        {media.map((item) => (
          <div
            key={item.id}
            className={styles.card}
            onClick={() => handleClick(item)}
          >
            {/* Bouton supprimer */}
            <button
              className={styles.removeBtn}
              onClick={(e) => handleRemove(item.id, item.content_type, e)}
              title="Marquer comme terminé"
            >
              <X size={16} />
            </button>

            {/* Poster avec barre de progression */}
            <div className={styles.posterContainer}>
              <Image
                src={item.poster_url || '/placeholder-poster.svg'}
                alt={item.title}
                width={240}
                height={360}
                className={styles.poster}
                unoptimized
              />
              
              {/* Badge épisode */}
              {item.content_type === 'episode' && item.season_number && item.episode_number && (
                <div className={styles.episodeBadge}>
                  S{item.season_number}E{item.episode_number}
                </div>
              )}
              
              {/* Barre de progression */}
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${item.progress_percent}%` }}
                />
              </div>
            </div>

            {/* Info au hover */}
            <div className={styles.cardHover}>
              <h3 className={styles.cardTitle}>{item.title}</h3>
              {item.subtitle && (
                <div className={styles.cardSubtitle}>{item.subtitle}</div>
              )}
              <div className={styles.cardMeta}>
                {item.year && <span>{item.year}</span>}
                {item.formatted_runtime && (
                  <>
                    <span>·</span>
                    <span>{item.formatted_runtime}</span>
                  </>
                )}
              </div>
              {item.progress_percent > 0 && (
                <div className={styles.cardProgress}>
                  {item.progress_percent}% regardé
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

