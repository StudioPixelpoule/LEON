/**
 * Modal Série - Affiche les détails, saisons et épisodes
 */

'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import styles from './SeriesModal.module.css'
import SimpleVideoPlayer from '@/components/SimpleVideoPlayer/SimpleVideoPlayer'

interface Episode {
  id: string
  season_number: number
  episode_number: number
  title: string
  overview: string
  still_url: string | null
  filepath: string
  air_date: string
  rating: number
}

interface Season {
  season: number
  episodes: Episode[]
}

interface SeriesDetails {
  id: string
  title: string
  overview: string
  poster_url: string | null
  backdrop_url: string | null
  rating: number
  first_air_date: string
  seasons: Season[]
  genres: string[]
}

interface SeriesModalProps {
  series: any
  onClose: () => void
}

export default function SeriesModal({ series, onClose }: SeriesModalProps) {
  const [seriesDetails, setSeriesDetails] = useState<SeriesDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSeason, setSelectedSeason] = useState(1)
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
  const [showPlayer, setShowPlayer] = useState(false)

  useEffect(() => {
    loadSeriesDetails()
  }, [series.id])

  async function loadSeriesDetails() {
    try {
      setLoading(true)
      const response = await fetch(`/api/series/${series.id}`)
      const data = await response.json()

      if (data.success) {
        setSeriesDetails(data.serie)
        // Sélectionner la première saison par défaut
        if (data.serie.seasons.length > 0) {
          setSelectedSeason(data.serie.seasons[0].season)
        }
      }
    } catch (error) {
      console.error('Erreur chargement détails série:', error)
    } finally {
      setLoading(false)
    }
  }

  function handlePlayEpisode(episode: Episode) {
    setCurrentEpisode(episode)
    setShowPlayer(true)
  }

  function handleNextEpisode() {
    if (!currentEpisode || !seriesDetails) return

    const currentSeasonData = seriesDetails.seasons.find(s => s.season === selectedSeason)
    if (!currentSeasonData) return

    const currentIndex = currentSeasonData.episodes.findIndex(e => e.id === currentEpisode.id)
    
    // Épisode suivant dans la même saison
    if (currentIndex < currentSeasonData.episodes.length - 1) {
      const nextEpisode = currentSeasonData.episodes[currentIndex + 1]
      setCurrentEpisode(nextEpisode)
      return
    }

    // Sinon, premier épisode de la saison suivante
    const nextSeasonData = seriesDetails.seasons.find(s => s.season === selectedSeason + 1)
    if (nextSeasonData && nextSeasonData.episodes.length > 0) {
      setSelectedSeason(selectedSeason + 1)
      setCurrentEpisode(nextSeasonData.episodes[0])
    } else {
      // Pas d'épisode suivant, fermer le lecteur
      setShowPlayer(false)
      setCurrentEpisode(null)
    }
  }

  if (loading) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.loading}>Chargement...</div>
        </div>
      </div>
    )
  }

  if (!seriesDetails) {
    return null
  }

  // Afficher le lecteur vidéo si un épisode est sélectionné
  if (showPlayer && currentEpisode) {
    // Déterminer si transcodage nécessaire
    const ext = currentEpisode.filepath.toLowerCase().split('.').pop()
    const needsTranscode = ext === 'mkv' || ext === 'avi'
    
    const videoUrl = needsTranscode
      ? `/api/hls?path=${encodeURIComponent(currentEpisode.filepath)}&playlist=true`
      : `/api/stream?path=${encodeURIComponent(currentEpisode.filepath)}`
    
    return (
      <SimpleVideoPlayer
        src={videoUrl}
        title={seriesDetails.title}
        subtitle={`S${currentEpisode.season_number}E${currentEpisode.episode_number} · ${currentEpisode.title}`}
        poster={
          currentEpisode.still_url || seriesDetails.backdrop_url
            ? `/api/proxy-image?url=${encodeURIComponent(currentEpisode.still_url || seriesDetails.backdrop_url || '')}`
            : undefined
        }
        onClose={() => {
          setShowPlayer(false)
          setCurrentEpisode(null)
        }}
      />
    )
  }

  const currentSeasonData = seriesDetails.seasons.find(s => s.season === selectedSeason)

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          ✕
        </button>

        {/* Hero avec backdrop */}
        {seriesDetails.backdrop_url && (
          <div className={styles.backdrop}>
            <Image
              src={seriesDetails.backdrop_url}
              alt={seriesDetails.title}
              fill
              className={styles.backdropImage}
              unoptimized
            />
            <div className={styles.backdropOverlay} />
          </div>
        )}

        <div className={styles.content}>
          {/* En-tête */}
          <div className={styles.header}>
            <h1>{seriesDetails.title}</h1>
            {seriesDetails.rating > 0 && (
              <div className={styles.rating}>
                ⭐ {seriesDetails.rating.toFixed(1)}
              </div>
            )}
          </div>

          {seriesDetails.overview && (
            <p className={styles.overview}>{seriesDetails.overview}</p>
          )}

          {/* Sélecteur de saison */}
          <div className={styles.seasonSelector}>
            {seriesDetails.seasons.map((season) => (
              <button
                key={season.season}
                className={`${styles.seasonButton} ${selectedSeason === season.season ? styles.active : ''}`}
                onClick={() => setSelectedSeason(season.season)}
              >
                Saison {season.season}
              </button>
            ))}
          </div>

          {/* Liste des épisodes */}
          {currentSeasonData && (
            <div className={styles.episodes}>
              <h2>Saison {selectedSeason} • {currentSeasonData.episodes.length} épisodes</h2>
              
              <div className={styles.episodeList}>
                {currentSeasonData.episodes.map((episode) => (
                  <div
                    key={episode.id}
                    className={styles.episode}
                    onClick={() => episode.filepath && handlePlayEpisode(episode)}
                  >
                    <div className={styles.episodeNumber}>
                      {episode.episode_number}
                    </div>
                    
                    <div className={styles.episodeInfo}>
                      <h3>{episode.title}</h3>
                      {episode.overview && (
                        <p className={styles.episodeOverview}>{episode.overview}</p>
                      )}
                      {episode.air_date && (
                        <span className={styles.airDate}>{episode.air_date}</span>
                      )}
                    </div>

                    {episode.still_url && (
                      <div className={styles.episodeThumbnail}>
                        <Image
                          src={episode.still_url}
                          alt={episode.title}
                          width={200}
                          height={113}
                          className={styles.still}
                          unoptimized
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

