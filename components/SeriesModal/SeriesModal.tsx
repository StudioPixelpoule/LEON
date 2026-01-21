/**
 * Modal Série - Affiche les détails, saisons et épisodes
 * Style Netflix avec progression de visionnage
 * 🎬 Trailer auto-play style Netflix
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { Play, Check } from 'lucide-react'
import styles from './SeriesModal.module.css'
import SimpleVideoPlayer, { PlayerPreferences } from '@/components/SimpleVideoPlayer/SimpleVideoPlayer'
import TrailerPlayer, { TrailerPlayerRef, IconVolumeOff, IconVolumeOn } from '@/components/TrailerPlayer/TrailerPlayer'
import { useAuth } from '@/contexts/AuthContext'

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
  const { user } = useAuth()
  const [seriesDetails, setSeriesDetails] = useState<SeriesDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSeason, setSelectedSeason] = useState(1)
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
  const [showPlayer, setShowPlayer] = useState(false)
  const [episodeProgress, setEpisodeProgress] = useState<Map<string, EpisodeProgress>>(new Map())
  const [nextToWatch, setNextToWatch] = useState<Episode | null>(null)
  const [trailerKey, setTrailerKey] = useState<string | null>(null) // 🎬 Trailer YouTube
  const [trailerEnded, setTrailerEnded] = useState(false)
  const [trailerMuted, setTrailerMuted] = useState(true) // 🔊 État du son du trailer
  const trailerRef = useRef<TrailerPlayerRef>(null)
  const [playerPreferences, setPlayerPreferences] = useState<PlayerPreferences | undefined>(undefined) // 🎬 Préférences conservées entre épisodes

  // Charger la progression de visionnage
  const loadProgress = useCallback(async (episodes: Episode[]) => {
    try {
      const progressMap = new Map<string, EpisodeProgress>()
      
      // Charger la progression pour chaque épisode (en parallèle pour plus de rapidité)
      const progressPromises = episodes.map(async (ep) => {
        try {
          // Passer le userId si l'utilisateur est connecté
          const url = user?.id 
            ? `/api/playback-position?mediaId=${ep.id}&userId=${user.id}`
            : `/api/playback-position?mediaId=${ep.id}`
          const response = await fetch(url)
          if (response.ok) {
            const data = await response.json()
            // L'API retourne currentTime, duration, etc.
            if (data.currentTime && data.currentTime > 0) {
              const duration = data.duration || (ep.runtime ? ep.runtime * 60 : 45 * 60)
              const position = data.currentTime
              const completed = duration > 0 && position >= duration * 0.95
              
              return {
                id: ep.id,
                progress: {
                  episodeId: ep.id,
                  position,
                  duration,
                  completed
                }
              }
            }
          }
        } catch (e) {
          // Ignorer les erreurs individuelles
        }
        return null
      })
      
      const results = await Promise.all(progressPromises)
      results.forEach(result => {
        if (result) {
          progressMap.set(result.id, result.progress)
        }
      })
      
      setEpisodeProgress(progressMap)
      
      // Trouver le prochain épisode à regarder
      const allEpisodes = [...episodes].sort((a, b) => {
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
  }, [user?.id])

  useEffect(() => {
    loadSeriesDetails()
  }, [series.id])

  // 🎬 Charger le trailer de la série
  useEffect(() => {
    async function loadTrailer() {
      // Utiliser tmdb_id de la série (passé en props)
      const tmdbId = series.tmdb_id
      if (!tmdbId) {
        setTrailerKey(null)
        return
      }
      
      try {
        const response = await fetch(`/api/trailer?tmdb_id=${tmdbId}&type=tv`)
        const result = await response.json()
        
        if (result.success && result.trailer?.key) {
          console.log(`🎬 Trailer trouvé pour ${series.title}: ${result.trailer.key}`)
          setTrailerKey(result.trailer.key)
        } else {
          setTrailerKey(null)
        }
      } catch (error) {
        console.error('❌ Erreur chargement trailer:', error)
        setTrailerKey(null)
      }
    }
    
    loadTrailer()
    setTrailerEnded(false) // Reset quand la série change
  }, [series.id, series.tmdb_id, series.title])

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

  function handlePlayEpisode(episode: Episode, preferences?: PlayerPreferences) {
    // Stocker les préférences si fournies (pour les enchaînements d'épisodes)
    if (preferences) {
      setPlayerPreferences(preferences)
    }
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

  // Trouver l'épisode suivant
  function getNextEpisode(current: Episode): Episode | null {
    if (!seriesDetails) return null
    const allEpisodes = seriesDetails.seasons.flatMap(s => s.episodes)
    const sorted = allEpisodes.sort((a, b) => {
      if (a.season_number !== b.season_number) return a.season_number - b.season_number
      return a.episode_number - b.episode_number
    })
    
    const currentIndex = sorted.findIndex(ep => ep.id === current.id)
    if (currentIndex >= 0 && currentIndex < sorted.length - 1) {
      return sorted[currentIndex + 1]
    }
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
    
    // Trouver l'épisode suivant pour le auto-play
    const nextEp = getNextEpisode(currentEpisode)
    
    return (
      <SimpleVideoPlayer
        key={currentEpisode.id} // 🔧 FIX: Forcer re-mount complet quand l'épisode change
        src={videoUrl}
        title={seriesDetails.title}
        subtitle={`S${currentEpisode.season_number}E${currentEpisode.episode_number} · ${currentEpisode.title}`}
        poster={
          currentEpisode.still_url || seriesDetails.backdrop_url
            ? `/api/proxy-image?url=${encodeURIComponent(currentEpisode.still_url || seriesDetails.backdrop_url || '')}`
            : undefined
        }
        mediaId={currentEpisode.id}
        mediaType="episode"
        nextEpisode={nextEp ? {
          id: nextEp.id,
          title: nextEp.title,
          seasonNumber: nextEp.season_number,
          episodeNumber: nextEp.episode_number,
          thumbnail: nextEp.still_url 
            ? `/api/proxy-image?url=${encodeURIComponent(nextEp.still_url)}`
            : undefined
        } : undefined}
        onNextEpisode={nextEp ? (preferences: PlayerPreferences) => {
          // Passer à l'épisode suivant avec les préférences (audio, sous-titres, fullscreen)
          console.log('[SERIES] ➡️ Passage à l\'épisode suivant:', nextEp.title, 'avec préférences:', preferences)
          handlePlayEpisode(nextEp, preferences)
        } : undefined}
        initialPreferences={playerPreferences}
        onClose={() => {
          setShowPlayer(false)
          setCurrentEpisode(null)
          // Recharger la progression après fermeture du lecteur
          if (seriesDetails) {
            const allEpisodes = seriesDetails.seasons.flatMap(s => s.episodes)
            loadProgress(allEpisodes)
          }
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

        {/* Hero avec backdrop et trailer auto-play */}
        <div className={styles.heroSection}>
          {/* 🎬 Trailer ou Image */}
          {trailerKey && !trailerEnded ? (
            <TrailerPlayer
              ref={trailerRef}
              youtubeKey={trailerKey}
              backdropUrl={seriesDetails.backdrop_url || '/placeholder-backdrop.png'}
              onEnded={() => setTrailerEnded(true)}
              className={styles.trailerContainer}
              showMuteButton={false}
              onMuteChange={setTrailerMuted}
            />
          ) : seriesDetails.backdrop_url && (
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

          {/* Bouton Reprendre / Commencer + Bouton son */}
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
              {/* 🔊 Bouton son - à côté du bouton reprendre */}
              {trailerKey && !trailerEnded && (
                <button 
                  className={styles.muteButton}
                  onClick={() => trailerRef.current?.toggleMute()}
                  aria-label={trailerMuted ? 'Activer le son' : 'Couper le son'}
                >
                  {trailerMuted ? <IconVolumeOff /> : <IconVolumeOn />}
                </button>
              )}
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
                              src={`/api/proxy-image?url=${encodeURIComponent(episode.still_url)}`}
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
                        
                        {/* Barre de progression visible sous l'épisode */}
                        {progressPercent > 0 && (
                          <div className={styles.episodeProgressBar}>
                            <div 
                              className={styles.episodeProgressFill} 
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        )}
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

