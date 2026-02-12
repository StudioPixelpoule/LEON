/**
 * MovieModal - Modale universelle (films + séries TV)
 * - Film: affiche détails + bouton Lire
 * - Série: affiche sélecteur de saison + grille d'épisodes
 * - Trailer auto-play style Netflix
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import styles from './MovieModal.module.css'
import SimpleVideoPlayer from '@/components/SimpleVideoPlayer/SimpleVideoPlayer'
import FavoriteButton from '@/components/FavoriteButton/FavoriteButton'
import TrailerPlayer, { TrailerPlayerRef, IconVolumeOff, IconVolumeOn } from '@/components/TrailerPlayer/TrailerPlayer'

type Episode = {
  id: string
  title: string
  season_number: number
  episode_number: number
  overview: string | null
  duration: number | null
  formatted_runtime: string | null
  pcloud_fileid: string
}

type Season = {
  seasonNumber: number
  episodeCount: number
  episodes: Episode[]
}

type MovieModalProps = {
  movie: GroupedMedia
  onClose: () => void
  onPlayClick: (filepath: string) => void
  autoPlay?: boolean // Si true, lancer la lecture directement
}

export default function MovieModal({ movie, onClose, onPlayClick, autoPlay = false }: MovieModalProps) {
  const [selectedSeason, setSelectedSeason] = useState<number>(1)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)
  const [showPlayer, setShowPlayer] = useState(autoPlay) // Si autoPlay, ouvrir le lecteur directement
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
  const [trailerKey, setTrailerKey] = useState<string | null>(null) // 🎬 Trailer YouTube
  const [trailerEnded, setTrailerEnded] = useState(false)
  const [trailerMuted, setTrailerMuted] = useState(true) // 🔊 État du son du trailer
  const trailerRef = useRef<TrailerPlayerRef>(null)
  
  const isTVShow = movie.type === 'tv'
  
  // 🎬 Charger le trailer
  useEffect(() => {
    async function loadTrailer() {
      if (!movie.tmdb_id) {
        setTrailerKey(null)
        return
      }
      
      try {
        const type = isTVShow ? 'tv' : 'movie'
        const response = await fetch(`/api/trailer?tmdb_id=${movie.tmdb_id}&type=${type}`)
        const result = await response.json()
        
        if (result.success && result.trailer?.key) {
          console.log(`[MOVIE_MODAL] 🎬 Trailer trouvé pour ${movie.title}: ${result.trailer.key}`)
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
    setTrailerEnded(false) // Reset quand le film change
  }, [movie.tmdb_id, movie.title, isTVShow])
  
  // Charger les épisodes pour les séries
  useEffect(() => {
    if (isTVShow && movie.series_name) {
      loadEpisodes()
    }
  }, [isTVShow, movie.series_name])
  
  async function loadEpisodes() {
    try {
      setLoadingEpisodes(true)
      const response = await fetch(`/api/series/${encodeURIComponent(movie.series_name!)}/episodes`)
      const data = await response.json()
      
      if (data.success) {
        setSeasons(data.seasons)
        if (data.seasons.length > 0) {
          setSelectedSeason(data.seasons[0].seasonNumber)
        }
      }
    } catch (error) {
      console.error('Erreur chargement épisodes:', error)
    } finally {
      setLoadingEpisodes(false)
    }
  }
  
  // Bloquer le scroll du body quand la modale est ouverte
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [])
  
  const backdropUrl = movie.backdrop_url || movie.poster_url || '/placeholder-backdrop.png'
  const currentSeason = seasons.find(s => s.seasonNumber === selectedSeason)
  const currentEpisodes = currentSeason?.episodes || []
  
  // Parse du casting (afficher les 8 premiers acteurs principaux)
  const cast = movie.movie_cast && Array.isArray(movie.movie_cast) 
    ? movie.movie_cast.slice(0, 8) 
    : []
  
  // Afficher le lecteur vidéo pour les films (tous formats via HLS)
  if (showPlayer && !isTVShow && movie.pcloud_fileid) {
    // Déterminer l'URL selon le format
    const ext = movie.pcloud_fileid.toLowerCase().split('.').pop()
    const needsTranscode = ext === 'mkv' || ext === 'avi'
    
    const videoUrl = needsTranscode
      ? `/api/hls?path=${encodeURIComponent(movie.pcloud_fileid)}&playlist=true`
      : `/api/stream?path=${encodeURIComponent(movie.pcloud_fileid)}`
    
    // Utiliser SimpleVideoPlayer pour TOUS les formats (plus fiable)
    return (
      <SimpleVideoPlayer
        src={videoUrl}
        title={movie.title}
        subtitle={movie.year ? `Film · ${movie.year}` : 'Film'}
        poster={
          movie.backdrop_url || movie.poster_url 
            ? `/api/proxy-image?url=${encodeURIComponent(movie.backdrop_url || movie.poster_url || '')}`
            : undefined
        }
        mediaId={movie.id}
        onClose={() => {
          setShowPlayer(false)
          onClose()
        }}
      />
    )
  }
  
  // Afficher le lecteur vidéo pour les épisodes (tous formats)
  if (showPlayer && currentEpisode) {
    console.log('[MOVIE_MODAL] ✅ Lecteur épisode ouvert')
    
    const ext = currentEpisode.pcloud_fileid.toLowerCase().split('.').pop()
    const needsTranscode = ext === 'mkv' || ext === 'avi'
    
    const videoUrl = needsTranscode
      ? `/api/hls?path=${encodeURIComponent(currentEpisode.pcloud_fileid)}&playlist=true`
      : `/api/stream?path=${encodeURIComponent(currentEpisode.pcloud_fileid)}`
    
    // Utiliser SimpleVideoPlayer pour tous les formats
    return (
      <SimpleVideoPlayer
        src={videoUrl}
        title={movie.title}
        subtitle={`S${currentEpisode.season_number}E${currentEpisode.episode_number} · ${currentEpisode.title}`}
        poster={
          movie.backdrop_url 
            ? `/api/proxy-image?url=${encodeURIComponent(movie.backdrop_url)}`
            : undefined
        }
        mediaId={currentEpisode.id}
        mediaType="episode"
        onClose={() => {
          setShowPlayer(false)
          setCurrentEpisode(null)
        }}
      />
    )
  }
  
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Hero Section avec Trailer auto-play */}
        <div className={styles.hero}>
          {/* 🎬 Trailer ou Image */}
          {trailerKey && !trailerEnded ? (
            <TrailerPlayer
              ref={trailerRef}
              youtubeKey={trailerKey}
              backdropUrl={backdropUrl}
              onEnded={() => setTrailerEnded(true)}
              className={styles.trailerContainer}
              showMuteButton={false}
              onMuteChange={setTrailerMuted}
            />
          ) : (
            <Image
              src={backdropUrl}
              alt=""
              fill
              style={{ objectFit: 'cover' }}
              unoptimized
            />
          )}
          <div className={styles.heroOverlay}>
            <button className={styles.closeButton} onClick={onClose}>
              ×
            </button>
            <div className={styles.heroContent}>
              <h1 className={styles.title}>{movie.title}</h1>
              {movie.original_title && movie.original_title !== movie.title && (
                <p className={styles.originalTitle}>{movie.original_title}</p>
              )}
              
              {/* Pour les films : boutons Lire + Favori */}
              {!isTVShow && movie.pcloud_fileid && (
                <div className={styles.actionButtons}>
                  <button 
                    className={styles.playButton}
                    onClick={() => {
                      console.log('[MOVIE_MODAL] 🎬 Bouton Lire cliqué (film)')
                      console.log('[MOVIE_MODAL] Film:', movie.title)
                      console.log('[MOVIE_MODAL] Fichier:', movie.pcloud_fileid)
                      
                      const ext = movie.pcloud_fileid.toLowerCase().split('.').pop()
                      console.log('[MOVIE_MODAL] Format détecté:', ext)
                      
                      // Tous les formats → Lecteur web avec transcodage si nécessaire
                      setShowPlayer(true)
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5V19L19 12L8 5Z"/>
                    </svg>
                    Lire
                  </button>
                  <FavoriteButton 
                    mediaId={movie.id} 
                    mediaType="movie" 
                    size="large"
                  />
                  {/* 🔊 Bouton son - à côté du favori */}
                  {trailerKey && !trailerEnded && (
                    <button 
                      className={styles.muteButton}
                      onClick={() => {
                        console.log('[MOVIE_MODAL] 🔊 Click bouton son, ref:', trailerRef.current)
                        trailerRef.current?.toggleMute()
                      }}
                      aria-label={trailerMuted ? 'Activer le son' : 'Couper le son'}
                    >
                      {trailerMuted ? <IconVolumeOff /> : <IconVolumeOn />}
                    </button>
                  )}
                </div>
              )}
              
              {/* Pour les séries : afficher le nombre de saisons/épisodes */}
              {isTVShow && (
                <div className={styles.tvInfo}>
                  <span>{movie.season_count || 0} saison{(movie.season_count || 0) > 1 ? 's' : ''}</span>
                  <span className={styles.separator}>·</span>
                  <span>{movie.episode_count || 0} épisode{(movie.episode_count || 0) > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Content Section */}
        <div className={styles.content}>
          {/* Métadonnées */}
          <div className={styles.meta}>
            {movie.year && <span>{movie.year}</span>}
            {movie.formatted_runtime && !isTVShow && (
              <>
                <span className={styles.separator}>·</span>
                <span>{movie.formatted_runtime}</span>
              </>
            )}
            {movie.rating && (
              <>
                <span className={styles.separator}>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                  </svg>
                  {movie.rating}/10
                </span>
              </>
            )}
          </div>
          
          {/* Genres */}
          {movie.genres && movie.genres.length > 0 && (
            <div className={styles.genres}>
              {movie.genres.slice(0, 3).map(genre => (
                <span key={genre} className={styles.genre}>{genre}</span>
              ))}
            </div>
          )}
          
          {/* Synopsis */}
          {movie.overview && (
            <p className={styles.overview}>{movie.overview}</p>
          )}
          
          {/* Casting */}
          {cast.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Distribution</h2>
              <div className={styles.castGrid}>
                {cast.map((actor: any, index: number) => (
                  <div key={index} className={styles.castItem}>
                    <div className={styles.castPhoto}>
                      {actor.profile_path ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                          alt={actor.name}
                          fill
                          style={{ objectFit: 'cover' }}
                          unoptimized
                        />
                      ) : (
                        <div className={styles.castPhotoPlaceholder}>
                          {actor.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className={styles.castInfo}>
                      <p className={styles.castName}>{actor.name}</p>
                      <p className={styles.castCharacter}>{actor.character}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Section Épisodes (uniquement pour les séries) */}
          {isTVShow && (
            <div className={styles.episodesSection}>
              <h2 className={styles.sectionTitle}>Épisodes</h2>
              
              {/* Sélecteur de saison */}
              {seasons.length > 1 && (
                <div className={styles.seasonSelector}>
                  {seasons.map(season => (
                    <button
                      key={season.seasonNumber}
                      className={`${styles.seasonButton} ${selectedSeason === season.seasonNumber ? styles.active : ''}`}
                      onClick={() => setSelectedSeason(season.seasonNumber)}
                    >
                      Saison {season.seasonNumber}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Loading state */}
              {loadingEpisodes && (
                <p className={styles.loadingEpisodes}>Chargement des épisodes...</p>
              )}
              
              {/* Grille d'épisodes */}
              {!loadingEpisodes && currentEpisodes.length > 0 && (
                <div className={styles.episodeGrid}>
                  {currentEpisodes.map((episode, index) => (
                    <div 
                      key={episode.id} 
                      className={styles.episodeCard}
                      onClick={() => {
                        console.log('[MOVIE_MODAL] 🎬 Épisode cliqué:', episode.title)
                        setCurrentEpisode(episode)
                        setShowPlayer(true)
                      }}
                    >
                      <div className={styles.episodeNumber}>
                        {episode.episode_number || index + 1}
                      </div>
                      <div className={styles.episodeInfo}>
                        <h3 className={styles.episodeTitle}>
                          {episode.title || `Épisode ${episode.episode_number || index + 1}`}
                        </h3>
                        {episode.formatted_runtime && (
                          <p className={styles.episodeRuntime}>{episode.formatted_runtime}</p>
                        )}
                        {episode.overview && (
                          <p className={styles.episodeOverview}>{episode.overview}</p>
                        )}
                      </div>
                      <button className={styles.episodePlayButton}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5V19L19 12L8 5Z"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {!loadingEpisodes && currentEpisodes.length === 0 && (
                <p className={styles.noEpisodes}>Aucun épisode trouvé pour cette saison.</p>
              )}
            </div>
          )}
          
        </div>
      </div>
    </div>
  )
}
