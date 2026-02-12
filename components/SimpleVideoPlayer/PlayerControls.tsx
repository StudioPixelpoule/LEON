/**
 * PlayerControls - Barre de contrôles du lecteur vidéo
 * Extrait de SimpleVideoPlayer.tsx (Phase 9)
 * 
 * Responsabilités :
 * - Timeline (barre de progression + timestamps)
 * - Play/Pause, Skip
 * - Volume
 * - Boutons épisodes (séries)
 * - Menu audio/sous-titres
 * - Fullscreen
 */

import React, { useRef, type MutableRefObject } from 'react'
import styles from './SimpleVideoPlayer.module.css'
import PlayerSettingsMenu from './PlayerSettingsMenu'
import { formatTime } from './utils/timeUtils'
import type { AudioTrack, SubtitleTrack, PlayerPreferences, SeasonInfo } from './types'

interface PlayerControlsProps {
  // Visibilité
  showControls: boolean

  // Timeline
  currentTime: number
  duration: number
  buffered: number
  isPreTranscoded: boolean
  maxSeekableTime: number
  isDragging: boolean
  src: string
  videoRef: React.RefObject<HTMLVideoElement | null>
  realDurationRef: MutableRefObject<number>
  setIsDragging: (v: boolean) => void
  setSeekWarning: (v: string | null) => void

  // Lecture
  isPlaying: boolean
  onPlayPause: () => void
  onSkip: (seconds: number) => void

  // Volume
  volume: number
  isMuted: boolean
  onVolumeToggle: () => void
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void

  // Épisodes (séries)
  mediaType: string
  nextEpisode?: { seasonNumber: number; episodeNumber: number; title?: string } | null
  onNextEpisode?: (prefs: PlayerPreferences) => void
  audioTracks: AudioTrack[]
  selectedAudio: number
  selectedSubtitle: number | null
  isFullscreen: boolean
  allSeasons?: SeasonInfo[]
  onShowEpisodes: () => void

  // Settings menu
  subtitleTracks: SubtitleTrack[]
  subtitleOffset: number
  onAudioChange: (track: AudioTrack, idx: number) => void
  onSubtitleChange: (idx: number | null) => void
  onSubtitleOffsetChange: (delta: number) => void
  onSubtitleOffsetReset: () => void
  isDownloadingSubtitles: boolean
  onDownloadSubtitles: () => Promise<void>
  showSettingsMenu: boolean
  onToggleSettings: () => void
  settingsMenuRef: React.RefObject<HTMLDivElement>

  // Fullscreen
  onFullscreen: () => void
}

