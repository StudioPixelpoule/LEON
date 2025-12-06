/**
 * Modal Série - Affiche les détails, saisons et épisodes
 * Style Netflix avec progression de visionnage
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Play, Check } from 'lucide-react'
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
  runtime?: number
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

interface EpisodeProgress {
  episodeId: string
  position: number
  duration: number
  completed: boolean
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
  const [episodeProgress, setEpisodeProgress] = useState<Map<string, EpisodeProgress>>(new Map())
  const [nextToWatch, setNextToWatch] = useState<Episode | null>(null)

  // Charger la progression de visionnage
  const loadProgress = useCallback(async (episodes: Episode[]) => {
    try {
      const progressMap = new Map<string, EpisodeProgress>()
      
      // Charger la progression pour chaque épisode
      for (const ep of episodes) {
        const response = await fetch(`/api/playback-position?mediaId=${ep.id}`)
        if (response.ok) {
          const data = await response.json()
          if (data.position) {
            progressMap.set(ep.id, {
              episodeId: ep.id,
              position: data.position.position || 0,
              duration: data.position.duration || ep.runtime || 45 * 60,
              completed: data.position.completed || false
            })
          }
        }
      }
      
      setEpisodeProgress(progressMap)
      
      // Trouver le prochain épisode à regarder
      const allEpisodes = episodes.sort((a, b) => {
        if (a.season_number !== b.season_number) return a.season_number - b.season_number
        return a.episode_number - b.episode_number
      })
      
      for (const ep of allEpisodes) {
        const progress = progressMap.get(ep.id)
        if (!progress || !progress.completed) {
          setNextToWatch(ep)
          break
        }
      }
    } catch (error) {
      console.error('Erreur chargement progression:', error)
    }
  }, [])

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
          
          // Charger la progression pour tous les épisodes
          const allEpisodes = data.serie.seasons.flatMap((s: Season) => s.episodes)
          loadProgress(allEpisodes)
        }
      }
    } catch (error) {
      console.error('Erreur chargement détails série:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculer le pourcentage de progression d'un épisode
  function getEpisodeProgressPercent(episodeId: string): number {
    const progress = episodeProgress.get(episodeId)
    if (!progress || progress.duration === 0) return 0
    if (progress.completed) return 100
    return Math.min(100, (progress.position / progress.duration) * 100)
  }

  // Vérifier si un épisode est complété
  function isEpisodeCompleted(episodeId: string): boolean {
    const progress = episodeProgress.get(episodeId)
    return progress?.completed || false
  }

  // Formater le temps restant
  function formatTimeRemaining(episodeId: string, runtime?: number): string {
    const progress = episodeProgress.get(episodeId)
    if (!progress) return runtime ? `${runtime} min` : ''
    
    const remaining = Math.max(0, progress.duration - progress.position)
    const minutes = Math.ceil(remaining / 60)
    
    if (progress.position > 0 && !progress.completed) {
      return `${minutes} min restantes`
    }
    return runtime ? `${runtime} min` : ''
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
  const totalEpisodes = seriesDetails.seasons.reduce((acc, s) => acc + s.episodes.length, 0)
  const year = seriesDetails.first_air_date ? new Date(seriesDetails.first_air_date).getFullYear() : null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          ✕
        </button>

        {/* Hero avec backdrop */}
        <div className={styles.heroSection}>
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
          
          {/* Poster à gauche */}
          {seriesDetails.poster_url && (
            <div className={styles.heroPoster}>
              <Image
                src={seriesDetails.poster_url}
                alt={seriesDetails.title}
                width={200}
                height={300}
                className={styles.posterImage}
                unoptimized
              />
            </div>
          )}
        </div>

        <div className={styles.content}>
          {/* En-tête avec métadonnées */}
          <div className={styles.header}>
            <h1>{seriesDetails.title}</h1>
            <div className={styles.metadata}>
              {year && <span className={styles.year}>{year}</span>}
              {seriesDetails.seasons.length > 0 && (
                <span className={styles.seasonCount}>
                  {seriesDetails.seasons.length} saison{seriesDetails.seasons.length > 1 ? 's' : ''}
                </span>
              )}
              {totalEpisodes > 0 && (
                <span className={styles.episodeCount}>{totalEpisodes} épisodes</span>
              )}
              {seriesDetails.rating > 0 && (
                <span className={styles.ratingBadge}>⭐ {seriesDetails.rating.toFixed(1)}</span>
              )}
            </div>
            {seriesDetails.genres && seriesDetails.genres.length > 0 && (
              <div className={styles.genres}>
                {seriesDetails.genres.slice(0, 3).join(' • ')}
              </div>
            )}
          </div>

          {/* Bouton Reprendre / Commencer */}
          {nextToWatch && (
            <div className={styles.resumeSection}>
              <button 
                className={styles.resumeButton}
                onClick={() => handlePlayEpisode(nextToWatch)}
              >
                <Play size={20} fill="black" />
                {episodeProgress.get(nextToWatch.id)?.position ? 'Reprendre' : 'Commencer'}
                <span className={styles.resumeEpisode}>
                  S{nextToWatch.season_number}E{nextToWatch.episode_number}
                </span>
              </button>
            </div>
          )}

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
                {currentSeasonData.episodes.map((episode) => {
                  const progressPercent = getEpisodeProgressPercent(episode.id)
                  const completed = isEpisodeCompleted(episode.id)
                  
                  return (
                    <div
                      key={episode.id}
                      className={`${styles.episode} ${completed ? styles.completed : ''}`}
                      onClick={() => episode.filepath && handlePlayEpisode(episode)}
                    >
                      {/* Thumbnail ou numéro */}
                      <div className={styles.episodeThumbnailWrapper}>
                        {episode.still_url ? (
                          <div className={styles.episodeThumbnail}>
                            <Image
                              src={episode.still_url}
                              alt={episode.title}
                              width={160}
                              height={90}
                              className={styles.still}
                              unoptimized
                            />
                            {/* Overlay de lecture */}
                            <div className={styles.playOverlay}>
                              <Play size={32} fill="white" />
                            </div>
                            {/* Barre de progression */}
                            {progressPercent > 0 && (
                              <div className={styles.progressBar}>
                                <div 
                                  className={styles.progressFill} 
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className={styles.episodeNumber}>
                            {episode.episode_number}
                          </div>
                        )}
                      </div>
                      
                      <div className={styles.episodeInfo}>
                        <div className={styles.episodeHeader}>
                          <span className={styles.episodeNum}>
                            {episode.episode_number}. {episode.title}
                          </span>
                          {completed && (
                            <span className={styles.completedBadge}>
                              <Check size={14} />
                            </span>
                          )}
                        </div>
                        {episode.overview && (
                          <p className={styles.episodeOverview}>{episode.overview}</p>
                        )}
                        <div className={styles.episodeMeta}>
                          {formatTimeRemaining(episode.id, episode.runtime) && (
                            <span className={styles.runtime}>
                              {formatTimeRemaining(episode.id, episode.runtime)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

