/**
 * PlayerOverlays - Overlays du lecteur vidéo
 * Extrait de SimpleVideoPlayer.tsx (Phase 9)
 * 
 * Responsabilités :
 * - Loader / spinner
 * - Warning de seek
 * - Bouton play central
 * - Message d'erreur + retry
 * - Overlay épisode suivant
 */

import styles from './SimpleVideoPlayer.module.css'
import NextEpisodeOverlay from './NextEpisodeOverlay'
import type { EpisodeInfo, PlayerPreferences } from './types'

interface PlayerOverlaysProps {
  isLoading: boolean
  isSeeking: boolean
  isRemuxing: boolean
  isPlaying: boolean
  error: string | null
  seekWarning: string | null
  // Épisode suivant
  showNextEpisodeUI: boolean
  nextEpisode?: EpisodeInfo
  nextEpisodeCountdown: number
  onNextEpisode?: (prefs: PlayerPreferences) => void
  onPlayNextNow: () => void
  onCancelNextEpisode: () => void
  // Actions
  onPlayPause: () => void
  onRetry: () => void
  onClose: () => void
}

export default function PlayerOverlays({
  isLoading, isSeeking, isRemuxing, isPlaying, error,
  seekWarning,
  showNextEpisodeUI, nextEpisode, nextEpisodeCountdown,
  onNextEpisode, onPlayNextNow, onCancelNextEpisode,
  onPlayPause, onRetry, onClose
}: PlayerOverlaysProps) {
  return (
    <>
      {/* Loader */}
      {(isLoading || isSeeking) && !error && (
        <div className={styles.loader}>
          <div className={styles.spinner}></div>
          {isRemuxing && (
            <div className={styles.loaderMessage}>
              Changement de langue en cours... Cela peut prendre quelques minutes.
            </div>
          )}
        </div>
      )}
      
      {/* Warning de seek */}
      {seekWarning && (
        <div className={styles.seekWarning}>
          <span>⏳</span>
          <span>{seekWarning}</span>
        </div>
      )}
      
      {/* Bouton Play central */}
      {!isPlaying && !isLoading && !error && (
        <button 
          className={styles.centerPlayButton}
          onClick={onPlayPause}
          aria-label="Lancer la lecture"
        >
          <svg viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" fill="white"/>
          </svg>
        </button>
      )}

      {/* Erreur */}
      {error && (
        <div className={styles.error}>
          <p>{error}</p>
          <div className={styles.errorButtons}>
            <button onClick={onRetry}>Réessayer</button>
            <button onClick={onClose}>Fermer</button>
          </div>
        </div>
      )}

      {/* Épisode suivant (style Netflix) */}
      {showNextEpisodeUI && nextEpisode && onNextEpisode && (
        <NextEpisodeOverlay
          nextEpisode={nextEpisode}
          countdown={nextEpisodeCountdown}
          onPlayNow={onPlayNextNow}
          onCancel={onCancelNextEpisode}
        />
      )}
    </>
  )
}
