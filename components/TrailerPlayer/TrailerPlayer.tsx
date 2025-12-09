/**
 * TrailerPlayer - Lecteur YouTube intégré style Netflix
 * Auto-play muet, sans contrôles, transition fluide avec l'image
 * 🔊 Bouton mute/unmute discret
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import styles from './TrailerPlayer.module.css'

interface TrailerPlayerProps {
  youtubeKey: string | null // ID de la vidéo YouTube
  backdropUrl: string // Image de fallback
  onReady?: () => void
  onEnded?: () => void
  className?: string
  buttonTopOffset?: number // Décalage du bouton son depuis le haut (pour éviter le header)
}

export default function TrailerPlayer({ 
  youtubeKey, 
  backdropUrl,
  onReady,
  onEnded,
  className = ''
}: TrailerPlayerProps) {
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
    
    if (isMuted) {
      playerRef.current.unMute()
      playerRef.current.setVolume(50) // Volume à 50%
      setIsMuted(false)
    } else {
      playerRef.current.mute()
      setIsMuted(true)
    }
  }, [isMuted])

  // Si pas de trailer, afficher juste l'image
  if (!youtubeKey) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.backdrop}>
          <img 
            src={backdropUrl} 
            alt="" 
            className={styles.image}
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
        <img 
          src={backdropUrl} 
          alt="" 
          className={styles.image}
        />
      </div>

      {/* Player YouTube */}
      <div 
        ref={containerRef}
        className={`${styles.player} ${isPlaying ? styles.visible : ''}`}
      />

      {/* Overlay gradient pour le texte */}
      <div className={styles.gradient} />

      {/* 🔊 Bouton mute/unmute - visible seulement quand la vidéo joue */}
      {isPlaying && (
        <button 
          className={styles.muteButton}
          onClick={toggleMute}
          aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      )}
    </div>
  )
}

// Déclaration de type pour l'API YouTube
declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
  }
}

