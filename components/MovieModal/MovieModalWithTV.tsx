/**
 * MovieModal - Modale universelle (films + séries TV)
 * - Film: affiche détails + bouton Lire
 * - Série: affiche sélecteur de saison + grille d'épisodes
 */

'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import styles from './MovieModal.module.css'

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
}

export default function MovieModal({ movie, onClose, onPlayClick }: MovieModalProps) {
  const [selectedSeason, setSelectedSeason] = useState<number>(1)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)
  
  const isTVShow = movie.type === 'tv'
  
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
              
              {/* Pour les films : bouton Lire direct */}
              {!isTVShow && movie.pcloud_fileid && (
                <button 
                  className={styles.playButton}
                  onClick={() => onPlayClick(movie.pcloud_fileid!)}
                >
                  ▶ Lire
                </button>
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
                <span>★ {movie.rating}/10</span>
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
                      onClick={() => onPlayClick(episode.pcloud_fileid)}
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
                      <button className={styles.episodePlayButton}>▶</button>
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
