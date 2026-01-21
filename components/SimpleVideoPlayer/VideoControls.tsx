/**
 * VideoControls - Barre de contrôles du lecteur vidéo
 * 
 * Composant présentatif qui reçoit l'état et les actions en props.
 * Peut être utilisé progressivement pour remplacer les contrôles inline.
 */

'use client'

import { memo, useCallback, MouseEvent as ReactMouseEvent } from 'react'
import styles from './SimpleVideoPlayer.module.css'
import { formatTime, VideoControlsState, VideoControlsActions } from './types'

interface VideoControlsProps extends VideoControlsState, VideoControlsActions {
  title?: string
  subtitle?: string
  onClose: () => void
  onSettingsClick: () => void
  progressRef: React.RefObject<HTMLDivElement>
}

/**
 * Barre de contrôles du lecteur vidéo
 */
const VideoControls = memo(function VideoControls({
  // État
  isPlaying,
  currentTime,
  duration,
  buffered,
  volume,
  isMuted,
  isFullscreen,
  isLoading,
  showControls,
  // Actions
  togglePlay,
  seek,
  setVolume,
  toggleMute,
  toggleFullscreen,
  skip,
  // Props supplémentaires
  title,
  subtitle,
  onClose,
  onSettingsClick,
  progressRef
}: VideoControlsProps) {
  
  // Gérer le clic sur la barre de progression
  const handleProgressClick = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration || duration <= 0) return
    
    const rect = progressRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percent = clickX / rect.width
    const newTime = Math.max(0, Math.min(duration, percent * duration))
    
    seek(newTime)
  }, [duration, seek, progressRef])

  // Ne pas afficher si masqué
  if (!showControls && isPlaying && !isLoading) {
    return null
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0

  return (
    <div className={`${styles.controls} ${showControls ? styles.visible : ''}`}>
      {/* Header avec titre */}
      <div className={styles.topControls}>
        <button className={styles.closeButton} onClick={onClose}>
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
          </svg>
        </button>
        {title && (
          <div className={styles.titleContainer}>
            <h2 className={styles.title}>{title}</h2>
            {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
          </div>
        )}
      </div>

      {/* Contrôles centraux */}
      <div className={styles.centerControls}>
        {/* Reculer de 10s */}
        <button 
          className={styles.skipButton} 
          onClick={() => skip(-10)}
          aria-label="Reculer de 10 secondes"
        >
          <svg viewBox="0 0 24 24" width="36" height="36">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" fill="currentColor"/>
            <text x="12" y="15" textAnchor="middle" fontSize="7" fill="currentColor">10</text>
          </svg>
        </button>
        
        {/* Play/Pause */}
        <button 
          className={styles.playPauseButton}
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Lecture'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" width="48" height="48">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="48" height="48">
              <path d="M8 5v14l11-7z" fill="currentColor"/>
            </svg>
          )}
        </button>
        
        {/* Avancer de 10s */}
        <button 
          className={styles.skipButton} 
          onClick={() => skip(10)}
          aria-label="Avancer de 10 secondes"
        >
          <svg viewBox="0 0 24 24" width="36" height="36">
            <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" fill="currentColor"/>
            <text x="12" y="15" textAnchor="middle" fontSize="7" fill="currentColor">10</text>
          </svg>
        </button>
      </div>

      {/* Barre de progression et contrôles du bas */}
      <div className={styles.bottomControls}>
        {/* Barre de progression */}
        <div 
          ref={progressRef}
          className={styles.progressContainer}
          onClick={handleProgressClick}
        >
          <div className={styles.progressBackground}>
            {/* Buffer */}
            <div 
              className={styles.progressBuffer} 
              style={{ width: `${bufferedProgress}%` }}
            />
            {/* Progression */}
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Temps et contrôles */}
        <div className={styles.controlsRow}>
          {/* Temps */}
          <span className={styles.time}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Boutons à droite */}
          <div className={styles.rightControls}>
            {/* Volume */}
            <button 
              className={styles.controlButton}
              onClick={toggleMute}
              aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
            >
              {isMuted || volume === 0 ? (
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" fill="currentColor"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/>
                </svg>
              )}
            </button>

            {/* Paramètres */}
            <button 
              className={styles.controlButton}
              onClick={onSettingsClick}
              aria-label="Paramètres"
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor"/>
              </svg>
            </button>

            {/* Plein écran */}
            <button 
              className={styles.controlButton}
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            >
              {isFullscreen ? (
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" fill="currentColor"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="currentColor"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

export default VideoControls
