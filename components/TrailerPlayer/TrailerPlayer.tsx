/**
 * TrailerPlayer - Lecteur YouTube intégré style Netflix
 * Auto-play muet, sans contrôles, transition fluide avec l'image
 * 🔊 Bouton mute/unmute discret
 */

'use client'

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import Image from 'next/image'
import styles from './TrailerPlayer.module.css'

// Types YouTube IFrame API (remplacement de @types/youtube)
declare namespace YT {
  class Player {
    constructor(elementId: string | HTMLElement, options: PlayerOptions)
    playVideo(): void
    pauseVideo(): void
    stopVideo(): void
    mute(): void
    unMute(): void
    isMuted(): boolean
    setVolume(volume: number): void
    getVolume(): number
    destroy(): void
    getPlayerState(): number
  }
  interface PlayerOptions {
    height?: string | number
    width?: string | number
    videoId?: string
    playerVars?: Record<string, unknown>
    events?: Record<string, (event: OnStateChangeEvent) => void>
  }
  interface OnStateChangeEvent {
    target: Player
    data: number
  }
  interface PlayerEvent {
    target: Player
    data?: number
  }
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }
}

// 🔊 Icônes SVG minimalistes et élégantes
const IconVolumeOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5L6 9H2v6h4l5 4V5z"/>
    <line x1="23" y1="9" x2="17" y2="15"/>
    <line x1="17" y1="9" x2="23" y2="15"/>
  </svg>
)

const IconVolumeOn = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5L6 9H2v6h4l5 4V5z"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>
)

interface TrailerPlayerProps {
  youtubeKey: string | null // ID de la vidéo YouTube
  backdropUrl: string // Image de fallback
  onReady?: () => void
  onEnded?: () => void
  className?: string
  muteButtonPosition?: 'top-left' | 'bottom-left' // Position du bouton son
  showMuteButton?: boolean // Afficher le bouton interne (false = géré ailleurs)
  onMuteChange?: (isMuted: boolean) => void // Callback pour sync externe
}

// Exposer les méthodes pour contrôle externe
export interface TrailerPlayerRef {
  toggleMute: () => void
  mute: () => void
  isMuted: () => boolean
}

const TrailerPlayer = forwardRef<TrailerPlayerRef, TrailerPlayerProps>(({ 
  youtubeKey, 
  backdropUrl,
  onReady,
  onEnded,
  className = '',
  muteButtonPosition = 'top-left',
  showMuteButton = true,
  onMuteChange
}, ref) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [showImage, setShowImage] = useState(true)
  const [playerReady, setPlayerReady] = useState(false)
  const [isMuted, setIsMuted] = useState(true) // 🔊 État du son
  const playerRef = useRef<YT.Player | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Charger l'API YouTube
  useEffect(() => {
    if (!youtubeKey) return

    // Charger le script YouTube API s'il n'existe pas
    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
    }

    // Callback quand l'API est prête
    const onYouTubeReady = () => {
      if (containerRef.current && youtubeKey) {
        // Créer un div pour le player
        const playerDiv = document.createElement('div')
        playerDiv.id = `youtube-player-${youtubeKey}`
        containerRef.current.appendChild(playerDiv)

        playerRef.current = new window.YT.Player(playerDiv.id, {
          videoId: youtubeKey,
          playerVars: {
            autoplay: 1,
            mute: 1, // Muet pour permettre l'autoplay
            controls: 0, // Pas de contrôles
            showinfo: 0,
            rel: 0, // Pas de vidéos suggérées
            modestbranding: 1,
            iv_load_policy: 3, // Pas d'annotations
            disablekb: 1, // Désactiver le clavier
            fs: 0, // Pas de fullscreen
            playsinline: 1,
            loop: 0,
            origin: window.location.origin
          },
          events: {
            onReady: handlePlayerReady,
            onStateChange: handleStateChange,
            onError: handleError
          }
        })
      }
    }

    if (window.YT && window.YT.Player) {
      onYouTubeReady()
    } else {
      window.onYouTubeIframeAPIReady = onYouTubeReady
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [youtubeKey])

  const handlePlayerReady = useCallback(() => {
    setPlayerReady(true)
    onReady?.()
    
    // Attendre un peu puis masquer l'image et montrer la vidéo
    timeoutRef.current = setTimeout(() => {
      setShowImage(false)
      setIsPlaying(true)
    }, 500)
  }, [onReady])

  const handleStateChange = useCallback((event: YT.OnStateChangeEvent) => {
    // YT.PlayerState.ENDED = 0
    if (event.data === 0) {
      // Vidéo terminée - revenir à l'image
      setShowImage(true)
      setIsPlaying(false)
      onEnded?.()
    }
  }, [onEnded])

  const handleError = useCallback(() => {
    // En cas d'erreur, afficher l'image
    setShowImage(true)
    setIsPlaying(false)
  }, [])

  // 🔊 Toggle mute/unmute
  const toggleMute = useCallback(() => {
    if (!playerRef.current) return
    
    const newMutedState = !isMuted
    if (newMutedState) {
      playerRef.current.mute()
    } else {
      playerRef.current.unMute()
      playerRef.current.setVolume(50)
    }
    setIsMuted(newMutedState)
    onMuteChange?.(newMutedState)
  }, [isMuted, onMuteChange])

  // 🔇 Forcer le mute (pour quand une modal s'ouvre)
  const forceMute = useCallback(() => {
    if (!playerRef.current) return
    playerRef.current.mute()
    setIsMuted(true)
    onMuteChange?.(true)
  }, [onMuteChange])

  // Exposer les méthodes pour contrôle externe via ref
  useImperativeHandle(ref, () => ({
    toggleMute,
    mute: forceMute,
    isMuted: () => isMuted
  }), [toggleMute, forceMute, isMuted])

  // Si pas de trailer, afficher juste l'image
  if (!youtubeKey) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.backdrop}>
          <Image 
            src={backdropUrl} 
            alt=""
            fill
            sizes="100vw"
            style={{ objectFit: 'cover' }}
            priority
          />
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.container} ${className}`}>
      {/* Image de fond (visible au début et à la fin) */}
      <div 
        className={`${styles.backdrop} ${!showImage ? styles.hidden : ''}`}
      >
        <Image 
          src={backdropUrl} 
          alt=""
          fill
          sizes="100vw"
          style={{ objectFit: 'cover' }}
          priority
        />
      </div>

      {/* Player YouTube */}
      <div 
        ref={containerRef}
        className={`${styles.player} ${isPlaying ? styles.visible : ''}`}
      />

      {/* Overlay gradient pour le texte */}
      <div className={styles.gradient} />

      {/* 🔊 Bouton mute/unmute - visible seulement quand la vidéo joue ET showMuteButton=true */}
      {isPlaying && showMuteButton && (
        <button 
          className={`${styles.muteButton} ${muteButtonPosition === 'bottom-left' ? styles.muteButtonBottom : ''}`}
          onClick={toggleMute}
          aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
        >
          {isMuted ? <IconVolumeOff /> : <IconVolumeOn />}
        </button>
      )}
    </div>
  )
})

// Nom pour React DevTools
TrailerPlayer.displayName = 'TrailerPlayer'

export default TrailerPlayer

// Exporter aussi les icônes pour utilisation externe
export { IconVolumeOff, IconVolumeOn }

// Déclaration de type pour l'API YouTube
declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
  }
}

