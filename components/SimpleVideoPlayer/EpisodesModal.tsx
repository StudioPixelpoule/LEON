/**
 * EpisodesModal - Modale de sélection d'épisodes (séries uniquement)
 * Affiche les saisons et épisodes avec thumbnails, durée et synopsis
 */

'use client'

import { memo } from 'react'
import Image from 'next/image'
import styles from './SimpleVideoPlayer.module.css'
import type { SeasonInfo } from './types'

interface EpisodesModalProps {
  allSeasons: SeasonInfo[]
  selectedSeasonNumber: number
  onSeasonChange: (seasonNumber: number) => void
  currentEpisodeId?: string
  title?: string
  onEpisodeSelect: (episodeId: string) => void
  onClose: () => void
}

/**
 * Modale de sélection d'épisodes par saison
 */
const EpisodesModal = memo(function EpisodesModal({
  allSeasons,
  selectedSeasonNumber,
  onSeasonChange,
  currentEpisodeId,
  title,
  onEpisodeSelect,
  onClose
}: EpisodesModalProps) {
  return (
    <div 
      className={styles.episodesModalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className={styles.episodesModal}>
        {/* Header avec sélecteur de saison */}
        <div className={styles.episodesModalHeader}>
          <h3 className={styles.episodesModalTitle}>{title}</h3>
          
          <div className={styles.seasonSelector}>
            <select 
              value={selectedSeasonNumber}
              onChange={(e) => onSeasonChange(Number(e.target.value))}
            >
              {allSeasons.map(season => (
                <option key={season.seasonNumber} value={season.seasonNumber}>
                  Saison {season.seasonNumber}
                </option>
              ))}
            </select>
          </div>
          
          <button 
            className={styles.closeModalBtn}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
            </svg>
          </button>
        </div>
        
        {/* Liste des épisodes */}
        <div className={styles.episodesList}>
          {allSeasons
            .find(s => s.seasonNumber === selectedSeasonNumber)
            ?.episodes.map(episode => {
              const isCurrent = episode.id === currentEpisodeId
              return (
                <div 
                  key={episode.id}
                  className={`${styles.episodeItem} ${isCurrent ? styles.currentEpisode : ''}`}
                  onClick={() => {
                    if (!isCurrent) {
                      onEpisodeSelect(episode.id)
                    }
                  }}
                >
                  <span className={styles.episodeNumber}>{episode.episodeNumber}</span>
                  
                  <div className={styles.episodeThumbnail}>
                    {episode.thumbnail ? (
                      <Image 
                        src={episode.thumbnail} 
                        alt={episode.title}
                        fill
                        sizes="150px"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div className={styles.episodeThumbnailPlaceholder}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.episodeInfo}>
                    <h4 className={styles.episodeTitle}>{episode.title}</h4>
                    {episode.runtime && (
                      <span className={styles.episodeRuntime}>{episode.runtime} min</span>
                    )}
                    {episode.overview && (
                      <p className={styles.episodeOverview}>{episode.overview}</p>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
})

export default EpisodesModal
