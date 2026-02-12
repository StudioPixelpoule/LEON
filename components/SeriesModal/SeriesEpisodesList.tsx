/**
 * Liste des épisodes par saison avec progression de visionnage
 * Inclut le sélecteur de saison et les cartes épisodes
 */

'use client'

import Image from 'next/image'
import { Play, Check } from 'lucide-react'
import type { Season, Episode } from './hooks/useSeriesDetails'
import styles from './SeriesModal.module.css'

interface SeriesEpisodesListProps {
  seasons: Season[]
  selectedSeason: number
  onSeasonChange: (season: number) => void
  currentSeasonData: Season | undefined
  onPlayEpisode: (episode: Episode) => void
  getEpisodeProgressPercent: (episodeId: string) => number
  isEpisodeCompleted: (episodeId: string) => boolean
  formatTimeRemaining: (episodeId: string, runtime?: number) => string
}

/**
 * Affiche le sélecteur de saison et la liste des épisodes avec progression.
 */
export function SeriesEpisodesList({
  seasons,
  selectedSeason,
  onSeasonChange,
  currentSeasonData,
  onPlayEpisode,
  getEpisodeProgressPercent,
  isEpisodeCompleted,
  formatTimeRemaining,
}: SeriesEpisodesListProps) {
  return (
    <>
      {/* Sélecteur de saison */}
      <div className={styles.seasonSelector}>
        {seasons.map((season) => (
          <button
            key={season.season}
            className={`${styles.seasonButton} ${selectedSeason === season.season ? styles.active : ''}`}
            onClick={() => onSeasonChange(season.season)}
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
                  onClick={() => episode.filepath && onPlayEpisode(episode)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && episode.filepath) {
                      e.preventDefault()
                      onPlayEpisode(episode)
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
    </>
  )
}
