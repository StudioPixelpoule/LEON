/**
 * Métadonnées de la série : titre, année, saisons, rating, genres
 * Bouton reprendre/commencer + contrôle son du trailer
 * Overview de la série
 */

'use client'

import { Play } from 'lucide-react'
import { TrailerPlayerRef, IconVolumeOff, IconVolumeOn } from '@/components/TrailerPlayer/TrailerPlayer'
import type { SeriesDetails, Episode } from './hooks/useSeriesDetails'
import type { EpisodeProgress } from './hooks/useEpisodeProgress'
import styles from './SeriesModal.module.css'

interface SeriesMetadataProps {
  seriesDetails: SeriesDetails
  trailerKey: string | null
  trailerEnded: boolean
  trailerMuted: boolean
  trailerRef: React.RefObject<TrailerPlayerRef>
  nextToWatch: Episode | null
  episodeProgress: Map<string, EpisodeProgress>
  onPlayEpisode: (episode: Episode) => void
}

/**
 * Affiche le titre, les métadonnées, le bouton reprendre et l'overview.
 * Rendu en Fragment — s'insère dans le wrapper .content du parent.
 */
export function SeriesMetadata({
  seriesDetails,
  trailerKey,
  trailerEnded,
  trailerMuted,
  trailerRef,
  nextToWatch,
  episodeProgress,
  onPlayEpisode,
}: SeriesMetadataProps) {
  const year = seriesDetails.first_air_date
    ? new Date(seriesDetails.first_air_date).getFullYear()
    : null
  const totalEpisodes = seriesDetails.seasons.reduce((acc, s) => acc + s.episodes.length, 0)

  return (
    <>
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
            onClick={() => onPlayEpisode(nextToWatch)}
          >
            <Play size={20} fill="black" />
            {episodeProgress.get(nextToWatch.id)?.position ? 'Reprendre' : 'Commencer'}
            <span className={styles.resumeEpisode}>
              S{nextToWatch.season_number}E{nextToWatch.episode_number}
            </span>
          </button>
          {/* Bouton son - à côté du bouton reprendre */}
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
    </>
  )
}
