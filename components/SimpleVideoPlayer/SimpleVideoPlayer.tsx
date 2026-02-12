'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import styles from './SimpleVideoPlayer.module.css'
import { usePlaybackPosition } from '@/lib/hooks/usePlaybackPosition'
import { useNetworkResilience } from '@/lib/hooks/useNetworkResilience'
import { usePlayerPreferences } from '@/lib/hooks/usePlayerPreferences'
import { useAuth } from '@/contexts/AuthContext'

// Hooks extraits
import { useControlsVisibility } from './hooks/useControlsVisibility'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useVolumeControl } from './hooks/useVolumeControl'
import { useFullscreen } from './hooks/useFullscreen'
import { useNextEpisode } from './hooks/useNextEpisode'
import { useSubtitleManager } from './hooks/useSubtitleManager'
import { useAudioManager } from './hooks/useAudioManager'
import { useVideoCore } from './hooks/useVideoCore'

// Composants extraits
import EpisodesModal from './EpisodesModal'
import PlayerOverlays from './PlayerOverlays'
import PlayerControls from './PlayerControls'

// Types centralisés (source unique de vérité)
import type {
  PlayerPreferences,
  SimpleVideoPlayerProps,
} from './types'

// Re-exports pour compatibilité avec les consumers existants (ex: SeriesModal.tsx)
export type { PlayerPreferences, SeasonInfo, EpisodeInfo } from './types'

// 🔧 IMPORTANT: cleanupFFmpeg() a été SUPPRIMÉ
// Il tuait TOUS les FFmpeg, même ceux d'autres vidéos en cours de lecture
// Le FFmpegManager gère maintenant automatiquement le nettoyage des sessions
// via /api/hls qui détecte les "phantom sessions" (processus FFmpeg morts)