export default function PlayerControls({
  showControls, currentTime, duration, buffered,
  isPreTranscoded, maxSeekableTime, isDragging, src,
  videoRef, realDurationRef, setIsDragging, setSeekWarning,
  isPlaying, onPlayPause, onSkip,
  volume, isMuted, onVolumeToggle, onVolumeChange,
  mediaType, nextEpisode, onNextEpisode,
  audioTracks, selectedAudio, selectedSubtitle, isFullscreen,
  allSeasons, onShowEpisodes,
  subtitleTracks, subtitleOffset,
  onAudioChange, onSubtitleChange, onSubtitleOffsetChange, onSubtitleOffsetReset,
  isDownloadingSubtitles, onDownloadSubtitles,
  showSettingsMenu, onToggleSettings, settingsMenuRef,
  onFullscreen
}: PlayerControlsProps) {
  const progressRef = useRef<HTMLDivElement>(null)

  // Calcul du pourcentage de progression
  const progressPercent = (() => {
    if (!duration || duration === 0) return 0
    if (currentTime > duration) return 100
    const percent = (currentTime / duration) * 100
    return Math.min(100, Math.max(0, percent))
  })()

  // Clic sur la barre de progression
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current || isDragging) return
    
    const rect = progressRef.current.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const actualDuration = realDurationRef.current || duration || videoRef.current.duration
    const targetTime = percent * actualDuration
    
    if (isPreTranscoded) {
      setSeekWarning(null)
      if (isFinite(actualDuration) && actualDuration > 0) {
        videoRef.current.currentTime = targetTime
      }
      return
    }
    
    const isHLS = src.includes('/api/hls')
    if (isHLS && targetTime > maxSeekableTime && maxSeekableTime < actualDuration * 0.95) {
      const availableMinutes = Math.floor(maxSeekableTime / 60)
      const availableSeconds = Math.floor(maxSeekableTime % 60)
      
      setSeekWarning(`Transcodage en cours... Disponible jusqu'à ${availableMinutes}:${availableSeconds.toString().padStart(2, '0')}`)
      setTimeout(() => setSeekWarning(null), 3000)
      
      if (isFinite(maxSeekableTime) && maxSeekableTime > 0) {
        videoRef.current.currentTime = Math.min(targetTime, maxSeekableTime - 5)
      }
      return
    }
    
    setSeekWarning(null)
    if (isFinite(actualDuration) && actualDuration > 0) {
      videoRef.current.currentTime = targetTime
    }
  }

  // Drag sur la barre de progression
  const handleProgressDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current) return
    
    setIsDragging(true)
    const rect = progressRef.current.getBoundingClientRect()
    const isHLS = src.includes('/api/hls')
    
    const updatePosition = (clientX: number) => {
      if (!videoRef.current || !progressRef.current) return
      const currentRect = progressRef.current.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (clientX - currentRect.left) / currentRect.width))
      const actualDuration = realDurationRef.current || duration || videoRef.current.duration
      
      if (isFinite(actualDuration) && actualDuration > 0) {
        const targetTime = percent * actualDuration
        
        if (isPreTranscoded) {
          videoRef.current.currentTime = targetTime
          return
        }
        
        if (isHLS && targetTime > maxSeekableTime && maxSeekableTime < actualDuration * 0.95) {
          const safeTime = Math.max(0, maxSeekableTime - 2)
          videoRef.current.currentTime = safeTime
        } else {
          videoRef.current.currentTime = targetTime
        }
      }
    }
    
    updatePosition(e.clientX)
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) updatePosition(e.clientX)
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
      setSeekWarning(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div className={`${styles.controls} ${showControls ? styles.visible : ''}`}>
      {/* Timeline */}
      <div className={styles.timeline}>
        <span className={styles.currentTime}>{formatTime(currentTime)}</span>
        <div 
          ref={progressRef}
          className={styles.progressBar}
          onClick={handleProgressClick}
          onMouseDown={handleProgressDrag}
        >
          <div className={styles.progressBuffered} style={{ width: `${buffered}%` }} />
          <div className={styles.progressFilled} style={{ width: `${progressPercent}%` }} />
          <div 
            className={styles.progressThumb} 
            style={{ left: `${Math.min(Math.max(0, progressPercent), 100)}%` }} 
          />
        </div>
        <span className={styles.duration}>{formatTime(duration)}</span>
      </div>
      
      {/* Contrôles du bas */}
      <div className={styles.controlsBottom}>
        <div className={styles.leftControls}>
          {/* Play/Pause */}
          <button onClick={onPlayPause} className={`${styles.controlBtn} ${styles.playBtn}`}>
            {isPlaying ? (
              <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
          
          {/* Skip */}
          <button onClick={() => onSkip(-10)} className={styles.controlBtn}>
            <svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
          </button>
          <button onClick={() => onSkip(10)} className={styles.controlBtn}>
            <svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
          </button>
          
          {/* Volume */}
          <div className={styles.volumeGroup}>
            <button onClick={onVolumeToggle} className={styles.controlBtn}>
              {isMuted || volume === 0 ? (
                <svg viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0023 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
              ) : (
                <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z"/></svg>
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={onVolumeChange}
              className={styles.volumeSlider}
              style={{ '--volume-percent': `${(isMuted ? 0 : volume) * 100}%` } as React.CSSProperties}
            />
          </div>
        </div>
        
        <div className={styles.rightControls}>
          {/* Épisode suivant (séries) */}
          {mediaType === 'episode' && onNextEpisode && nextEpisode && (
            <button 
              className={styles.episodeBtn}
              onClick={() => {
                const preferences: PlayerPreferences = {
                  audioTrackIndex: selectedAudio,
                  audioStreamIndex: audioTracks[selectedAudio]?.index,
                  audioLanguage: audioTracks[selectedAudio]?.language,
                  subtitleTrackIndex: selectedSubtitle,
                  wasFullscreen: isFullscreen
                }
                onNextEpisode(preferences)
              }}
              title={`Épisode suivant: S${nextEpisode.seasonNumber}E${nextEpisode.episodeNumber}`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          )}
          
          {/* Liste des épisodes */}
          {mediaType === 'episode' && allSeasons && allSeasons.length > 0 && (
            <button 
              className={styles.episodeBtn}
              onClick={onShowEpisodes}
              title="Liste des épisodes"
            >
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM10 9h8v2h-8V9zm0 3h4v2h-4v-2zm0-6h8v2h-8V6z"/></svg>
            </button>
          )}
          
          {/* Settings */}
          {(audioTracks.length > 0 || subtitleTracks.length > 0) && (
            <div style={{ position: 'relative' }}>
              <button 
                onClick={onToggleSettings}
                className={`${styles.textBtn} settingsButton`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M19 19H5V5h14m0-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2m-7 6c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3m-1 7H6v1h5v-1m2-3H6v1h7v-1m2-3H6v1h9v-1"/>
                </svg>
                <span>Audio et sous-titres</span>
              </button>
              
              {showSettingsMenu && (
                <PlayerSettingsMenu
                  audioTracks={audioTracks}
                  selectedAudio={selectedAudio}
                  onAudioChange={onAudioChange}
                  subtitleTracks={subtitleTracks}
                  selectedSubtitle={selectedSubtitle}
                  onSubtitleChange={onSubtitleChange}
                  subtitleOffset={subtitleOffset}
                  onSubtitleOffsetChange={onSubtitleOffsetChange}
                  onSubtitleOffsetReset={onSubtitleOffsetReset}
                  isDownloadingSubtitles={isDownloadingSubtitles}
                  onDownloadSubtitles={onDownloadSubtitles}
                  menuRef={settingsMenuRef}
                />
              )}
            </div>
          )}
          
          {/* Fullscreen */}
          <button onClick={onFullscreen} className={styles.controlBtn}>
            <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
