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
import SimpleVideoPlayer, { PlayerPreferences, SeasonInfo, EpisodeInfo } from '@/components/SimpleVideoPlayer/SimpleVideoPlayer'
import TrailerPlayer, { TrailerPlayerRef, IconVolumeOff, IconVolumeOn } from '@/components/TrailerPlayer/TrailerPlayer'
import { useAuth } from '@/contexts/AuthContext'
import type { SeriesSummary } from '@/types/media'

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
  trailer_url: string | null // 🎬 Bande-annonce YouTube
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

interface SeriesInput {
  id: string
  title: string
  tmdb_id?: number | null
  trailer_url?: string | null
}

interface SeriesModalProps {
  series: SeriesInput
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
  const [creditsDuration, setCreditsDuration] = useState<number>(45) // 🎬 Durée du générique (défaut: 45s)

  // Charger la progression de visionnage en batch
  const loadProgress = useCallback(async (episodes: Episode[]) => {
    try {
      const progressMap = new Map<string, EpisodeProgress>()
      
      // Collecter tous les IDs d'épisodes
      const episodeIds = episodes.map(ep => ep.id)
      
      if (episodeIds.length === 0) {
        setEpisodeProgress(progressMap)
        return
      }
      
      // Faire un seul appel batch au lieu de N appels individuels
      try {
        const url = user?.id 
          ? `/api/playback-position/batch?mediaIds=${episodeIds.join(',')}&userId=${user.id}`
          : `/api/playback-position/batch?mediaIds=${episodeIds.join(',')}`
        
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          
          // L'API retourne { success: true, positions: { [mediaId]: { currentTime, duration, updatedAt } } }
          if (data.success && data.positions) {
            // Traiter chaque position retournée
            for (const [mediaId, pos] of Object.entries(data.positions)) {
              const position = pos as { currentTime: number; duration: number | null; updatedAt: string }
              
              if (position.currentTime && position.currentTime > 0) {
                // Trouver l'épisode correspondant pour obtenir le runtime par défaut
                const episode = episodes.find(ep => ep.id === mediaId)
                const duration = position.duration || (episode?.runtime ? episode.runtime * 60 : 45 * 60)
                const completed = duration > 0 && position.currentTime >= duration * 0.95
                
                progressMap.set(mediaId, {
                  episodeId: mediaId,
                  position: position.currentTime,
                  duration,
                  completed
                })
              }
            }
          }
        }
      } catch (e) {
        console.error('[SERIES_MODAL] Erreur batch positions:', e)
      }
      
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
      console.error('[SERIES_MODAL] Erreur chargement progression:', error)
    }
  }, [user?.id])

  useEffect(() => {
    loadSeriesDetails()
  }, [series.id])

  // 🎬 Charger le trailer de la série
  useEffect(() => {
    async function loadTrailer() {
      // 1. Utiliser d'abord le trailer stocké en BDD (plus rapide)
      if (series.trailer_url) {
        // Extraire la key YouTube de l'URL (format: https://www.youtube.com/watch?v=KEY)
        const match = series.trailer_url.match(/[?&]v=([^&]+)/)
        if (match && match[1]) {
          console.log(`[SERIES_MODAL] 🎬 Trailer stocké pour ${series.title}: ${match[1]}`)
          setTrailerKey(match[1])
          return
        }
      }
      
      // 2. Fallback: appel API TMDB si pas de trailer stocké
      const tmdbId = series.tmdb_id
      if (!tmdbId) {
        setTrailerKey(null)
        return
      }
      
      try {
        const response = await fetch(`/api/trailer?tmdb_id=${tmdbId}&type=tv`)
        const result = await response.json()
        
        if (result.success && result.trailer?.key) {
          console.log(`[SERIES_MODAL] 🎬 Trailer API pour ${series.title}: ${result.trailer.key}`)
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
  }, [series.id, series.tmdb_id, series.title, series.trailer_url])

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

  async function handlePlayEpisode(episode: Episode, preferences?: PlayerPreferences) {
    // Stocker les préférences si fournies (pour les enchaînements d'épisodes)
    if (preferences) {
      setPlayerPreferences(preferences)
    }
    
    // 🎬 Charger la durée du générique pour cette série/saison
    try {
      const params = new URLSearchParams({ show_name: series.title })
      if (episode.season_number) params.append('season', episode.season_number.toString())
      const response = await fetch(`/api/credits-duration?${params.toString()}`)
      const data = await response.json()
      if (data.success && data.credits_duration) {
        setCreditsDuration(data.credits_duration)
        console.log(`[SERIES_MODAL] 🎬 Durée générique pour ${series.title} S${episode.season_number}: ${data.credits_duration}s (${data.level})`)
      }
    } catch (error) {
      console.log('[SERIES_MODAL] ⚠️ Impossible de charger la durée du générique, utilisation du défaut (45s)')
      setCreditsDuration(45)
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
    
    // Convertir les saisons pour le player
    const allSeasonsForPlayer: SeasonInfo[] = seriesDetails.seasons.map(season => ({
      seasonNumber: season.season,
      episodes: season.episodes.map(ep => ({
        id: ep.id,
        title: ep.title,
        seasonNumber: ep.season_number,
        episodeNumber: ep.episode_number,
        thumbnail: ep.still_url 
          ? `/api/proxy-image?url=${encodeURIComponent(ep.still_url)}`
          : undefined,
        overview: ep.overview,
        runtime: ep.runtime
      }))
    }))
    
    // Handler pour sélectionner un épisode depuis la modale du player
    const handleEpisodeSelectFromPlayer = (episodeId: string, preferences: PlayerPreferences) => {
      // Trouver l'épisode dans toutes les saisons
      for (const season of seriesDetails.seasons) {
        const episode = season.episodes.find(ep => ep.id === episodeId)
        if (episode) {
          console.log('[SERIES_MODAL] 📺 Épisode sélectionné depuis player:', episode.title, 'avec préférences:', preferences)
          handlePlayEpisode(episode, preferences)
          break
        }
      }
    }
    
    return (
      <SimpleVideoPlayer
        // 🔧 FIX: PAS de key ici ! Garder le même composant pour préserver le fullscreen
        // Le player gère déjà le changement de src via useEffect([src])
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
          console.log('[SERIES_MODAL] ➡️ Passage à l\'épisode suivant:', nextEp.title, 'avec préférences:', preferences)
          handlePlayEpisode(nextEp, preferences)
        } : undefined}
        initialPreferences={playerPreferences}
        creditsDuration={creditsDuration} // 🎬 Durée du générique configurée
        // 🆕 Props pour la navigation des épisodes
        allSeasons={allSeasonsForPlayer}
        currentEpisodeId={currentEpisode.id}
        onEpisodeSelect={handleEpisodeSelectFromPlayer}
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
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && episode.filepath) {
                          e.preventDefault()
                          handlePlayEpisode(episode)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Lire ${episode.title}, Saison ${episode.season_number} Épisode ${episode.episode_number}`}
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

