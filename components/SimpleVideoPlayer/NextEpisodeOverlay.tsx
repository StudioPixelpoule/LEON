/**
 * NextEpisodeOverlay - Overlay pour l'épisode suivant (style Netflix)
 * Affiche le compte à rebours et permet de lancer ou annuler l'épisode suivant
 */

'use client'

import { memo } from 'react'
import Image from 'next/image'
import styles from './SimpleVideoPlayer.module.css'

export interface NextEpisodeInfo {
  id: string
  title: string
  seasonNumber: number
  episodeNumber: number
  thumbnail?: string
}

export interface PlayerPreferences {
  audioTrackIndex?: number
  subtitleTrackIndex?: number | null
  wasFullscreen?: boolean
}

interface NextEpisodeOverlayProps {
  nextEpisode: NextEpisodeInfo
  countdown: number
  onPlayNow: () => void
  onCancel: () => void
}

/**
 * Overlay pour afficher l'épisode suivant avec compte à rebours
 */
const NextEpisodeOverlay = memo(function NextEpisodeOverlay({
  nextEpisode,
  countdown,
  onPlayNow,
  onCancel
}: NextEpisodeOverlayProps) {
  return (
    <div className={styles.nextEpisodeOverlay}>
      <div className={styles.nextEpisodeCard}>
        {nextEpisode.thumbnail && (
          <div className={styles.nextEpisodeThumbnail}>
            <Image 
              src={nextEpisode.thumbnail} 
              alt={nextEpisode.title}
              fill
              sizes="200px"
              style={{ objectFit: 'cover' }}
            />
          </div>
        )}
        <div className={styles.nextEpisodeInfo}>
          <span className={styles.nextEpisodeLabel}>Épisode suivant</span>
          <span className={styles.nextEpisodeTitle}>
            S{nextEpisode.seasonNumber}E{nextEpisode.episodeNumber} · {nextEpisode.title}
          </span>
        </div>
      </div>
      
      <div className={styles.nextEpisodeButtons}>
        <button 
          className={styles.nextEpisodePlay}
          onClick={onPlayNow}
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path d="M8 5v14l11-7z" fill="currentColor"/>
          </svg>
          Lire maintenant
        </button>
        <button 
          className={styles.nextEpisodeCancel}
          onClick={onCancel}
        >
          Annuler
        </button>
      </div>
      
      <div className={styles.nextEpisodeCountdown}>
        Lecture dans {countdown}s
      </div>
    </div>
  )
})

export default NextEpisodeOverlay