export default function SimpleVideoPlayer({ 
  src, 
  title, 
  subtitle, 
  onClose,
  poster,
  mediaId,
  mediaType = 'movie',
  nextEpisode,
  onNextEpisode,
  initialPreferences,
  creditsDuration = 45, // Durée du générique en secondes (défaut: 45s avant la fin)
  allSeasons,
  currentEpisodeId,
  onEpisodeSelect
}: SimpleVideoPlayerProps) {
  const { user } = useAuth()
  const userId = user?.id
  
  // 🔧 Hook pour persister les préférences (langue audio, sous-titres)
  const { savePreferences, getInitialPreferences, isLoaded: prefsLoaded } = usePlayerPreferences(userId)
  
  // Refs partagés (utilisés par plusieurs hooks)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const settingsMenuRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const currentVideoUrl = useRef(src)
  
  // États partagés (setters utilisés par audio/subtitle managers ET videoCore)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Menu et pistes
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)

  // Callback partagé
  const getFilepath = useCallback(() => {
    const urlParams = new URLSearchParams(src.split('?')[1] || '')
    return urlParams.get('path')
  }, [src])

  // Volume (indépendant)
  const { volume, isMuted, setVolume, setIsMuted, handleVolumeToggle, handleVolumeChange } = useVolumeControl({
    videoRef: videoRef as React.RefObject<HTMLVideoElement>
  })

  // Hook audio (extrait Phase 7)
  const {
    audioTracks, selectedAudio, isRemuxing,
    audioTracksRef, selectedAudioRef, isChangingTrack,
    setAudioTracks, setSelectedAudio, handleAudioChange
  } = useAudioManager({
    videoRef: videoRef as React.RefObject<HTMLVideoElement | null>,
    hlsRef,
    src,
    getFilepath,
    currentVideoUrl,
    onLoading: setIsLoading,
    onError: setError,
    onCloseSettings: () => setShowSettingsMenu(false)
  })
  
  // Modale des épisodes (séries uniquement)
  const [showEpisodesModal, setShowEpisodesModal] = useState(false)
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number>(1)
  
  // Synchroniser la saison sélectionnée avec l'épisode en cours
  useEffect(() => {
    if (allSeasons && currentEpisodeId) {
      for (const season of allSeasons) {
        if (season.episodes.some(ep => ep.id === currentEpisodeId)) {
          setSelectedSeasonNumber(season.seasonNumber)
          break
        }
      }
    }
  }, [allSeasons, currentEpisodeId])

  // Hook subtitle manager (extrait Phase 6)
  const {
    subtitleTracks, selectedSubtitle, subtitleOffset,
    isDownloadingSubtitles, selectedSubtitleRef,
    pendingSubtitleApplyRef, subtitleAbortControllerRef,
    setSubtitleTracks, setSelectedSubtitle,
    handleSubtitleChange, handleSubtitleOffsetChange,
    handleSubtitleOffsetReset, handleDownloadOpenSubtitles
  } = useSubtitleManager({
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    src,
    getFilepath,
    onError: setError,
    onCloseSettings: () => setShowSettingsMenu(false)
  })
  // Résilience réseau (fournit connectionQuality utilisé par useVideoCore)
  const { 
    isOnline, 
    connectionQuality, 
    isReconnecting,
    handleNetworkError,
    savePosition,
    getSavedPosition,
  } = useNetworkResilience({
    onReconnect: () => {
      const video = videoRef.current
      if (video && video.paused) {
        video.play().catch(() => {})
      }
    },
    onDisconnect: () => {
      const video = videoRef.current
      if (video) {
        savePosition(video.currentTime)
      }
    },
  })

  // Bridge ref pour résoudre la dépendance circulaire useVideoCore <-> useNextEpisode
  const checkNextEpisodeRef = useRef<(currentTime: number, duration: number) => void>(() => {})

  // Hook principal vidéo (extrait Phase 8)
  const {
    isPlaying, currentTime, duration, buffered,
    isSeeking, isDragging, bufferReady,
    maxSeekableTime, seekWarning, isPreTranscoded,
    setIsDragging, setSeekWarning, setMaxSeekableTime,
    realDurationRef, getAudioTrack,
    handlePlayPause, handleSkip
  } = useVideoCore({
    src,
    initialPreferences,
    connectionQuality,
    videoRef: videoRef as React.RefObject<HTMLVideoElement | null>,
    hlsRef,
    currentVideoUrl,
    getFilepath,
    audioTracksRef,
    selectedAudioRef,
    isChangingTrack,
    subtitleAbortControllerRef,
    pendingSubtitleApplyRef,
    getInitialPreferences,
    callbacks: {
      onAudioTracksDiscovered: (tracks) => { setAudioTracks(tracks); audioTracksRef.current = tracks },
      onInitialAudioSet: (idx) => { setSelectedAudio(idx); selectedAudioRef.current = idx },
      onSubtitleTracksDiscovered: (tracks) => setSubtitleTracks(tracks),
      onInitialSubtitleSet: (idx) => { setSelectedSubtitle(idx !== null ? idx : null); if (idx !== null) pendingSubtitleApplyRef.current = idx },
      checkNextEpisode: (ct, d) => checkNextEpisodeRef.current(ct, d),
      setIsLoading,
      setError,
      setVolume,
      setIsMuted,
    }
  })

  // Visibilité des contrôles (nécessite isPlaying de useVideoCore)
  const { showControls, setShowControls, handleMouseMove } = useControlsVisibility({
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    isPlaying,
    showSettingsMenu
  })

  // Fullscreen (extrait Phase 5)
  const { isFullscreen, isFullscreenRef, toggleFullscreen: handleFullscreen } = useFullscreen({
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    initialWasFullscreen: initialPreferences?.wasFullscreen,
    onFullscreenEnter: () => {
      const video = videoRef.current
      if (video && !video.paused) {
        setShowControls(false)
      }
    }
  })

  // Position de lecture (nécessite currentTime et duration de useVideoCore)
  const { initialPosition, markAsFinished } = usePlaybackPosition({
    mediaId: mediaId || null,
    currentTime,
    duration: realDurationRef.current || duration,
    enabled: !!mediaId,
    mediaType,
    userId
  })

  // Préférences courantes (utilisées par useNextEpisode et handleEpisodeSelect)
  const getPreferences = useCallback((): PlayerPreferences => {
    const currentTrack = audioTracksRef.current[selectedAudioRef.current]
    return {
      audioTrackIndex: selectedAudioRef.current,
      audioStreamIndex: currentTrack?.index,
      audioLanguage: currentTrack?.language,
      subtitleTrackIndex: selectedSubtitleRef.current,
      wasFullscreen: isFullscreenRef.current ?? undefined
    }
  }, [audioTracksRef, isFullscreenRef])

  // Épisode suivant (extrait Phase 5)
  const {
    showUI: showNextEpisodeUI,
    countdown: nextEpisodeCountdown,
    isCancelled: isNextEpisodeCancelled,
    showUIRef: showNextEpisodeUIRef,
    cancel: handleCancelNextEpisode,
    playNow: handlePlayNextNow,
    checkTimeRemaining: checkNextEpisode
  } = useNextEpisode({
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    src,
    nextEpisode,
    creditsDuration,
    onNextEpisode,
    markAsFinished,
    mediaId,
    getPreferences
  })

  // Mise à jour du bridge après useNextEpisode
  checkNextEpisodeRef.current = checkNextEpisode

  // Restaurer la position initiale (UNE SEULE FOIS)
  const hasRestoredPositionRef = useRef(false)
  
  useEffect(() => {
    const video = videoRef.current
    if (!video || initialPosition === 0 || !bufferReady || hasRestoredPositionRef.current) return

    if (video.readyState >= 2 && buffered > 0) {
      console.log(`[PLAYER] Position restaurée: ${initialPosition}s`)
      video.currentTime = initialPosition
      hasRestoredPositionRef.current = true
    }
  }, [initialPosition, bufferReady, buffered])
  
  useEffect(() => {
    hasRestoredPositionRef.current = false
  }, [src])



  // 🔧 Sauvegarder les préférences quand elles changent (localStorage) - avec debounce
  const savePrefsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const initialLoadRef = useRef(true)
  
  useEffect(() => {
    // Ne pas sauvegarder au premier chargement
    if (!prefsLoaded) return
    if (initialLoadRef.current) {
      initialLoadRef.current = false
      return
    }
    
    // Debounce de 500ms pour éviter les saves trop fréquents
    if (savePrefsTimeoutRef.current) {
      clearTimeout(savePrefsTimeoutRef.current)
    }
    
    savePrefsTimeoutRef.current = setTimeout(() => {
      const currentTrack = audioTracksRef.current[selectedAudio]
      savePreferences({
        audioTrackIndex: selectedAudio,
        audioStreamIndex: currentTrack?.index,
        audioLanguage: currentTrack?.language,
        subtitleTrackIndex: selectedSubtitle,
        volume
      })
    }, 500)
    
    return () => {
      if (savePrefsTimeoutRef.current) {
        clearTimeout(savePrefsTimeoutRef.current)
      }
    }
  }, [selectedAudio, selectedSubtitle, volume, prefsLoaded, savePreferences])


  // Fermer le menu au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && 
          !settingsMenuRef.current.contains(event.target as Node) &&
          !(event.target as Element).closest('.settingsButton')) {
        setShowSettingsMenu(false)
      }
    }

    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSettingsMenu])

  // Raccourcis clavier
  useKeyboardShortcuts({
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    onPlayPause: handlePlayPause,
    onSkip: handleSkip,
    onFullscreen: handleFullscreen,
    onToggleMute: handleVolumeToggle,
    onCloseSettings: () => setShowSettingsMenu(false),
    showSettingsMenu
  })

  // Callback : sélection d'un épisode depuis la modale
  const handleEpisodeSelect = useCallback((episodeId: string) => {
    if (!onEpisodeSelect) return
    onEpisodeSelect(episodeId, getPreferences())
    setShowEpisodesModal(false)
  }, [onEpisodeSelect, getPreferences])

  // Retry handler pour PlayerOverlays
  const handleRetry = useCallback(() => {
    setError(null)
    setIsLoading(true)
    if (videoRef.current) {
      videoRef.current.load()
      videoRef.current.play().catch(() => {})
    }
  }, [])

  return (
    <div 
      ref={containerRef}
      className={`${styles.container} ${!showControls ? styles.hideCursor : ''}`} 
      onMouseMove={handleMouseMove}
      onMouseLeave={() => !showSettingsMenu && setShowControls(false)}
    >
      {/* Barre de titre */}
      <div className={`${styles.titleBar} ${showControls ? styles.visible : ''}`}>
        <button className={styles.closeButton} onClick={onClose}>
          <svg viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
        <div className={styles.titleInfo}>
          <h2>{title}</h2>
          {subtitle && <span>{subtitle}</span>}
        </div>
      </div>

      {/* Vidéo */}
      <video
        ref={videoRef}
        className={styles.video}
        poster={poster}
        playsInline
        webkit-playsinline="true"
        onDoubleClick={handleFullscreen}
      />

      {/* Overlays (loader, erreur, seek warning, play central, next episode) */}
      <PlayerOverlays
        isLoading={isLoading}
        isSeeking={isSeeking}
        isRemuxing={isRemuxing}
        isPlaying={isPlaying}
        error={error}
        seekWarning={seekWarning}
        showNextEpisodeUI={showNextEpisodeUI}
        nextEpisode={nextEpisode}
        nextEpisodeCountdown={nextEpisodeCountdown}
        onNextEpisode={onNextEpisode}
        onPlayNextNow={handlePlayNextNow}
        onCancelNextEpisode={handleCancelNextEpisode}
        onPlayPause={handlePlayPause}
        onRetry={handleRetry}
        onClose={onClose}
      />

      {/* Contrôles (timeline, play/pause, volume, settings, fullscreen) */}
      <PlayerControls
        showControls={showControls}
        currentTime={currentTime}
        duration={duration}
        buffered={buffered}
        isPreTranscoded={isPreTranscoded}
        maxSeekableTime={maxSeekableTime}
        isDragging={isDragging}
        src={src}
        videoRef={videoRef}
        realDurationRef={realDurationRef}
        setIsDragging={setIsDragging}
        setSeekWarning={setSeekWarning}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onSkip={handleSkip}
        volume={volume}
        isMuted={isMuted}
        onVolumeToggle={handleVolumeToggle}
        onVolumeChange={handleVolumeChange}
        mediaType={mediaType}
        nextEpisode={nextEpisode}
        onNextEpisode={onNextEpisode}
        audioTracks={audioTracks}
        selectedAudio={selectedAudio}
        selectedSubtitle={selectedSubtitle}
        isFullscreen={isFullscreen}
        allSeasons={allSeasons}
        onShowEpisodes={() => setShowEpisodesModal(true)}
        subtitleTracks={subtitleTracks}
        subtitleOffset={subtitleOffset}
        onAudioChange={handleAudioChange}
        onSubtitleChange={handleSubtitleChange}
        onSubtitleOffsetChange={handleSubtitleOffsetChange}
        onSubtitleOffsetReset={handleSubtitleOffsetReset}
        isDownloadingSubtitles={isDownloadingSubtitles}
        onDownloadSubtitles={handleDownloadOpenSubtitles}
        showSettingsMenu={showSettingsMenu}
        onToggleSettings={() => setShowSettingsMenu(!showSettingsMenu)}
        settingsMenuRef={settingsMenuRef}
        onFullscreen={handleFullscreen}
      />
      
      {/* Modale des épisodes (séries uniquement) */}
      {showEpisodesModal && allSeasons && allSeasons.length > 0 && (
        <EpisodesModal
          allSeasons={allSeasons}
          selectedSeasonNumber={selectedSeasonNumber}
          onSeasonChange={setSelectedSeasonNumber}
          currentEpisodeId={currentEpisodeId}
          title={title}
          onEpisodeSelect={handleEpisodeSelect}
          onClose={() => setShowEpisodesModal(false)}
        />
      )}
    </div>
  )
}
