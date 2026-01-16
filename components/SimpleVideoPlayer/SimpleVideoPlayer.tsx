'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import styles from './SimpleVideoPlayer.module.css'
import menuStyles from './SettingsMenu.module.css'
import { useBufferStatus } from '@/lib/hooks/useBufferStatus'
import { SegmentPreloader } from '@/lib/segment-preloader'
import { usePlaybackPosition } from '@/lib/hooks/usePlaybackPosition'
import { useNetworkResilience } from '@/lib/hooks/useNetworkResilience'
import { HLS_BASE_CONFIG, selectHlsConfig } from '@/lib/hls-config'
import { useAuth } from '@/contexts/AuthContext'

// 🔧 Utilitaires Fullscreen compatibles Safari et iOS
interface ExtendedDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}

interface ExtendedHTMLElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>
}

interface ExtendedHTMLVideoElement extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void // iOS Safari specific
  webkitExitFullscreen?: () => void
  webkitDisplayingFullscreen?: boolean
  webkitSupportsFullscreen?: boolean
}

// Détecter iOS (iPhone, iPad, iPod)
const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// Détecter Safari
const isSafari = (): boolean => {
  if (typeof navigator === 'undefined') return false
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

const getFullscreenElement = (): Element | null => {
  const doc = document as ExtendedDocument
  return doc.fullscreenElement || doc.webkitFullscreenElement || null
}

const requestFullscreen = async (element: HTMLElement, videoElement?: HTMLVideoElement): Promise<void> => {
  // Sur iOS, utiliser webkitEnterFullscreen sur la vidéo directement
  if (isIOS() && videoElement) {
    const video = videoElement as ExtendedHTMLVideoElement
    if (video.webkitSupportsFullscreen && video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen()
      return
    }
  }
  
  // Desktop et Android
  const el = element as ExtendedHTMLElement
  if (el.requestFullscreen) {
    await el.requestFullscreen()
  } else if (el.webkitRequestFullscreen) {
    await el.webkitRequestFullscreen()
  }
}

const exitFullscreen = async (videoElement?: HTMLVideoElement): Promise<void> => {
  // Sur iOS, utiliser webkitExitFullscreen sur la vidéo
  if (isIOS() && videoElement) {
    const video = videoElement as ExtendedHTMLVideoElement
    if (video.webkitDisplayingFullscreen && video.webkitExitFullscreen) {
      video.webkitExitFullscreen()
      return
    }
  }
  
  const doc = document as ExtendedDocument
  if (doc.exitFullscreen) {
    await doc.exitFullscreen()
  } else if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen()
  }
}

const isVideoFullscreen = (videoElement?: HTMLVideoElement): boolean => {
  if (isIOS() && videoElement) {
    const video = videoElement as ExtendedHTMLVideoElement
    return video.webkitDisplayingFullscreen || false
  }
  return !!getFullscreenElement()
}

const addFullscreenChangeListener = (handler: () => void, videoElement?: HTMLVideoElement): (() => void) => {
  document.addEventListener('fullscreenchange', handler)
  document.addEventListener('webkitfullscreenchange', handler)
  
  // Sur iOS, écouter aussi les événements vidéo spécifiques
  if (videoElement) {
    videoElement.addEventListener('webkitbeginfullscreen', handler)
    videoElement.addEventListener('webkitendfullscreen', handler)
  }
  
  return () => {
    document.removeEventListener('fullscreenchange', handler)
    document.removeEventListener('webkitfullscreenchange', handler)
    if (videoElement) {
      videoElement.removeEventListener('webkitbeginfullscreen', handler)
      videoElement.removeEventListener('webkitendfullscreen', handler)
    }
  }
}

interface NextEpisodeInfo {
  id: string
  title: string
  seasonNumber: number
  episodeNumber: number
  thumbnail?: string
}

interface SimpleVideoPlayerProps {
  src: string
  title?: string
  subtitle?: string
  onClose: () => void
  poster?: string
  mediaId?: string // ID du film/épisode pour sauvegarder la position
  mediaType?: 'movie' | 'episode' // Type de média
  nextEpisode?: NextEpisodeInfo // Épisode suivant (pour les séries)
  onNextEpisode?: () => void // Callback pour passer à l'épisode suivant
}

interface AudioTrack {
  index: number
  language: string
  title?: string
  codec?: string
  hlsPlaylist?: string // 🆕 Pour les pistes audio pré-transcodées (ex: stream_1.m3u8)
}

interface SubtitleTrack {
  index: number
  language: string
  title?: string
  codec?: string
  forced?: boolean
  isDownloaded?: boolean // Pour les tracks téléchargés depuis OpenSubtitles
  sourceUrl?: string // URL de l'API pour les tracks téléchargés
  vttFile?: string // 🆕 Pour les sous-titres VTT pré-transcodés (ex: sub_fre_0.vtt)
}

// Extension pour audioTracks (supporté uniquement sur Safari/WebKit)
interface BrowserAudioTrack {
  enabled: boolean
  language: string
  label: string
}

interface VideoElementWithAudioTracks extends HTMLVideoElement {
  audioTracks?: {
    length: number
    [index: number]: BrowserAudioTrack
  }
}

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
  onNextEpisode
}: SimpleVideoPlayerProps) {
  const { user } = useAuth()
  const userId = user?.id
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const settingsMenuRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const preloaderRef = useRef<SegmentPreloader | null>(null)
  const retryCountRef = useRef(0)
  const maxRetries = 10
  const realDurationRef = useRef<number>(0) // Durée réelle du fichier
  
  // 🔧 FIX #1: Refs pour préserver la position lors des récupérations d'erreur
  const lastKnownPositionRef = useRef<number>(0)
  const isRecoveringRef = useRef<boolean>(false)
  
  // États du lecteur
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isRemuxing, setIsRemuxing] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [bufferReady, setBufferReady] = useState(false) // 🚦 Flag pour bloquer l'autoplay
  
  // 🔧 FIX #2: Tracker le temps maximum disponible (transcodé)
  const [maxSeekableTime, setMaxSeekableTime] = useState<number>(Infinity)
  const [seekWarning, setSeekWarning] = useState<string | null>(null)
  const [isPreTranscoded, setIsPreTranscoded] = useState<boolean>(false) // 🎯 PRÉ-TRANSCODÉ = seek illimité
  
  // Menu et pistes
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
  const [selectedAudio, setSelectedAudio] = useState(0)
  const [selectedSubtitle, setSelectedSubtitle] = useState<number | null>(null)
  const [isDownloadingSubtitles, setIsDownloadingSubtitles] = useState(false)
  const [subtitleOffset, setSubtitleOffset] = useState<number>(0) // Décalage en secondes pour synchroniser les sous-titres
  
  // États pour l'épisode suivant (style Netflix)
  const [showNextEpisodeUI, setShowNextEpisodeUI] = useState(false)
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(10) // Temps réel restant
  const [isNextEpisodeCancelled, setIsNextEpisodeCancelled] = useState(false) // Si l'utilisateur a annulé
  
  // Refs pour la gestion d'état
  const hideControlsTimeout = useRef<NodeJS.Timeout>()
  const currentVideoUrl = useRef(src)
  const isChangingTrack = useRef(false)
  const hasStartedPlaying = useRef(false)
  const bufferCheckIntervalRef = useRef<NodeJS.Timeout | null>(null) // 🔧 Pour nettoyer l'intervalle buffer
  const lastTimeRef = useRef(0) // 🔧 Pour détecter les vrais sauts (pas les faux positifs)

  // Extraire le filepath depuis l'URL
  const getFilepath = useCallback(() => {
    const urlParams = new URLSearchParams(src.split('?')[1] || '')
    return urlParams.get('path')
  }, [src])
  
  const getAudioTrack = useCallback(() => {
    const urlParams = new URLSearchParams(src.split('?')[1] || '')
    return urlParams.get('audio') || '0'
  }, [src])
  
  // 🔧 PHASE 4: Hook pour récupérer le statut du buffer adaptatif
  const { bufferStatus } = useBufferStatus(
    getFilepath(), 
    getAudioTrack(), 
    isPlaying && isRemuxing // Activer seulement pendant le HLS remuxing
  )

  // 🔧 PHASE 5: Hook pour la résilience réseau (reconnexion automatique)
  const { 
    isOnline, 
    connectionQuality, 
    isReconnecting,
    handleNetworkError,
    savePosition,
    getSavedPosition,
  } = useNetworkResilience({
    onReconnect: () => {
      console.log('[NETWORK] ✅ Reconnexion détectée, reprise de lecture...')
      const video = videoRef.current
      if (video && video.paused) {
        video.play().catch(() => {})
      }
    },
    onDisconnect: () => {
      console.log('[NETWORK] ❌ Déconnexion détectée')
      const video = videoRef.current
      if (video) {
        savePosition(video.currentTime)
      }
    },
  })

  // 🔧 PHASE 3: Hook pour charger ET sauvegarder la position de lecture
  const { initialPosition, markAsFinished } = usePlaybackPosition({
    mediaId: mediaId || null,
    currentTime,
    duration: realDurationRef.current || duration,
    enabled: !!mediaId, // Activer seulement si mediaId est fourni
    mediaType,
    userId
  })

  // 🔧 PHASE 3: Restaurer la position initiale une fois que la vidéo est prête (UNE SEULE FOIS)
  const hasRestoredPositionRef = useRef(false)
  
  useEffect(() => {
    const video = videoRef.current
    if (!video || initialPosition === 0 || !bufferReady || hasRestoredPositionRef.current) return

    // Attendre que le lecteur soit prêt et qu'on ait du buffer
    if (video.readyState >= 2 && buffered > 0) {
      console.log(`[PLAYBACK] ✅ Position restaurée une seule fois: ${initialPosition}s`)
      video.currentTime = initialPosition
      setCurrentTime(initialPosition)
      hasRestoredPositionRef.current = true // Marquer comme restauré
    }
  }, [initialPosition, bufferReady, buffered])
  
  // Réinitialiser le flag si le média change
  useEffect(() => {
    hasRestoredPositionRef.current = false
  }, [src])

  // 🔧 PHASE 4: Initialiser le preloader pour HLS
  useEffect(() => {
    // Vérifier si c'est du HLS
    if (src.includes('/api/hls')) {
      if (!preloaderRef.current) {
        preloaderRef.current = new SegmentPreloader({
          lookaheadSegments: 3, // Précharger 3 segments (6s)
          maxConcurrent: 2, // 2 requêtes parallèles max
        })
        preloaderRef.current.setBaseUrl(src)
        console.log('[PRELOADER] 🚀 Initialisé pour HLS')
      }
    }
    
    return () => {
      // Cleanup au démontage
      if (preloaderRef.current) {
        preloaderRef.current.reset()
      }
    }
  }, [src])

  // 🎬 Reset de l'état épisode suivant quand la source change
  useEffect(() => {
    setShowNextEpisodeUI(false)
    setIsNextEpisodeCancelled(false)
    setNextEpisodeCountdown(10)
  }, [src])

  // Charger les infos des pistes et la durée
  useEffect(() => {
    const filepath = getFilepath()
    
    if (!filepath) return

    // Récupérer la durée (optionnel)
    fetch(`/api/video-duration?path=${encodeURIComponent(filepath)}`)
      .then(res => {
        if (!res.ok) throw new Error('API video-duration non disponible')
        return res.json()
      })
      .then(data => {
        if (data.duration > 0) {
          realDurationRef.current = data.duration // Sauvegarder la vraie durée
          setDuration(data.duration)
        }
      })
      .catch(() => {
        // API durée non disponible, récupération depuis la vidéo
      })
    
    // Récupérer les pistes (optionnel)
    fetch(`/api/media-info?path=${encodeURIComponent(filepath)}`)
      .then(res => {
        if (!res.ok) throw new Error('API media-info non disponible')
        return res.json()
      })
      .then(data => {
        setAudioTracks(data.audioTracks || [])
        setSubtitleTracks(data.subtitleTracks || [])
        
        // Sélectionner la première piste audio par défaut
        if (data.audioTracks?.length > 0) {
          setSelectedAudio(0)
        }
      })
      .catch(err => {
        console.log('⚠️ API pistes non disponible, pas de changement de langue')
      })
  }, [getFilepath, src])

  // Pour les MP4 directs : s'assurer que la première piste audio est sélectionnée et détecter les sous-titres natifs
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    
    // Seulement pour les fichiers MP4 directs (pas HLS)
    const isDirectMP4 = !src.includes('/api/hls') && !src.includes('/api/hls-v2')
    if (!isDirectMP4) return
    
    // Attendre que la vidéo soit chargée
    const handleLoadedMetadata = () => {
      // Vérification des pistes audio natives pour MP4 directs
      
      // S'assurer que le volume est à 1 et non muet
      if (video.volume === 0) {
        video.volume = 1
        setVolume(1)
      }
      if (video.muted) {
        video.muted = false
        setIsMuted(false)
      }
      
      // Vérifier les pistes audio natives du browser
      const videoWithAudioTracks = video as VideoElementWithAudioTracks
      if ('audioTracks' in videoWithAudioTracks && videoWithAudioTracks.audioTracks && videoWithAudioTracks.audioTracks.length > 0) {
        // Activer la première piste si elle existe
        const firstTrack = videoWithAudioTracks.audioTracks[0]
        if (firstTrack && !firstTrack.enabled) {
          firstTrack.enabled = true
        }
      } else {
      }
      
      // 📝 Détecter les sous-titres natifs (mov_text intégrés dans le MP4)
      // ⚠️ IMPORTANT: Les textTracks peuvent ne pas être immédiatement disponibles après un remuxage
      // On vérifie immédiatement ET après un court délai
      const checkTextTracks = () => {
        const textTracks = Array.from(video.textTracks)
        if (textTracks.length > 0) {
          console.log(`📝 [CHECK] ${textTracks.length} pistes sous-titres natives détectées`)
          textTracks.forEach((track, i) => {
            const cuesCount = track.cues ? track.cues.length : 0
            const activeCuesCount = track.activeCues ? track.activeCues.length : 0
            console.log(`   [${i}] ${track.language || '?'} - mode: ${track.mode} - label: ${track.label} - cues: ${cuesCount} (actifs: ${activeCuesCount})`)
          })
          
          // ⚠️ CRITIQUE: S'assurer qu'une seule piste est active à la fois
          // Plusieurs pistes en mode 'showing' peuvent empêcher l'affichage
          const showingTracks = textTracks.filter(t => t.mode === 'showing')
          if (showingTracks.length > 1) {
            console.warn(`⚠️ ${showingTracks.length} pistes en mode 'showing' simultanément, désactivation des doublons`)
            // Garder seulement la première piste en 'showing', désactiver les autres
            for (let i = 1; i < showingTracks.length; i++) {
              showingTracks[i].mode = 'disabled'
            }
          }
          
          // Si on a des sous-titres natifs mais pas encore de correspondance avec subtitleTracks,
          // synchroniser les deux listes
          if (subtitleTracks.length === 0 && textTracks.length > 0) {
            // Les sous-titres seront détectés via /api/media-info, mais on peut déjà les activer si default
            const defaultTrack = textTracks.find(t => t.mode === 'showing' || t.mode === 'hidden')
            if (defaultTrack && defaultTrack.mode !== 'showing') {
              // S'assurer qu'une seule piste est active
              textTracks.forEach(t => {
                if (t !== defaultTrack) t.mode = 'disabled'
              })
              defaultTrack.mode = 'showing'
            }
          }
        }
      }
      
      checkTextTracks()
      
      // ⚠️ CRITIQUE: Vérifier périodiquement qu'une seule piste est active
      // Certains navigateurs peuvent réactiver plusieurs pistes automatiquement
      const subtitleCheckInterval = setInterval(() => {
        const textTracks = Array.from(video.textTracks)
        const showingTracks = textTracks.filter(t => t.mode === 'showing')
        if (showingTracks.length > 1) {
          // Garder seulement la première piste active
          for (let i = 1; i < showingTracks.length; i++) {
            showingTracks[i].mode = 'disabled'
          }
        }
      }, 1000) // Vérifier toutes les secondes
      
      // Nettoyer l'intervalle quand la vidéo est démontée
      return () => {
        clearInterval(subtitleCheckInterval)
      }
    }
    
    if (video.readyState >= 1) {
      // Vidéo déjà chargée
      handleLoadedMetadata()
    } else {
      // Attendre le chargement
      video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      }
    }
  }, [src, audioTracks, subtitleTracks])

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

  // 🔧 FIX #3: Synchroniser isPlaying avec l'état réel du video
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    
    const syncPlayState = () => {
      const actuallyPlaying = !video.paused && !video.ended && video.readyState > 2
      if (actuallyPlaying !== isPlaying) {
        setIsPlaying(actuallyPlaying)
      }
    }
    
    // Vérifier périodiquement (backup)
    const syncInterval = setInterval(syncPlayState, 1000)
    
    // Événements directs
    video.addEventListener('playing', syncPlayState)
    video.addEventListener('pause', syncPlayState)
    video.addEventListener('ended', syncPlayState)
    video.addEventListener('waiting', syncPlayState)
    
    return () => {
      clearInterval(syncInterval)
      video.removeEventListener('playing', syncPlayState)
      video.removeEventListener('pause', syncPlayState)
      video.removeEventListener('ended', syncPlayState)
      video.removeEventListener('waiting', syncPlayState)
    }
  }, [isPlaying])

  // 🎬 FIX: Gestion de la fin de vidéo - auto-play épisode suivant
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleVideoEnded = () => {
      console.log('[PLAYER] 🏁 Vidéo terminée')
      
      // Marquer comme terminé (supprimer la position)
      if (mediaId) {
        markAsFinished()
      }
      
      // Si épisode suivant disponible et pas annulé par l'utilisateur, le lancer
      if (nextEpisode && onNextEpisode && !isNextEpisodeCancelled) {
        console.log('[PLAYER] ➡️ Passage automatique à l\'épisode suivant:', nextEpisode.title)
        onNextEpisode()
      }
    }

    video.addEventListener('ended', handleVideoEnded)
    return () => video.removeEventListener('ended', handleVideoEnded)
  }, [mediaId, nextEpisode, onNextEpisode, markAsFinished, isNextEpisodeCancelled])

  // 🔧 FIX #3: Gérer spécifiquement le fullscreen (compatible Safari et iOS)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (isVideoFullscreen(videoRef.current || undefined)) {
        // En fullscreen : forcer la disparition des contrôles après 3s
        setTimeout(() => {
          const video = videoRef.current
          if (video && !video.paused) {
            setShowControls(false)
          }
        }, 3000)
      }
    }
    
    const cleanup = addFullscreenChangeListener(handleFullscreenChange, videoRef.current || undefined)
    return cleanup
  }, [])

  // 🔧 FIX #3b: Masquer automatiquement les contrôles quand la vidéo joue
  useEffect(() => {
    if (isPlaying && !showSettingsMenu) {
      // Démarrer le timer pour masquer les contrôles
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current)
      }
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
    
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current)
      }
    }
  }, [isPlaying, showSettingsMenu])

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!videoRef.current) return
      
      switch(e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault()
          handlePlayPause()
          break
        case 'arrowleft':
          e.preventDefault()
          handleSkip(-10)
          break
        case 'arrowright':
          e.preventDefault()
          handleSkip(10)
          break
        case 'f':
          e.preventDefault()
          handleFullscreen()
          break
        case 'm':
          e.preventDefault()
          handleVolumeToggle()
          break
        case 'escape':
          if (showSettingsMenu) {
            setShowSettingsMenu(false)
          } else if (isVideoFullscreen(videoRef.current || undefined)) {
            exitFullscreen(videoRef.current || undefined)
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [showSettingsMenu])

  // Initialiser la vidéo
  useEffect(() => {
    if (!videoRef.current) return

    const video = videoRef.current
    
    // Ne pas recharger si on est en train de changer de piste
    if (isChangingTrack.current) {
      isChangingTrack.current = false
      return
    }
    
    
    // Nettoyer l'instance HLS précédente (SANS tuer FFmpeg global)
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    
    // 🔧 IMPORTANT: On ne tue PAS FFmpeg ici, juste HLS.js
    // FFmpegManager va automatiquement gérer les sessions expirées
    
    // Vérifier si c'est une URL HLS
    const isHLS = currentVideoUrl.current.includes('playlist=true') || currentVideoUrl.current.includes('.m3u8')
    
    if (isHLS) {
      // Utiliser HLS.js pour les navigateurs non-Safari
      if (Hls.isSupported()) {
        // 🎯 PHASE 5: Configuration OPTIMISÉE avec sélection intelligente
        const hlsConfig = selectHlsConfig({
          isFirstLoad: true,
          connectionQuality: connectionQuality as 'excellent' | 'good' | 'poor',
        })
        const hls = new Hls(hlsConfig)
        hlsRef.current = hls
        
        // 🔧 FIX #1: Ne PAS reset à 0 si on a une position sauvegardée (ex: reprise de lecture)
        // Seulement reset si c'est vraiment une nouvelle vidéo
        if (lastKnownPositionRef.current === 0 && initialPosition === 0) {
        video.currentTime = 0
        video.load() // Force reset de l'état interne du <video>
        } else {
          console.log(`📍 Position existante détectée: ${lastKnownPositionRef.current.toFixed(1)}s ou initialPosition: ${initialPosition}s`)
        }
        
        hls.loadSource(currentVideoUrl.current)
        hls.attachMedia(video)
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          retryCountRef.current = 0
          
          // 🔧 FIX #1: Restaurer la position si on en avait une (ex: après changement de piste)
          if (lastKnownPositionRef.current > 5 && video.currentTime < 5) {
            console.log(`📍 Restauration position après manifest: ${lastKnownPositionRef.current.toFixed(1)}s`)
            video.currentTime = lastKnownPositionRef.current
          }
          
          // 🧹 Nettoyer l'ancien intervalle si existant
          if (bufferCheckIntervalRef.current) {
            clearInterval(bufferCheckIntervalRef.current)
            bufferCheckIntervalRef.current = null
          }
          
          // 🧠 BUFFER ADAPTATIF: check FFmpeg + buffer toutes les 250ms
          
          const filepath = getFilepath()
          let hasStarted = false
          let checkCount = 0
          
          // Fonction pour récupérer l'état FFmpeg
          const getFFmpegStatus = async () => {
            if (!filepath) return null
            try {
              const res = await fetch(`/api/hls/status?path=${encodeURIComponent(filepath)}`)
              if (!res.ok) return null
              const data = await res.json()
              return data
            } catch {
              return null
            }
          }
          
          bufferCheckIntervalRef.current = setInterval(async () => {
            if (hasStarted) {
              if (bufferCheckIntervalRef.current) {
                clearInterval(bufferCheckIntervalRef.current)
                bufferCheckIntervalRef.current = null
              }
              return
            }
            
            checkCount++
            
            // Buffer local
            let bufferedSeconds = 0
            if (video.buffered.length > 0) {
              bufferedSeconds = video.buffered.end(0) - video.buffered.start(0)
            }
            
            // État FFmpeg (check au 1er appel PUIS toutes les secondes)
            let ffmpegStatus = null
            if (checkCount === 1 || checkCount % 4 === 0) {
              ffmpegStatus = await getFFmpegStatus()
            }
            
            const segmentsReady = ffmpegStatus?.segmentsReady || 0
            const isComplete = ffmpegStatus?.isComplete || false
            const preTranscodedStatus = ffmpegStatus?.preTranscoded || false
            
            // 🎯 Mettre à jour l'état pré-transcodé pour permettre le scrubbing complet
            if (preTranscodedStatus && !isPreTranscoded) {
              setIsPreTranscoded(true)
              setMaxSeekableTime(Infinity) // Seek illimité pour pré-transcodé
              console.log('[PLAYER] 🎯 Fichier pré-transcodé détecté - scrubbing complet activé')
            }
            
            // 🧠 DÉCISION INTELLIGENTE
            // - Si PRÉ-TRANSCODÉ : démarrer dès qu'on a 2s de buffer (seek instantané disponible)
            // - Si transcodage complet en temps réel : lancer dès qu'on a 10s
            // - Sinon : attendre 15 segments OU 30s de buffer
            let canStart = false
            if (preTranscodedStatus) {
              // Fichier pré-transcodé = démarrage ultra-rapide
              canStart = bufferedSeconds >= 2
              if (checkCount % 4 === 0 && !canStart) {
                console.log(`[BUFFER] Pré-transcodé, attente buffer: ${bufferedSeconds.toFixed(1)}s/2s`)
              }
            } else if (isComplete) {
              canStart = bufferedSeconds >= 10
            } else {
              canStart = segmentsReady >= 15 || bufferedSeconds >= 30
            }
            
            // Log toutes les secondes
            if (checkCount % 4 === 0) {
            }
            
            if (canStart) {
              hasStarted = true
              if (bufferCheckIntervalRef.current) {
                clearInterval(bufferCheckIntervalRef.current)
                bufferCheckIntervalRef.current = null
              }
              setBufferReady(true)
              
              // Muter temporairement pour autoplay
              const wasMuted = video.muted
              video.muted = true
              
              video.play().then(() => {
                setIsPlaying(true)
                setIsLoading(false)
                setTimeout(() => { video.muted = wasMuted }, 100)
              }).catch((err) => {
                console.warn('⚠️ Autoplay bloqué:', err.message)
                video.muted = wasMuted
                setIsLoading(false)
              })
            }
          }, 250) // Check toutes les 250ms
        })
        
        // 🛡️ PROTECTION: Surveillance légère du buffer (seuil d'urgence uniquement)
        // HLS.js gère déjà le buffer automatiquement, on intervient seulement en cas critique
        let bufferWatchdog: NodeJS.Timeout | null = null
        
        hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
          // Log silencieux (décommenter pour debug)
          // const frag = data.frag
          // console.log(`📦 Fragment ${frag.sn} | start: ${frag.start.toFixed(2)}s`)
        })
        
        // 🛡️ DÉSACTIVÉ: Buffer Watchdog trop agressif, HLS.js gère lui-même
        // Le watchdog créait des pause/reprise en boucle qui surchargeaient le CPU
        // HLS.js a déjà son propre système de buffer management intégré
        
        // const startBufferWatchdog = () => {
        //   // DÉSACTIVÉ
        // }
        
        // video.addEventListener('play', startBufferWatchdog, { once: true })
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('❌ Erreur HLS:', data.type, data.details)
          
          // 🔧 FIX #1: TOUJOURS sauvegarder la position AVANT toute action
          const savedPosition = lastKnownPositionRef.current || video.currentTime || 0
          const wasPlaying = !video.paused
          
          if (savedPosition > 5) {
            console.log(`📍 Position sauvegardée avant récupération: ${savedPosition.toFixed(1)}s`)
          }
          
          if (data.fatal) {
            switch(data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('🔄 Erreur réseau détectée')
                
                // ✅ RETRY GRADUEL : 1s, 3s, 5s, 10s
                const retryDelays = [1000, 3000, 5000, 10000]
                const maxNetworkRetries = retryDelays.length
                
                if (retryCountRef.current >= maxNetworkRetries) {
                  console.error(`❌ Maximum de tentatives atteint (${maxNetworkRetries})`)
                  setError(`Impossible de charger la vidéo après plusieurs tentatives. Position sauvegardée: ${formatTime(savedPosition)}`)
                  setIsLoading(false)
                  return
                }
                
                const delay = retryDelays[retryCountRef.current]
                retryCountRef.current++
                console.log(`🔄 Retry ${retryCountRef.current}/${maxNetworkRetries} dans ${delay}ms`)
                
                // ✅ NE PAS détruire HLS.js, juste recharger la source
                setTimeout(() => {
                  console.log('🔄 Rechargement...')
                  if (data.details === 'levelLoadError' || data.details === 'manifestLoadError') {
                    hls.loadSource(currentVideoUrl.current)
                  } else {
                    hls.startLoad()
                  }
                }, delay)
                break
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('🔄 Tentative de récupération média...')
                hls.recoverMediaError()
                break
              default:
                // 🔧 FIX #1: Pour les erreurs fatales, préserver la position
                console.log(`🔄 Rechargement complet dans 3s... (position: ${savedPosition.toFixed(1)}s)`)
                isRecoveringRef.current = true
                
                setTimeout(() => {
                  hls.destroy()
                  
                  // 🔧 PHASE 5: Config de récupération avec position sauvegardée
                  const recoveryConfig = selectHlsConfig({
                    isRecovery: true,
                    startPosition: savedPosition,
                  })
                  const newHls = new Hls(recoveryConfig)
                  hlsRef.current = newHls
                  
                  // 🔧 FIX #1: Ne PAS reset à 0 si on a une position sauvegardée
                  if (savedPosition <= 5) {
                  video.currentTime = 0
                  video.load()
                  }
                  
                  newHls.loadSource(currentVideoUrl.current)
                  newHls.attachMedia(video)
                  
                  // 🔧 FIX #1: Restaurer la position après rechargement
                  newHls.on(Hls.Events.MANIFEST_PARSED, () => {
                    console.log(`✅ Manifest rechargé, restauration position: ${savedPosition.toFixed(1)}s`)
                    if (video && savedPosition > 5) {
                      video.currentTime = savedPosition
                      if (wasPlaying) {
                        video.play().catch(() => {})
                      }
                    }
                    retryCountRef.current = 0
                    setTimeout(() => {
                      isRecoveringRef.current = false
                    }, 2000)
                  })
                }, 3000)
                break
            }
          } else if (data.details === 'bufferStalledError') {
            console.log('⏳ Buffer en attente du transcodage...')
          } else if (data.details === 'fragLoadError' || data.details === 'fragLoadTimeOut') {
            console.log(`⏳ Segment non prêt, FFmpeg en cours de transcodage...`)
            // Ne rien faire, HLS.js va réessayer automatiquement
          } else if (data.details === 'levelLoadError') {
            // 🔧 Erreur non-fatale de chargement de playlist (souvent 500)
            console.warn('⚠️ Erreur chargement playlist (non-fatal):', data.response?.code)
            
            if (data.response?.code === 500) {
              console.warn('⚠️ Serveur retourne 500 - possible FFmpeg mort')
            }
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari support natif HLS
        video.src = currentVideoUrl.current
        video.load()
        // Pour Safari, on doit aussi attendre le buffer (pas de HLS.js pour gérer)
        // TODO: Implémenter l'attente de buffer pour Safari
        setBufferReady(true) // Temporairement débloquer
      } else {
        console.error('❌ HLS non supporté sur ce navigateur')
        setError('Format vidéo non supporté sur ce navigateur')
        return
      }
    } else {
      // Vidéo normale (MP4) - pas besoin d'attendre
      setBufferReady(true) // ✅ Débloquer immédiatement pour MP4
      video.src = currentVideoUrl.current
      video.load()
    }
    
    // Essayer de jouer dès que possible
    const tryAutoplay = async () => {
      // 🚦 BLOQUER si le buffer n'est pas prêt (pour HLS uniquement)
      const isHLS = src.includes('/api/hls')
      if (isHLS && !bufferReady) {
        return
      }
      
      try {
        // Attendre un peu si la vidéo n'est pas prête
        if (video.readyState < 2) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        const playPromise = video.play()
        hasStartedPlaying.current = true
        
        if (playPromise !== undefined) {
          await playPromise
        }
        
        // Forcer la mise à jour de l'UI immédiatement
        setIsPlaying(true)
        setIsLoading(false)
      } catch (err: any) {
        console.log('⏸️ Autoplay bloqué:', err.message)
        setIsLoading(false)
        // Afficher le bouton play
      }
    }
    
    // ✅ Le buffer check intelligent gère tout maintenant (pas de timeout fixe)
    
    const handleCanPlay = () => {
      // ⚠️ NE PAS appeler tryAutoplay ici pour HLS
      // Le buffer check intelligent le fera au bon moment
      const isHLS = src.includes('/api/hls')
      if (!isHLS) {
        setIsLoading(false)
        tryAutoplay()
      }
    }
    
    const handleCanPlayThrough = () => {
      // ⚠️ NE PAS appeler tryAutoplay ici pour HLS
      // Le buffer check intelligent le fera au bon moment
      const isHLS = src.includes('/api/hls')
      if (!isHLS && !isPlaying) {
        tryAutoplay()
      }
    }
    
    const handlePlay = () => {
      hasStartedPlaying.current = true
      setIsPlaying(true)
      setIsLoading(false)
    }
    
    const handlePause = () => {
      setIsPlaying(false)
    }
    
    const handleTimeUpdate = () => {
      const currentPos = video.currentTime
      const lastTime = lastTimeRef.current
      
      // 🔧 FIX #1: Sauvegarder la position valide (> 1s pour éviter les faux positifs)
      if (currentPos > 1 && !isRecoveringRef.current) {
        lastKnownPositionRef.current = currentPos
      }
      
      // 🔍 DEBUG: Détecter les VRAIS sauts anormaux (pas les initialisations)
      if (Math.abs(currentPos - lastTime) > 10 && lastTime > 0.1 && !isSeeking && !isRecoveringRef.current) {
        console.warn(`⚠️ SAUT DÉTECTÉ: ${lastTime.toFixed(1)}s → ${currentPos.toFixed(1)}s (delta: ${(currentPos - lastTime).toFixed(1)}s)`)
        
        // 🔧 FIX #1: Si c'est un reset non voulu vers 0, restaurer la position
        if (currentPos < 5 && lastKnownPositionRef.current > 30) {
          console.log(`🔄 RÉCUPÉRATION: Restauration vers ${lastKnownPositionRef.current.toFixed(1)}s`)
          isRecoveringRef.current = true
          video.currentTime = lastKnownPositionRef.current
          setTimeout(() => {
            isRecoveringRef.current = false
          }, 2000)
          return // Ne pas mettre à jour l'état avec la mauvaise position
        }
      }
      
      // Mettre à jour la référence
      lastTimeRef.current = currentPos
      setCurrentTime(currentPos)
      
      // Ne PAS écraser la durée si on a déjà la vraie durée depuis l'API
      if ((!duration || duration === 0) && !realDurationRef.current && isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration)
      }
      
      // Buffer - utiliser la vraie durée si disponible
      const actualDuration = realDurationRef.current || video.duration
      if (video.buffered.length > 0 && actualDuration > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1)
        setBuffered((bufferedEnd / actualDuration) * 100)
        
        // 🔧 FIX #2: Calculer le temps max seekable (dernier segment disponible + marge)
        // Le temps seekable = dernier buffer + 10s de marge (segments en cours de chargement)
        // Ne mettre à jour que si la différence est significative (>5s) pour éviter les re-renders inutiles
        const newMaxSeekable = bufferedEnd + 10
        if (Math.abs(newMaxSeekable - maxSeekableTime) > 5) {
          setMaxSeekableTime(newMaxSeekable)
        }
      }
      
      // 🔧 PHASE 4: Mise à jour du preloader (segments de 2s)
      if (preloaderRef.current && currentPos > 0) {
        const currentSegmentIndex = Math.floor(currentPos / 2) // Segments de 2s
        preloaderRef.current.updateCurrentSegment(currentSegmentIndex)
      }
      
      // 🎬 Épisode suivant: Afficher le UI quand on arrive à la fin (30s avant la fin)
      const totalDuration = realDurationRef.current || video.duration
      if (nextEpisode && onNextEpisode && !isNextEpisodeCancelled && totalDuration > 0) {
        const timeRemaining = Math.max(0, totalDuration - currentPos)
        
        // Afficher l'UI 30s avant la fin
        if (timeRemaining <= 30 && timeRemaining > 0) {
          if (!showNextEpisodeUI) {
            setShowNextEpisodeUI(true)
          }
          // Mettre à jour le countdown avec le temps réel restant (arrondi)
          setNextEpisodeCountdown(Math.ceil(timeRemaining))
        }
        
        // Masquer si on recule avant les 30 dernières secondes
        if (timeRemaining > 30 && showNextEpisodeUI) {
          setShowNextEpisodeUI(false)
        }
      }
    }
    
    const handleLoadedMetadata = () => {
      // Ne PAS écraser la durée si on a déjà la vraie durée depuis l'API
      if (!realDurationRef.current && isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration)
      }
    }
    
    const handleLoadedData = () => {
      // ⚠️ NE PAS appeler tryAutoplay ici pour HLS
      // Le buffer check intelligent le fera au bon moment
      const isHLS = src.includes('/api/hls')
      if (!isHLS && !isPlaying && video.readyState >= 3) {
        tryAutoplay()
      }
    }
    
    const handleWaiting = () => setIsLoading(true)
    const handlePlaying = () => setIsLoading(false)
    const handleSeeking = () => setIsSeeking(true)
    const handleSeeked = () => setIsSeeking(false)
    
    const handleError = () => {
      if (video.error) {
        console.error('❌ Erreur vidéo:', video.error)
        let msg = 'Erreur de lecture'
        
        switch(video.error.code) {
          case 1:
            msg = 'Chargement interrompu'
            break
          case 2:
            msg = 'Erreur réseau - Vérifiez votre connexion'
            break
          case 3:
            msg = 'Erreur de décodage - Format vidéo incompatible'
            break
          case 4:
            // ⚠️ Limiter les tentatives pour éviter boucle infinie
            if (retryCountRef.current >= 3) {
              console.error('❌ Échec après 3 tentatives')
              msg = 'Format vidéo non supporté. Le transcodage a échoué.'
              setError(msg)
              setIsLoading(false)
              return
            }
            
            retryCountRef.current++
            msg = 'Format non supporté - Transcodage en cours...'
            
            // Réessayer après un délai
            setTimeout(() => {
              if (video.src && !video.src.includes('blob:')) { // ⚠️ Ne pas recharger si URL blob corrompue
                video.load()
                tryAutoplay()
              } else {
                console.error('❌ URL blob invalide, arrêt des tentatives')
                setError('Erreur de lecture vidéo. Veuillez réessayer.')
                setIsLoading(false)
              }
            }, 2000)
            return // Ne pas afficher l'erreur tout de suite
        }
        
        setError(msg)
      }
      setIsLoading(false)
    }

    // Ajouter les événements
    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('canplaythrough', handleCanPlayThrough)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('playing', handlePlaying)
    video.addEventListener('seeking', handleSeeking)
    video.addEventListener('seeked', handleSeeked)
    video.addEventListener('error', handleError)

    return () => {
      // 🧹 Nettoyer l'intervalle buffer check
      if (bufferCheckIntervalRef.current) {
        clearInterval(bufferCheckIntervalRef.current)
        bufferCheckIntervalRef.current = null
      }
      // Nettoyer HLS.js
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('canplaythrough', handleCanPlayThrough)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('waiting', handleWaiting)
      video.removeEventListener('playing', handlePlaying)
      video.removeEventListener('seeking', handleSeeking)
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('error', handleError)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]) // 🔧 FIX: Dépendre uniquement de src, PAS de duration (sinon boucle infinie)

  // Changement de langue audio DYNAMIQUE
  const handleAudioChange = useCallback((track: AudioTrack, idx: number) => {
    if (!videoRef.current || selectedAudio === idx) {
      setShowSettingsMenu(false)
      return
    }
    
    
    const video = videoRef.current
    const filepath = getFilepath()
    
    if (!filepath) return
    
    // Vérifier si c'est un MP4 direct (avec pistes audio intégrées)
    const isDirectMP4 = !src.includes('/api/hls') && !src.includes('/api/hls-v2')
    
    if (isDirectMP4) {
      // Pour MP4 directs : utiliser les audioTracks natifs du navigateur OU remuxer via API
      
      // Vérifier si le navigateur supporte audioTracks (Safari/WebKit uniquement)
      const videoWithAudioTracks = video as VideoElementWithAudioTracks
      if ('audioTracks' in videoWithAudioTracks && videoWithAudioTracks.audioTracks && videoWithAudioTracks.audioTracks.length > 0) {
        // Utiliser l'API native audioTracks (Safari)
        
        // Désactiver toutes les pistes audio d'abord
        for (let i = 0; i < videoWithAudioTracks.audioTracks.length; i++) {
          const t = videoWithAudioTracks.audioTracks[i]
          if (t) {
            t.enabled = false
          }
        }
        
        // Activer la piste correspondante
        const nativeTrack = videoWithAudioTracks.audioTracks[idx]
        if (nativeTrack) {
          nativeTrack.enabled = true
          setSelectedAudio(idx)
          setShowSettingsMenu(false)
        } else {
          const availableTracks: Array<{ index: number; language: string; label: string; enabled: boolean }> = []
          for (let i = 0; i < videoWithAudioTracks.audioTracks.length; i++) {
            const t = videoWithAudioTracks.audioTracks[i]
            if (t) {
              availableTracks.push({
                index: i,
                language: t.language,
                label: t.label,
                enabled: t.enabled
              })
            }
          }
        }
      } else {
        // Fallback: le navigateur ne supporte pas audioTracks (Chrome/Firefox)
        // Utiliser l'API /api/stream-audio pour remuxer avec la piste sélectionnée
        
        const currentPos = video.currentTime
        const wasPlaying = !video.paused
        
        // Construire la nouvelle URL avec remuxage
        const newUrl = `/api/stream-audio?path=${encodeURIComponent(filepath)}&audioTrack=${track.index}`
        
        
        // Marquer qu'on change de piste
        isChangingTrack.current = true
        currentVideoUrl.current = newUrl
        setSelectedAudio(idx)
        setShowSettingsMenu(false)
        setIsLoading(true)
        setIsRemuxing(true) // Indiquer qu'on est en train de remuxer
        
        // ⚠️ CRITIQUE: Sauvegarder la position AVANT de changer la source
        // car video.load() va réinitialiser currentTime à 0
        const savedPosition = currentPos
        
        // Changer la source de la vidéo
        video.src = newUrl
        video.load()
        
        // ⚠️ IMPORTANT: S'assurer que currentTime est bien à 0 après load()
        // pour éviter que le navigateur essaie de restaurer une ancienne position
        video.currentTime = 0
        
        // Gérer les erreurs de chargement
        const errorHandler = () => {
          console.error(`❌ Erreur chargement vidéo remuxée: ${newUrl}`)
          const error = video.error
          let errorMessage = 'Erreur lors du changement de langue audio.'
          
          if (error) {
            switch (error.code) {
              case MediaError.MEDIA_ERR_ABORTED:
                errorMessage = 'Changement de langue annulé.'
                break
              case MediaError.MEDIA_ERR_NETWORK:
                errorMessage = 'Erreur réseau lors du remuxage. Le fichier est peut-être trop volumineux.'
                break
              case MediaError.MEDIA_ERR_DECODE:
                errorMessage = 'Erreur de décodage. Le fichier remuxé est peut-être corrompu.'
                break
              case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = 'Format non supporté. Veuillez réessayer.'
                break
              default:
                errorMessage = 'Erreur lors du changement de langue audio. Le remuxage a peut-être échoué.'
            }
          }
          
          setError(errorMessage)
              setIsLoading(false)
              setIsRemuxing(false)
              isChangingTrack.current = false
          
          // Restaurer l'URL précédente en cas d'erreur
          if (currentVideoUrl.current !== src) {
            video.src = src
            video.load()
          }
        }
        video.addEventListener('error', errorHandler, { once: true })
        
        // Gérer les erreurs HTTP (404, 500, etc.) avant même que la vidéo ne charge
        // On va faire une requête HEAD pour vérifier que l'API répond correctement
        fetch(newUrl, { method: 'HEAD' })
          .then((response) => {
            if (!response.ok) {
              // Erreur HTTP (404, 500, etc.)
              let errorMessage = 'Erreur lors du remuxage.'
              if (response.status === 404) {
                errorMessage = 'Fichier non trouvé. Vérifiez que le fichier existe.'
              } else if (response.status === 500) {
                errorMessage = 'Erreur serveur lors du remuxage. Le fichier est peut-être trop volumineux ou corrompu.'
              } else if (response.status === 408 || response.status === 504) {
                errorMessage = 'Le remuxage prend trop de temps. Le fichier est peut-être trop volumineux.'
              } else {
                errorMessage = `Erreur ${response.status} lors du remuxage.`
              }
              
              console.error(`❌ Erreur HTTP ${response.status} pour ${newUrl}`)
              setError(errorMessage)
              setIsLoading(false)
              setIsRemuxing(false)
              isChangingTrack.current = false
              
              // Restaurer l'URL précédente
              if (currentVideoUrl.current !== src) {
                video.src = src
                video.load()
              }
            }
          })
          .catch((err) => {
            // Erreur réseau ou autre
            console.error('❌ Erreur réseau lors de la vérification:', err)
            // Ne pas bloquer, laisser la vidéo essayer de charger
            // (peut-être que c'est juste un problème de CORS ou autre)
          })
        
        // Restaurer la position après chargement complet des métadonnées
        // On attend que la durée soit disponible pour pouvoir naviguer correctement
        let restoreAttempted = false
        let restoreAttempts = 0
        const maxRestoreAttempts = 50 // 5 secondes max (50 * 100ms)
        
        const restorePlayback = () => {
          if (restoreAttempted) return // Éviter les appels multiples
          
          restoreAttempts++
          
          // Attendre que la durée soit disponible ET que la vidéo soit prête
          if (video.duration && isFinite(video.duration) && video.duration > 0 && video.readyState >= 2) {
            restoreAttempted = true
            
            // Retirer le handler d'erreur si tout va bien
            video.removeEventListener('error', errorHandler)
            
            // Restaurer la position (utiliser savedPosition au lieu de currentPos)
            // car currentPos pourrait avoir été réinitialisé à 0 par video.load()
            const safePos = Math.min(savedPosition, video.duration - 0.1)
            
            // ⚠️ CRITIQUE: S'assurer que la vidéo est vraiment prête avant de changer currentTime
            // Parfois currentTime se réinitialise à 0 si on le change trop tôt
            if (video.readyState >= 3) {
              // Vidéo a assez de données, on peut directement seek
              video.currentTime = safePos
            } else {
              // Vidéo pas encore assez chargée, attendre un peu
              setTimeout(() => {
                video.currentTime = safePos
              }, 100)
            }
            
            // Attendre que la position soit vraiment restaurée avant de reprendre la lecture
            let seekedFired = false
            const seekedHandler = () => {
              if (seekedFired) return
              seekedFired = true
              video.removeEventListener('seeked', seekedHandler)
              
              // Vérifier que la position est bien restaurée
              const actualPos = video.currentTime
              const diff = Math.abs(actualPos - safePos)
              
              if (diff > 1) {
                // Position pas assez proche, réessayer
                console.warn(`⚠️ Position incorrecte: ${actualPos.toFixed(1)}s (attendu: ${safePos.toFixed(1)}s), réessai...`)
                video.currentTime = safePos
                // Réattendre seeked
                video.addEventListener('seeked', seekedHandler, { once: true })
                return
              }
              
              
              if (wasPlaying) {
                // Petit délai avant de reprendre la lecture pour être sûr
                setTimeout(() => {
                  video.play().catch((err) => {
                    console.error('❌ Erreur play après restauration:', err)
                  })
                }, 100)
              }
              setIsLoading(false)
              setIsRemuxing(false) // Remuxage terminé
            }
            video.addEventListener('seeked', seekedHandler, { once: true })
            
            // Timeout de sécurité pour le seeked (si seeked ne se déclenche pas)
            setTimeout(() => {
              if (!seekedFired) {
                const actualPos = video.currentTime
                console.warn(`⚠️ Seeked non déclenché, position actuelle: ${actualPos.toFixed(1)}s`)
                // Forcer la restauration une dernière fois
                if (Math.abs(actualPos - safePos) > 1) {
                  video.currentTime = safePos
                  // Attendre encore un peu
                  setTimeout(() => {
                    setIsLoading(false)
                    setIsRemuxing(false)
                    if (wasPlaying) {
                      video.play().catch(() => {})
                    }
                  }, 500)
                } else {
                  setIsLoading(false)
                  setIsRemuxing(false)
                  if (wasPlaying) {
                    video.play().catch(() => {})
                  }
                }
              }
            }, 3000)
          } else if (restoreAttempts < maxRestoreAttempts) {
            // Si la durée n'est pas encore disponible ou readyState < 2, réessayer dans 100ms
            setTimeout(() => {
              if (!restoreAttempted) {
                restorePlayback()
              }
            }, 100)
          } else {
            // Timeout: la durée n'est jamais devenue disponible
            console.error('❌ Timeout restauration: durée non disponible après 5s')
            console.error(`   Durée: ${video.duration}, readyState: ${video.readyState}`)
            restoreAttempted = true
            setIsLoading(false)
            setIsRemuxing(false)
            setError('Erreur: impossible de charger les métadonnées de la vidéo.')
          }
        }
        
        // Essayer de restaurer dès que les métadonnées sont chargées
        video.addEventListener('loadedmetadata', restorePlayback, { once: true })
        
        // Fallback: aussi essayer sur loadeddata
        video.addEventListener('loadeddata', restorePlayback, { once: true })
        
        // Fallback supplémentaire: canplay (vidéo peut être lue)
        video.addEventListener('canplay', () => {
          // Si la position n'a pas encore été restaurée et qu'on est toujours à 0
          if (!restoreAttempted && video.currentTime === 0 && savedPosition > 1) {
            restorePlayback()
          }
        }, { once: true })
        
        // Fallback supplémentaire: canplaythrough (toutes les données sont chargées)
        video.addEventListener('canplaythrough', () => {
          // Si la position n'a pas encore été restaurée et qu'on est toujours à 0
          if (!restoreAttempted && video.currentTime === 0 && savedPosition > 1) {
            restorePlayback()
          }
        }, { once: true })
        
        // Polling pour vérifier périodiquement si la position doit être restaurée
        // (nécessaire car le remuxage peut prendre 2-3 minutes et les événements peuvent ne pas se déclencher)
        const pollingInterval = setInterval(() => {
          if (!restoreAttempted && video.duration && video.duration > 0 && video.readyState >= 2 && video.currentTime === 0 && savedPosition > 1) {
            restorePlayback()
          }
        }, 500) // Vérifier toutes les 500ms
        
        // Nettoyer le polling après 5 minutes
        setTimeout(() => {
          clearInterval(pollingInterval)
        }, 300000)
        
        // Timeout global: si rien ne se passe après 5 minutes, afficher une erreur
        // (le remuxage peut prendre 2-3 minutes pour un gros fichier)
        setTimeout(() => {
          if (!restoreAttempted && video.readyState === 0) {
            clearInterval(pollingInterval)
            console.error('❌ Timeout global: vidéo ne charge pas après 5 minutes')
            setIsLoading(false)
            setIsRemuxing(false)
            setError('Le remuxage prend trop de temps. Le fichier est peut-être trop volumineux.')
          }
        }, 300000) // 5 minutes
      }
    } else {
      // Pour HLS : essayer d'abord de changer via l'API HLS.js audioTrack
      
      // 🔧 FIX: Si HLS.js est actif avec plusieurs pistes audio, utiliser son API native
      if (hlsRef.current && hlsRef.current.audioTracks && hlsRef.current.audioTracks.length > 1) {
        console.log(`🔊 [HLS] Changement piste audio via HLS.js API: ${idx}`)
        console.log(`🔊 [HLS] Pistes disponibles:`, hlsRef.current.audioTracks.map((t, i) => `${i}: ${t.name || t.lang}`))
        
        // Trouver la piste correspondante dans HLS.js
        // L'index dans audioTracks peut différer de notre index
        const hlsAudioTracks = hlsRef.current.audioTracks
        let hlsTrackIndex = idx
        
        // Si on a un track.index spécifique, chercher par langue
        if (track.language) {
          const matchingTrack = hlsAudioTracks.findIndex(t => 
            t.lang === track.language || 
            t.name?.toLowerCase().includes(track.language.toLowerCase())
          )
          if (matchingTrack !== -1) {
            hlsTrackIndex = matchingTrack
          }
        }
        
        // Changer la piste audio via HLS.js
        hlsRef.current.audioTrack = hlsTrackIndex
        setSelectedAudio(idx)
        setShowSettingsMenu(false)
        console.log(`✅ Audio changé via HLS.js (piste ${hlsTrackIndex})`)
        return
      }
      
      // Fallback: recharger avec la nouvelle piste audio (si HLS.js n'a pas plusieurs pistes)
      const currentPos = video.currentTime
      const wasPlaying = !video.paused
      
      // Construire la nouvelle URL avec l'index de piste correct (API v2)
      const newUrl = src.includes('hls-v2') 
        ? `/api/hls-v2?path=${encodeURIComponent(filepath)}&playlist=true&audio=${track.index}`
        : `/api/hls?path=${encodeURIComponent(filepath)}&playlist=true&audio=${track.index}`
      
      console.log(`🔊 [HLS] Rechargement stream avec piste audio ${track.index}`)
      
      // Marquer qu'on change de piste
      isChangingTrack.current = true
      currentVideoUrl.current = newUrl
      setSelectedAudio(idx)
      setShowSettingsMenu(false)
      setIsLoading(true)
      
      // Nettoyer l'instance HLS existante
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      
      // Recharger avec HLS.js
      if (Hls.isSupported()) {
        // 🔧 PHASE 5: Config optimisée pour changement de piste
        const hls = new Hls(HLS_BASE_CONFIG)
        hlsRef.current = hls
        
        // 🔧 Nettoyer l'état vidéo avant rechargement (mais garder currentPos pour le restaurer après)
        video.load()
        
        hls.loadSource(newUrl)
        hls.attachMedia(video)
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.currentTime = currentPos
          if (wasPlaying) {
            video.play().catch(() => {})
          }
          setIsLoading(false)
          console.log('✅ Audio changé et position restaurée')
        })
      } else {
        // Safari ou fallback
        video.src = newUrl
        video.load()
        
        const restorePlayback = () => {
          video.currentTime = currentPos
          if (wasPlaying) {
            video.play().catch(() => {})
          }
          video.removeEventListener('loadeddata', restorePlayback)
          setIsLoading(false)
          console.log('✅ Audio changé et position restaurée')
        }
        
        video.addEventListener('loadeddata', restorePlayback)
      }
    }
  }, [selectedAudio, getFilepath, src])

  // 🔧 AbortController pour annuler les fetch de sous-titres en cours
  const subtitleAbortControllerRef = useRef<AbortController | null>(null)

  // Changement de sous-titres DYNAMIQUE
  const handleSubtitleChange = useCallback((idx: number | null) => {
    if (!videoRef.current) return
    
    console.log(`📝 [CHANGEMENT SOUS-TITRES] ${idx === null ? 'Désactivés' : `piste ${idx}`}`)
    console.log(`📝 [DEBUG] src:`, src)
    
    // 🔧 Annuler le fetch précédent s'il existe
    if (subtitleAbortControllerRef.current) {
      console.log(`📝 [HLS] Annulation fetch sous-titres précédent`)
      subtitleAbortControllerRef.current.abort()
      subtitleAbortControllerRef.current = null
    }
    
    const video = videoRef.current
    setSelectedSubtitle(idx)
    setShowSettingsMenu(false)
    
    // Vérifier si c'est un MP4 direct (avec sous-titres intégrés mov_text)
    const isDirectMP4 = !src.includes('/api/hls') && !src.includes('/api/hls-v2')
    console.log(`📝 [DEBUG] isDirectMP4:`, isDirectMP4)
    
    if (isDirectMP4) {
      // Pour MP4 directs : essayer d'abord les textTracks natifs, sinon utiliser /api/subtitles
      
      // ⚠️ CRITIQUE: Ne PAS supprimer les éléments <track> natifs (sous-titres intégrés dans le MP4)
      // Ils sont nécessaires pour les textTracks natifs
      // On supprime seulement les tracks ajoutés dynamiquement (depuis /api/subtitles)
      const existingTracks = video.querySelectorAll('track')
      existingTracks.forEach(t => {
        // Ne supprimer que les tracks ajoutés dynamiquement (qui ont un src avec /api/subtitles)
        if (t.src && t.src.includes('/api/subtitles')) {
          t.remove()
        }
      })
      
      // Désactiver toutes les text tracks d'abord (mais les garder dans le DOM)
      Array.from(video.textTracks).forEach(t => {
        t.mode = 'disabled'
      })
      
      // Si pas de sous-titres, on s'arrête
      if (idx === null) {
        console.log('✅ Sous-titres désactivés')
        return
      }
      
      const track = subtitleTracks[idx]
      if (!track) return
      
      // ⚠️ CRITIQUE: Si c'est un track téléchargé, utiliser directement son URL avec offset
      if ((track as any).isDownloaded && (track as any).sourceUrl) {
        console.log(`📝 [TRACK TÉLÉCHARGÉ] Détection track téléchargé: ${track.language}`)
        
        // Ajouter l'offset à l'URL si présent
        let trackUrl = (track as any).sourceUrl
        if (subtitleOffset !== 0) {
          // Ajouter ou mettre à jour le paramètre offset dans l'URL
          if (trackUrl.includes('&offset=')) {
            trackUrl = trackUrl.replace(/&offset=[-\d.]+/, `&offset=${subtitleOffset}`)
          } else {
            trackUrl += `&offset=${subtitleOffset}`
          }
        }
        console.log(`   URL: ${trackUrl}${subtitleOffset !== 0 ? ` (offset: ${subtitleOffset}s)` : ''}`)
        
        // Supprimer les tracks existants qui ne sont pas natifs
        const existingTracks = video.querySelectorAll('track')
        existingTracks.forEach(t => {
          // Ne supprimer que les tracks ajoutés dynamiquement (qui ont un src avec /api/subtitles ou /api/subtitles/fetch)
          if (t.src && (t.src.includes('/api/subtitles') || t.src.includes('/api/subtitles/fetch'))) {
            t.remove()
          }
        })
        
        // Désactiver toutes les text tracks
        Array.from(video.textTracks).forEach(t => {
          t.mode = 'disabled'
        })
        
        // Ajouter le track téléchargé avec l'offset
        const trackElement = document.createElement('track')
        trackElement.kind = 'subtitles'
        trackElement.label = track.language
        trackElement.srclang = track.language.toLowerCase().slice(0, 2)
        trackElement.src = trackUrl
        trackElement.default = false
        
        video.appendChild(trackElement)
        
        // Activer une fois chargé
        trackElement.addEventListener('load', () => {
          const textTrack = Array.from(video.textTracks).find(
            t => t.label === track.language || t.language === track.language.toLowerCase().slice(0, 2)
          )
          if (textTrack) {
            const cuesCount = textTrack.cues ? textTrack.cues.length : 0
            textTrack.mode = 'showing'
            console.log(`✅ [TRACK TÉLÉCHARGÉ ACTIVÉ] ${track.language}: mode="${textTrack.mode}", cues=${cuesCount}`)
          } else {
            console.error(`❌ [TRACK TÉLÉCHARGÉ] Track "${track.language}" non trouvé après chargement`)
          }
        })
        
        trackElement.addEventListener('error', (e) => {
          console.error(`❌ [ERREUR TRACK TÉLÉCHARGÉ] ${track.language}:`, e)
          console.error(`   URL: ${trackElement.src}`)
          trackElement.remove()
        })
        
        return // Sortir ici, ne pas continuer avec la logique native
      }
      
      // Vérifier si on a des textTracks natifs disponibles
      const textTracks = Array.from(video.textTracks)
      
      
      // ⚠️ CRITIQUE: Pour les MP4 avec sous-titres intégrés, on doit TOUJOURS utiliser les textTracks natifs
      // s'ils existent, en utilisant directement l'index (plus fiable que la correspondance)
      let nativeTrack: TextTrack | null = null
      
      // PRIORITÉ 1: Utiliser directement l'index si disponible
      // (c'est le cas le plus courant - subtitleTracks[0] = textTracks[0])
      if (textTracks.length > 0 && idx !== null && idx >= 0 && idx < textTracks.length) {
        nativeTrack = textTracks[idx]
      } else if (textTracks.length > 0) {
        // PRIORITÉ 2: Chercher par correspondance language/label si l'index ne fonctionne pas
        const trackLanguageShort = track.language.toLowerCase().slice(0, 2) // "fr", "en", etc.
        const trackLanguageFull = track.language.toLowerCase() // "français", "english", etc.
        
        nativeTrack = textTracks.find((t, i) => {
          // Correspondance par index exact
          if (i === idx) return true
          
          // Correspondance par language (court ou complet)
          if (t.language && (
            t.language.toLowerCase() === trackLanguageShort ||
            t.language.toLowerCase() === trackLanguageFull ||
            t.language.toLowerCase().slice(0, 2) === trackLanguageShort
          )) return true
          
          // Correspondance par label
          if (t.label && (
            t.label.toLowerCase().includes(trackLanguageShort) ||
            t.label.toLowerCase().includes(track.language.toLowerCase())
          )) return true
          
          return false
        }) || null
        
        if (nativeTrack) {
        }
      }
      
      if (nativeTrack) {
        // ⚠️ CRITIQUE: Désactiver TOUTES les autres pistes AVANT d'activer celle-ci
        // Plusieurs pistes en mode 'showing' simultanément peuvent causer des conflits
        textTracks.forEach(t => {
          t.mode = 'disabled'
        })
        
        // Ensuite activer uniquement la piste sélectionnée
        nativeTrack.mode = 'showing'
        
        // Utiliser les textTracks natifs si disponibles
        // ⚠️ CRITIQUE: Vérifier que les cues sont chargés avant d'activer
        const activateTrack = () => {
          if (nativeTrack) {
            const cuesCount = nativeTrack.cues ? nativeTrack.cues.length : 0
            const activeCuesCount = nativeTrack.activeCues ? nativeTrack.activeCues.length : 0
            
            // Activer le track
            nativeTrack.mode = 'showing'
            
            // Log pour diagnostic
            console.log(`📝 [ACTIVATION NATIVE] Track "${nativeTrack.label}" activé`)
            console.log(`   Mode: ${nativeTrack.mode}`)
            console.log(`   Cues: ${cuesCount} disponibles, ${activeCuesCount} actifs`)
            console.log(`   Temps vidéo: ${video.currentTime.toFixed(1)}s`)
            
            if (cuesCount === 0) {
              console.warn(`   ⚠️ Aucun cue chargé`)
            } else if (activeCuesCount === 0 && video.currentTime > 1) {
              console.warn(`   ⚠️ Cues disponibles mais aucun actif au temps ${video.currentTime.toFixed(1)}s`)
            }
            
            // Vérifier périodiquement que le track reste activé et affiche les sous-titres
            let checkCount = 0
            const checkInterval = setInterval(() => {
              checkCount++
              if (!nativeTrack || checkCount > 20) { // Vérifier pendant 4 secondes (20 * 200ms)
                clearInterval(checkInterval)
                return
              }
              
              // ⚠️ CRITIQUE: S'assurer qu'aucune autre piste n'est en mode 'showing'
              const allTracks = Array.from(video.textTracks)
              const otherShowingTracks = allTracks.filter(t => t !== nativeTrack && t.mode === 'showing')
              if (otherShowingTracks.length > 0) {
                console.warn(`⚠️ Détection de ${otherShowingTracks.length} autre(s) piste(s) en mode 'showing', désactivation...`)
                otherShowingTracks.forEach(t => t.mode = 'disabled')
              }
              
              if (nativeTrack.mode !== 'showing') {
                console.warn(`⚠️ Le track n'est plus en mode "showing", réactivation...`)
                nativeTrack.mode = 'showing'
              }
              
              // Vérifier les cues actifs
              const activeCues = nativeTrack.activeCues ? nativeTrack.activeCues.length : 0
              const totalCues = nativeTrack.cues ? nativeTrack.cues.length : 0
              
              if (activeCues > 0) {
                // Cues actifs détectés - les sous-titres devraient s'afficher
                clearInterval(checkInterval) // Arrêter la vérification si ça fonctionne
              } else if (totalCues > 0 && video.currentTime > 2) {
                // Cues disponibles mais non actifs après 2 secondes de lecture
                // Cela peut indiquer un problème de timing ou de format
                if (checkCount === 10) { // Log une seule fois après 2 secondes
                  console.warn(`⚠️ Track "${nativeTrack.label}" : ${totalCues} cues disponibles mais aucun actif au temps ${video.currentTime.toFixed(1)}s`)
                }
              }
            }, 200)
          }
        }
        
        // Activer immédiatement (les cues peuvent être chargés plus tard)
        activateTrack()
        
        // Écouter aussi l'événement cuechange pour s'assurer que les sous-titres s'affichent
        const cueChangeHandler = () => {
          if (nativeTrack && nativeTrack.mode !== 'showing') {
            nativeTrack.mode = 'showing'
          }
          
          // Log les cues actifs pour debug
          if (nativeTrack && nativeTrack.activeCues && nativeTrack.activeCues.length > 0) {
          }
        }
        nativeTrack.addEventListener('cuechange', cueChangeHandler)
        
        // Nettoyer le listener après 10 secondes
        setTimeout(() => {
          nativeTrack?.removeEventListener('cuechange', cueChangeHandler)
        }, 10000)
        
        return // ⚠️ IMPORTANT: Sortir ici pour éviter le fallback
      } else {
        // Fallback: utiliser /api/subtitles (comme pour HLS)
        const filepath = getFilepath()
        if (!filepath) return
        
        const trackElement = document.createElement('track')
        trackElement.kind = 'subtitles'
        trackElement.label = track.language
        trackElement.srclang = track.language.toLowerCase().slice(0, 2)
        trackElement.src = `/api/subtitles?path=${encodeURIComponent(filepath)}&track=${track.index}`
        trackElement.default = true
        
        video.appendChild(trackElement)
        
        // Activer une fois chargé
        trackElement.addEventListener('load', () => {
          const textTrack = Array.from(video.textTracks).find(
            t => t.label === track.language
          )
          if (textTrack) {
            textTrack.mode = 'showing'
          }
        })
        
        // Gestion d'erreur
        trackElement.addEventListener('error', async (e) => {
          e.preventDefault()
          e.stopPropagation()
          console.error(`❌ Erreur chargement sous-titres: ${track.language}`)
          trackElement.remove()
          setError(`Impossible de charger les sous-titres "${track.language}"`)
          setSelectedSubtitle(null)
          setTimeout(() => setError(null), 5000)
        })
      }
    } else {
      // Pour HLS : utiliser l'API /api/subtitles pour extraire les sous-titres
      console.log(`📝 [HLS] Gestion sous-titres HLS`)
      
      // Supprimer les pistes existantes
      const existingTracks = video.querySelectorAll('track')
      console.log(`📝 [HLS] Suppression ${existingTracks.length} pistes existantes`)
      existingTracks.forEach(t => t.remove())
      
      // Désactiver toutes les text tracks
      Array.from(video.textTracks).forEach(t => {
        t.mode = 'disabled'
      })
      
      // Si pas de sous-titres, on s'arrête
      if (idx === null) {
        console.log('✅ [HLS] Sous-titres désactivés')
        return
      }
      
      // Ajouter la nouvelle piste via API
      const track = subtitleTracks[idx]
      const filepath = getFilepath()
      
      console.log(`📝 [HLS] Track sélectionné:`, track)
      console.log(`📝 [HLS] Filepath:`, filepath)
      
      if (!filepath || !track) {
        console.error(`❌ [HLS] Filepath ou track manquant`)
        return
      }
      
      // 🆕 Pour les fichiers pré-transcodés avec VTT, utiliser l'API dédiée
      let subtitleUrl: string
      if (track.vttFile) {
        subtitleUrl = `/api/hls/subtitles?path=${encodeURIComponent(filepath)}&file=${encodeURIComponent(track.vttFile)}`
        console.log(`📝 [HLS-PRE] URL sous-titres VTT pré-transcodé:`, subtitleUrl)
      } else {
        subtitleUrl = `/api/subtitles?path=${encodeURIComponent(filepath)}&track=${track.index}`
        console.log(`📝 [HLS] URL sous-titres temps réel:`, subtitleUrl)
      }
      
      // 🔧 NOUVELLE APPROCHE : Charger manuellement les sous-titres via fetch
      // Car les browsers ne chargent pas toujours les <track> ajoutés dynamiquement
      console.log(`📝 [HLS] Chargement manuel des sous-titres...`)
      console.log(`📝 [HLS] URL fetch:`, subtitleUrl)
      
      // Créer un nouveau AbortController pour ce fetch
      const abortController = new AbortController()
      subtitleAbortControllerRef.current = abortController
      
      fetch(subtitleUrl, { signal: abortController.signal })
        .then(async (response) => {
          console.log(`📝 [HLS] Fetch réponse reçue`)
          const status = response.status
          const contentType = response.headers.get('Content-Type')
          console.log(`📝 [HLS] Fetch /api/subtitles: status=${status}, type=${contentType}`)
          
          if (status !== 200) {
            const errorText = await response.text()
            console.error(`❌ [HLS] Erreur API subtitles:`, errorText.slice(0, 300))
            setError(`Impossible de charger les sous-titres: ${status}`)
            return
          }
          
          const vttContent = await response.text()
          console.log(`✅ [HLS] Sous-titres reçus: ${vttContent.length} caractères`)
          console.log(`📝 [HLS] Aperçu: ${vttContent.slice(0, 150)}...`)
          
          // Créer un Blob URL pour les sous-titres
          const blob = new Blob([vttContent], { type: 'text/vtt' })
          const blobUrl = URL.createObjectURL(blob)
          console.log(`📝 [HLS] Blob URL créé: ${blobUrl}`)
          
          // Créer et ajouter l'élément <track>
      const trackElement = document.createElement('track')
      trackElement.kind = 'subtitles'
      trackElement.label = track.language
      trackElement.srclang = track.language.toLowerCase().slice(0, 2)
      trackElement.default = true
          trackElement.src = blobUrl
      
      video.appendChild(trackElement)
          console.log(`📝 [HLS] Élément <track> ajouté avec Blob URL`)
      
          // Activer immédiatement
          setTimeout(() => {
        const textTrack = Array.from(video.textTracks).find(
          t => t.label === track.language
        )
            
        if (textTrack) {
          textTrack.mode = 'showing'
              console.log(`✅ [HLS] TextTrack activé: ${textTrack.label}, cues=${textTrack.cues?.length || 0}`)
              console.log(`📝 [HLS] Position vidéo: ${video.currentTime.toFixed(1)}s`)
              console.log(`📝 [HLS] Premier cue: ${textTrack.cues?.[0]?.startTime}s - ${textTrack.cues?.[0]?.endTime}s`)
              console.log(`📝 [HLS] Cues actifs maintenant: ${textTrack.activeCues?.length || 0}`)
              
              // Forcer le rendu des sous-titres en vérifiant périodiquement
              const checkInterval = setInterval(() => {
                if (textTrack.activeCues && textTrack.activeCues.length > 0) {
                  console.log(`✅ [HLS] Sous-titres visibles ! ${textTrack.activeCues.length} cues actifs`)
                  clearInterval(checkInterval)
                }
              }, 500)
              
              // Arrêter après 10 secondes
              setTimeout(() => clearInterval(checkInterval), 10000)
            }
          }, 100)
        })
        .catch((err) => {
          // Si l'erreur est une annulation (AbortError), ne pas logger ni afficher d'erreur
          if (err.name === 'AbortError') {
            console.log(`📝 [HLS] Fetch sous-titres annulé (changement de piste)`)
            return
          }
          
          console.error(`❌ [HLS] Erreur fetch subtitles:`, err)
          console.error(`❌ [HLS] Message:`, err.message)
          console.error(`❌ [HLS] Stack:`, err.stack)
          setError(`Erreur chargement sous-titres: ${err.message}`)
        })
      
      // Retourner immédiatement (le chargement est asynchrone)
      
      // 🔧 DEBUG: Vérifier manuellement si la requête fonctionne
      fetch(subtitleUrl)
        .then(response => {
          console.log(`📝 [HLS DEBUG] Requête manuelle /api/subtitles: status=${response.status}`)
          return response.text()
        })
        .then(text => {
          console.log(`📝 [HLS DEBUG] Contenu reçu: ${text.slice(0, 200)}...`)
        })
        .catch(err => {
          console.error(`❌ [HLS DEBUG] Erreur requête manuelle:`, err)
      })
    }
  }, [subtitleTracks, getFilepath, src])

  // Contrôles
  const handleMouseMove = useCallback(() => {
    setShowControls(true)
    
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current)
    }

    // 🔧 FIX #3: Vérifier l'état réel de la vidéo, pas juste le state
    const videoElement = videoRef.current
    const actuallyPlaying = videoElement && !videoElement.paused && !videoElement.ended
    
    if ((actuallyPlaying || isPlaying) && !showSettingsMenu) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }, [isPlaying, showSettingsMenu])

  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return
    
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch(() => {})
    }
  }, [isPlaying])

  const handleSkip = useCallback((seconds: number) => {
    if (!videoRef.current) return
    const actualDuration = realDurationRef.current || duration || videoRef.current.duration
    const newTime = Math.max(0, Math.min(actualDuration, videoRef.current.currentTime + seconds))
    videoRef.current.currentTime = newTime
  }, [duration])

  const handleVolumeToggle = useCallback(() => {
    if (!videoRef.current) return
    
    if (isMuted || volume === 0) {
      videoRef.current.muted = false
      setIsMuted(false)
      if (volume === 0) {
        videoRef.current.volume = 1
        setVolume(1)
      }
    } else {
      videoRef.current.muted = true
      setIsMuted(true)
    }
  }, [isMuted, volume])

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return
    const newVolume = parseFloat(e.target.value)
    videoRef.current.volume = newVolume
    setVolume(newVolume)
    if (newVolume > 0 && isMuted) {
      videoRef.current.muted = false
      setIsMuted(false)
    }
  }

  const handleFullscreen = useCallback(() => {
    if (isVideoFullscreen(videoRef.current || undefined)) {
      exitFullscreen(videoRef.current || undefined)
    } else if (containerRef.current) {
      requestFullscreen(containerRef.current, videoRef.current || undefined)
    }
  }, [])

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current || isDragging) return
    
    const rect = progressRef.current.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const actualDuration = realDurationRef.current || duration || videoRef.current.duration
    const targetTime = percent * actualDuration
    
    // 🎯 PRÉ-TRANSCODÉ = seek illimité, pas de restriction
    if (isPreTranscoded) {
      setSeekWarning(null)
      if (isFinite(actualDuration) && actualDuration > 0) {
        videoRef.current.currentTime = targetTime
      }
      return
    }
    
    // 🔧 FIX #2: Vérifier si le seek est dans la zone disponible (seulement pour HLS en cours de transcodage)
    const isHLS = src.includes('/api/hls')
    if (isHLS && targetTime > maxSeekableTime && maxSeekableTime < actualDuration * 0.95) {
      const availableMinutes = Math.floor(maxSeekableTime / 60)
      const availableSeconds = Math.floor(maxSeekableTime % 60)
      
      setSeekWarning(`Transcodage en cours... Disponible jusqu'à ${availableMinutes}:${availableSeconds.toString().padStart(2, '0')}`)
      
      // Effacer le warning après 3s
      setTimeout(() => setSeekWarning(null), 3000)
      
      // Permettre quand même le seek jusqu'au max disponible
      if (isFinite(maxSeekableTime) && maxSeekableTime > 0) {
        videoRef.current.currentTime = Math.min(targetTime, maxSeekableTime - 5)
      }
      return
    }
    
    // Seek normal
    setSeekWarning(null)
    if (isFinite(actualDuration) && actualDuration > 0) {
      videoRef.current.currentTime = targetTime
    }
  }

  const handleProgressDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current) return
    
    setIsDragging(true)
    const rect = progressRef.current.getBoundingClientRect()
    const isHLS = src.includes('/api/hls')
    
    const updatePosition = (clientX: number) => {
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const actualDuration = realDurationRef.current || duration || videoRef.current?.duration || 0
      const targetTime = percent * actualDuration
      
      if (isFinite(actualDuration) && actualDuration > 0 && videoRef.current) {
        // 🎯 PRÉ-TRANSCODÉ = seek illimité
        if (isPreTranscoded) {
          videoRef.current.currentTime = targetTime
          return
        }
        
        // 🔧 FIX #2: Limiter au temps disponible pendant le drag (seulement pour HLS en temps réel)
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
      setSeekWarning(null) // Effacer le warning à la fin du drag
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const formatTime = (time: number) => {
    if (!isFinite(time) || time < 0) return '0:00'
    
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Calculer le pourcentage de progression avec garde-fous
  const progressPercent = (() => {
    if (!duration || duration === 0) return 0
    if (currentTime > duration) {
      console.warn(`⚠️ currentTime (${currentTime}) > duration (${duration})`)
      return 100
    }
    const percent = (currentTime / duration) * 100
    // Limiter entre 0 et 100
    return Math.min(100, Math.max(0, percent))
  })()

  return (
    <div 
      ref={containerRef}
      className={`${styles.container} ${!showControls ? styles.hideCursor : ''}`} 
      onMouseMove={handleMouseMove}
      onMouseLeave={() => !showSettingsMenu && setShowControls(false)}
    >
      {/* Barre de titre */}
      <div className={`${styles.titleBar} ${showControls ? styles.visible : ''}`}>
        <button className={styles.closeButton} onClick={() => {
          // 🔧 NE PLUS TUER FFmpeg ici, laisse FFmpegManager gérer
          // cleanupFFmpeg() tue TOUS les FFmpeg, même ceux d'autres vidéos !
          onClose()
        }}>
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
        // @ts-expect-error - webkit-playsinline est nécessaire pour Safari iOS
        webkit-playsinline="true"
        onDoubleClick={handleFullscreen}
      />

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
      
      {/* 🔧 FIX #2: Warning de seek */}
      {seekWarning && (
        <div className={styles.seekWarning}>
          <span>⏳</span>
          <span>{seekWarning}</span>
        </div>
      )}
      
      {/* 🔧 PHASE 4: Affichage du buffer status (discret en bas à droite) */}
      {bufferStatus && isRemuxing && (
        <div className={styles.bufferStatus}>
          <div className={styles.bufferMetric}>
            <span className={styles.bufferLabel}>Vitesse transcode:</span>
            <span className={styles.bufferValue}>{bufferStatus.currentSpeed.toFixed(1)}x</span>
          </div>
          <div className={styles.bufferMetric}>
            <span className={styles.bufferLabel}>Buffer:</span>
            <span className={styles.bufferValue}>{bufferStatus.bufferLevel.toFixed(1)}s</span>
          </div>
          {bufferStatus.needsBuffering && (
            <div className={styles.bufferWarning}>
              ⏳ {bufferStatus.reason}
            </div>
          )}
        </div>
      )}
      
      {/* Bouton Play central */}
      {!isPlaying && !isLoading && !error && (
        <button 
          className={styles.centerPlayButton}
          onClick={handlePlayPause}
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
            <button onClick={() => {
              setError(null)
              setIsLoading(true)
              if (videoRef.current) {
                videoRef.current.load()
                videoRef.current.play().catch(() => {})
              }
            }}>Réessayer</button>
            <button onClick={onClose}>Fermer</button>
          </div>
        </div>
      )}

      {/* 🎬 Épisode suivant (style Netflix) */}
      {showNextEpisodeUI && nextEpisode && onNextEpisode && (
        <div className={styles.nextEpisodeOverlay}>
          <div className={styles.nextEpisodeCard}>
            {nextEpisode.thumbnail && (
              <div className={styles.nextEpisodeThumbnail}>
                <img 
                  src={nextEpisode.thumbnail} 
                  alt={nextEpisode.title}
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
              onClick={() => {
                onNextEpisode()
              }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M8 5v14l11-7z" fill="currentColor"/>
              </svg>
              Lire maintenant
            </button>
            <button 
              className={styles.nextEpisodeCancel}
              onClick={() => {
                setShowNextEpisodeUI(false)
                setIsNextEpisodeCancelled(true) // Empêche le passage auto à la fin
              }}
            >
              Annuler
            </button>
          </div>
          <div className={styles.nextEpisodeCountdown}>
            Lecture dans {nextEpisodeCountdown}s
          </div>
        </div>
      )}

      {/* Contrôles */}
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
              style={{ 
                left: `${Math.min(Math.max(0, progressPercent), 100)}%`
              }} 
            />
          </div>
          <span className={styles.duration}>{formatTime(duration)}</span>
        </div>
        
        {/* Contrôles du bas */}
        <div className={styles.controlsBottom}>
          <div className={styles.leftControls}>
            {/* Play/Pause */}
            <button onClick={handlePlayPause} className={`${styles.controlBtn} ${styles.playBtn}`}>
              {isPlaying ? (
                <svg viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
            
            {/* Skip */}
            <button onClick={() => handleSkip(-10)} className={styles.controlBtn}>
              <svg viewBox="0 0 24 24">
                <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
              </svg>
            </button>
            
            <button onClick={() => handleSkip(10)} className={styles.controlBtn}>
              <svg viewBox="0 0 24 24">
                <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
              </svg>
            </button>
            
            {/* Volume */}
            <div className={styles.volumeGroup}>
              <button onClick={handleVolumeToggle} className={styles.controlBtn}>
                {isMuted || volume === 0 ? (
                  <svg viewBox="0 0 24 24">
                    <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0023 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z"/>
                  </svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className={styles.volumeSlider}
                style={{ '--volume-percent': `${(isMuted ? 0 : volume) * 100}%` } as React.CSSProperties}
              />
            </div>
          </div>
          
          <div className={styles.rightControls}>
            {/* Settings */}
            {(audioTracks.length > 0 || subtitleTracks.length > 0) && (
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className={`${styles.textBtn} settingsButton`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M19 19H5V5h14m0-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2m-7 6c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3m-1 7H6v1h5v-1m2-3H6v1h7v-1m2-3H6v1h9v-1"/>
                  </svg>
                  <span>Audio et sous-titres</span>
                </button>
                
                {showSettingsMenu && (
                  <div ref={settingsMenuRef} className={menuStyles.settingsMenu}>
                    {/* Audio */}
                    {audioTracks.length > 0 && (
                      <div className={menuStyles.settingsSection}>
                        <div className={menuStyles.settingsSectionTitle}>Audio</div>
                        {audioTracks.map((track, idx) => (
                          <div
                            key={`audio-${track.index}`}
                            className={`${menuStyles.settingsOption} ${selectedAudio === idx ? menuStyles.active : ''}`}
                            onClick={() => handleAudioChange(track, idx)}
                          >
                            <div className={menuStyles.settingsOptionInfo}>
                              <span className={menuStyles.settingsOptionTitle}>
                                {track.language || `Piste ${idx + 1}`}
                              </span>
                              {track.title && (
                                <span className={menuStyles.settingsOptionSubtitle}>{track.title}</span>
                              )}
                            </div>
                            {selectedAudio === idx && (
                              <svg className={menuStyles.settingsCheckmark} viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Sous-titres */}
                    <div className={menuStyles.settingsSection}>
                      <div className={menuStyles.settingsSectionTitle}>Sous-titres</div>
                      
                      {/* Option "Désactivés" */}
                      <div
                        className={`${menuStyles.settingsOption} ${selectedSubtitle === null ? menuStyles.active : ''}`}
                        onClick={() => handleSubtitleChange(null)}
                      >
                        <div className={menuStyles.settingsOptionInfo}>
                          <span className={menuStyles.settingsOptionTitle}>Désactivés</span>
                        </div>
                        {selectedSubtitle === null && (
                          <svg className={menuStyles.settingsCheckmark} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                          </svg>
                        )}
                      </div>
                      
                      {/* Sous-titres intégrés */}
                      {subtitleTracks.map((track, idx) => (
                        <div
                          key={`sub-${track.index}`}
                          className={`${menuStyles.settingsOption} ${selectedSubtitle === idx ? menuStyles.active : ''}`}
                          onClick={() => handleSubtitleChange(idx)}
                        >
                          <div className={menuStyles.settingsOptionInfo}>
                            <span className={menuStyles.settingsOptionTitle}>
                              {track.language || `Sous-titre ${idx + 1}`}
                            </span>
                            {track.title && (
                              <span className={menuStyles.settingsOptionSubtitle}>{track.title}</span>
                            )}
                          </div>
                          {selectedSubtitle === idx && (
                            <svg className={menuStyles.settingsCheckmark} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                            </svg>
                          )}
                        </div>
                      ))}
                      
                      {/* Contrôle de synchronisation des sous-titres téléchargés */}
                      {subtitleTracks.some(t => (t as any).isDownloaded) && selectedSubtitle !== null && (
                        <div className={menuStyles.settingsSection}>
                          <div className={menuStyles.settingsSectionTitle}>Synchronisation</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 16px' }}>
                            {/* Contrôles fins (±0.5s) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                              <button
                                onClick={() => {
                                  const newOffset = subtitleOffset - 0.5
                                  setSubtitleOffset(newOffset)
                                  // Recharger le track avec le nouvel offset
                                  const currentTrack = subtitleTracks[selectedSubtitle]
                                  if (currentTrack && (currentTrack as any).isDownloaded) {
                                    handleSubtitleChange(selectedSubtitle)
                                  }
                                }}
                                style={{
                                  background: 'rgba(255,255,255,0.1)',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  color: 'white',
                                  padding: '6px 12px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '13px'
                                }}
                              >
                                -0.5s
                              </button>
                              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', minWidth: '100px', textAlign: 'center', fontWeight: '500' }}>
                                {subtitleOffset !== 0 ? `${subtitleOffset > 0 ? '+' : ''}${subtitleOffset.toFixed(1)}s` : 'Synchronisé'}
                              </span>
                              <button
                                onClick={() => {
                                  const newOffset = subtitleOffset + 0.5
                                  setSubtitleOffset(newOffset)
                                  // Recharger le track avec le nouvel offset
                                  const currentTrack = subtitleTracks[selectedSubtitle]
                                  if (currentTrack && (currentTrack as any).isDownloaded) {
                                    handleSubtitleChange(selectedSubtitle)
                                  }
                                }}
                                style={{
                                  background: 'rgba(255,255,255,0.1)',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  color: 'white',
                                  padding: '6px 12px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '13px'
                                }}
                              >
                                +0.5s
                              </button>
                            </div>
                            
                            {/* Contrôles grossiers (±5s) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                              <button
                                onClick={() => {
                                  const newOffset = subtitleOffset - 5
                                  setSubtitleOffset(newOffset)
                                  const currentTrack = subtitleTracks[selectedSubtitle]
                                  if (currentTrack && (currentTrack as any).isDownloaded) {
                                    handleSubtitleChange(selectedSubtitle)
                                  }
                                }}
                                style={{
                                  background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid rgba(255,255,255,0.15)',
                                  color: 'rgba(255,255,255,0.7)',
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '11px'
                                }}
                              >
                                -5s
                              </button>
                              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', minWidth: '60px', textAlign: 'center' }}>
                                Ajustement grossier
                              </span>
                              <button
                                onClick={() => {
                                  const newOffset = subtitleOffset + 5
                                  setSubtitleOffset(newOffset)
                                  const currentTrack = subtitleTracks[selectedSubtitle]
                                  if (currentTrack && (currentTrack as any).isDownloaded) {
                                    handleSubtitleChange(selectedSubtitle)
                                  }
                                }}
                                style={{
                                  background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid rgba(255,255,255,0.15)',
                                  color: 'rgba(255,255,255,0.7)',
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '11px'
                                }}
                              >
                                +5s
                              </button>
                            </div>
                            
                            {/* Bouton Reset */}
                            {subtitleOffset !== 0 && (
                              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                                <button
                                  onClick={() => {
                                    setSubtitleOffset(0)
                                    const currentTrack = subtitleTracks[selectedSubtitle]
                                    if (currentTrack && (currentTrack as any).isDownloaded) {
                                      handleSubtitleChange(selectedSubtitle)
                                    }
                                  }}
                                  style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    color: 'white',
                                    padding: '6px 16px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  Réinitialiser
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Télécharger depuis OpenSubtitles */}
                      <div
                        className={`${menuStyles.settingsOption} ${isDownloadingSubtitles ? menuStyles.disabled : ''}`}
                        onClick={async () => {
                          if (isDownloadingSubtitles) return
                          
                          const filepath = getFilepath()
                          if (!filepath) {
                            setError('Impossible de récupérer le chemin du fichier')
                            setTimeout(() => setError(null), 3000)
                            return
                          }
                          
                          setIsDownloadingSubtitles(true)
                          setShowSettingsMenu(false)
                          
                          try {
                            // Télécharger FR et EN
                            const languages = ['fr', 'en']
                            const downloadedTracks: SubtitleTrack[] = []
                            
                            for (const lang of languages) {
                              try {
                                console.log(`📥 [TÉLÉCHARGEMENT] Sous-titre ${lang.toUpperCase()}...`)
                                const fetchUrl = `/api/subtitles/fetch?path=${encodeURIComponent(filepath)}&lang=${lang}`
                                console.log(`   URL: ${fetchUrl}`)
                                
                                const response = await fetch(fetchUrl)
                                console.log(`   Réponse: ${response.status} ${response.statusText}`)
                                
                                if (response.ok) {
                                  // Vérifier que la réponse est bien du WebVTT et non du JSON d'erreur
                                  const contentType = response.headers.get('content-type') || ''
                                  const responseText = await response.text()
                                  console.log(`   Content-Type: ${contentType}`)
                                  console.log(`   Taille réponse: ${responseText.length} caractères`)
                                  console.log(`   Début réponse: ${responseText.substring(0, 100)}`)
                                  
                                  // Si c'est du JSON, c'est une erreur
                                  if (contentType.includes('application/json') || responseText.trim().startsWith('{')) {
                                    try {
                                      const errorData = JSON.parse(responseText)
                                      const errorMsg = errorData.message || errorData.error || 'Erreur inconnue'
                                      console.warn(`   ⚠️ Erreur API: ${errorMsg}`)
                                      
                                      // Si c'est une erreur VIP, informer l'utilisateur
                                      if (errorData.requiresVip || errorMsg.toLowerCase().includes('vip')) {
                                        setError('OpenSubtitles requiert un compte VIP. Cette fonctionnalité n\'est pas disponible pour le moment.')
                                        setTimeout(() => setError(null), 8000)
                                      }
                                      
                                      continue // Passer à la langue suivante
                                    } catch {
                                      // Pas du JSON valide, continuer
                                    }
                                  }
                                  
                                  // Vérifier que c'est bien du WebVTT
                                  if (!responseText.trim().startsWith('WEBVTT')) {
                                    console.warn(`   ⚠️ Réponse ne semble pas être du WebVTT valide`)
                                    continue // Passer à la langue suivante
                                  }
                                  
                                  console.log(`   ✅ WebVTT valide détecté`)
                                  
                                  // ⚠️ CRITIQUE: Utiliser directement l'API /api/subtitles/fetch comme source pour le track
                                  // Inclure l'offset si présent
                                  const vttUrl = `/api/subtitles/fetch?path=${encodeURIComponent(filepath)}&lang=${lang}${subtitleOffset !== 0 ? `&offset=${subtitleOffset}` : ''}`
                                  console.log(`📝 [AJOUT TRACK] ${lang.toUpperCase()}: ${vttUrl}`)
                                  
                                  // Ajouter le track au lecteur vidéo
                                  if (videoRef.current) {
                                    const trackElement = document.createElement('track')
                                    trackElement.kind = 'subtitles'
                                    trackElement.label = lang === 'fr' ? 'Français' : 'English'
                                    trackElement.srclang = lang
                                    trackElement.src = vttUrl
                                    trackElement.default = false
                                    
                                    videoRef.current.appendChild(trackElement)
                                    
                                    // Activer le track une fois chargé
                                    trackElement.addEventListener('load', () => {
                                      console.log(`✅ [TRACK LOADED] ${lang.toUpperCase()} track chargé`)
                                      const textTrack = Array.from(videoRef.current!.textTracks).find(
                                        t => t.label === (lang === 'fr' ? 'Français' : 'English')
                                      )
                                      if (textTrack) {
                                        const cuesCount = textTrack.cues ? textTrack.cues.length : 0
                                        console.log(`   Track trouvé: language="${textTrack.language}", label="${textTrack.label}", cues=${cuesCount}`)
                                        
                                        // Attendre que les cues soient chargés avant d'activer
                                        const activateDownloadedTrack = () => {
                                          const currentCuesCount = textTrack.cues ? textTrack.cues.length : 0
                                          const activeCuesCount = textTrack.activeCues ? textTrack.activeCues.length : 0
                                          
                                          if (currentCuesCount > 0) {
                                            textTrack.mode = 'showing'
                                            console.log(`   ✅ Track activé (mode=showing), ${currentCuesCount} cues disponibles, ${activeCuesCount} actifs`)
                                          } else {
                                            console.warn(`   ⚠️ Aucun cue chargé, réessai dans 500ms...`)
                                            // Réessayer après un court délai
                                            setTimeout(() => {
                                              const retryCuesCount = textTrack.cues ? textTrack.cues.length : 0
                                              if (retryCuesCount > 0) {
                                                textTrack.mode = 'showing'
                                                console.log(`   ✅ Track activé après délai, ${retryCuesCount} cues disponibles`)
                                              } else {
                                                // Activer quand même, les cues peuvent arriver plus tard
                                                textTrack.mode = 'showing'
                                                console.warn(`   ⚠️ Track activé sans cues (ils arriveront plus tard)`)
                                              }
                                            }, 500)
                                          }
                                        }
                                        
                                        // Écouter l'événement cuechange pour détecter quand les cues deviennent actifs
                                        const cueChangeHandler = () => {
                                          const activeCuesCount = textTrack.activeCues ? textTrack.activeCues.length : 0
                                          if (activeCuesCount > 0) {
                                            console.log(`   📝 Cuechange: ${activeCuesCount} cues actifs détectés (vidéo: ${videoRef.current?.currentTime.toFixed(1)}s)`)
                                          }
                                        }
                                        textTrack.addEventListener('cuechange', cueChangeHandler)
                                        
                                        // Vérifier périodiquement si les cues deviennent actifs après le début de la lecture
                                        let checkInterval: NodeJS.Timeout | null = null
                                        const startChecking = () => {
                                          if (checkInterval) return
                                          
                                          checkInterval = setInterval(() => {
                                            const activeCuesCount = textTrack.activeCues ? textTrack.activeCues.length : 0
                                            const currentTime = videoRef.current?.currentTime || 0
                                            
                                            if (activeCuesCount > 0) {
                                              console.log(`   ✅ Cues actifs détectés: ${activeCuesCount} cues au temps ${currentTime.toFixed(1)}s`)
                                              if (checkInterval) {
                                                clearInterval(checkInterval)
                                                checkInterval = null
                                              }
                                            } else if (currentTime > 5 && textTrack.mode === 'showing') {
                                              // Si la vidéo joue depuis plus de 5 secondes et qu'aucun cue n'est actif, il y a peut-être un problème
                                              console.warn(`   ⚠️ Aucun cue actif après ${currentTime.toFixed(1)}s malgré le track en mode 'showing'`)
                                            }
                                          }, 1000) // Vérifier toutes les secondes
                                        }
                                        
                                        // Démarrer la vérification quand la vidéo commence à jouer
                                        videoRef.current?.addEventListener('play', startChecking, { once: true })
                                        
                                        // Essayer d'activer immédiatement
                                        activateDownloadedTrack()
                                      } else {
                                        console.error(`   ❌ Track "${lang === 'fr' ? 'Français' : 'English'}" non trouvé dans textTracks`)
                                      }
                                    })
                                    
                                    // Gérer les erreurs de chargement
                                    trackElement.addEventListener('error', async (e) => {
                                      console.error(`❌ Erreur chargement sous-titre téléchargé ${lang.toUpperCase()}:`, e)
                                      console.error(`   URL track: ${trackElement.src}`)
                                      
                                      // Vérifier si l'API retourne une erreur
                                      try {
                                        const testResponse = await fetch(trackElement.src)
                                        const testData = await testResponse.text()
                                        console.error(`   Réponse API (${testResponse.status}):`, testData.substring(0, 200))
                                      } catch (err) {
                                        console.error(`   Erreur test API:`, err)
                                      }
                                      
                                      // Retirer le track défaillant
                                      trackElement.remove()
                                    })
                                    
                                    // ⚠️ IMPORTANT: Forcer le chargement en définissant l'attribut src après appendChild
                                    // Certains navigateurs nécessitent que le track soit dans le DOM avant de charger
                                    setTimeout(() => {
                                      if (trackElement.parentNode) {
                                        // Relancer le chargement en modifiant l'attribut src
                                        const currentSrc = trackElement.src
                                        trackElement.src = ''
                                        trackElement.src = currentSrc
                                      }
                                    }, 100)
                                    
                                    // Ajouter à la liste des tracks disponibles
                                    // ⚠️ CRITIQUE: Les tracks téléchargés ont leur propre URL, pas un index de stream
                                    downloadedTracks.push({
                                      index: subtitleTracks.length + downloadedTracks.length,
                                      language: lang === 'fr' ? 'Français' : 'English',
                                      title: `Téléchargé depuis OpenSubtitles`,
                                      isDownloaded: true, // Marquer comme téléchargé
                                      sourceUrl: vttUrl // URL de l'API pour ce track
                                    } as SubtitleTrack)
                                  }
                                } else {
                                  // Échec téléchargement sous-titre
                                }
                              } catch (err) {
                                console.error(`❌ Erreur téléchargement ${lang}:`, err)
                              }
                            }
                            
                            if (downloadedTracks.length > 0) {
                              // Mettre à jour la liste des tracks
                              setSubtitleTracks([...subtitleTracks, ...downloadedTracks])
                              
                              // ⚠️ CRITIQUE: Attendre que les tracks soient ajoutés au DOM avant d'essayer de les activer
                              // Utiliser plusieurs tentatives pour s'assurer que les cues sont chargés
                              let activationAttempts = 0
                              const maxAttempts = 5
                              
                              const tryActivateTrack = () => {
                                if (!videoRef.current) return
                                
                                const allTextTracks = Array.from(videoRef.current.textTracks)
                                console.log(`🔍 [APRÈS TÉLÉCHARGEMENT] Tentative ${activationAttempts + 1}/${maxAttempts}: ${allTextTracks.length} textTracks disponibles`)
                                
                                allTextTracks.forEach((t, i) => {
                                  const cuesCount = t.cues ? t.cues.length : 0
                                  const activeCuesCount = t.activeCues ? t.activeCues.length : 0
                                  console.log(`   [${i}] language="${t.language}", label="${t.label}", mode="${t.mode}", cues=${cuesCount} (actifs: ${activeCuesCount})`)
                                })
                                
                                // Trouver et activer le premier track téléchargé (Français)
                                const frenchTrack = allTextTracks.find(t => 
                                  t.label === 'Français' || t.language === 'fr' || t.language?.toLowerCase().startsWith('fr')
                                )
                                
                                if (frenchTrack) {
                                  const cuesCount = frenchTrack.cues ? frenchTrack.cues.length : 0
                                  
                                  // Si les cues sont chargés, activer immédiatement
                                  if (cuesCount > 0) {
                                    frenchTrack.mode = 'showing'
                                    console.log(`✅ [ACTIVATION] Track français activé: mode="${frenchTrack.mode}", cues=${cuesCount}`)
                                    setSelectedSubtitle(subtitleTracks.length) // Index du premier track téléchargé
                                    return true // Succès
                                  } else if (activationAttempts < maxAttempts - 1) {
                                    // Les cues ne sont pas encore chargés, réessayer
                                    console.log(`   ⏳ Cues pas encore chargés pour le track français, réessai dans 500ms...`)
                                    activationAttempts++
                                    setTimeout(tryActivateTrack, 500)
                                    return false
                                  } else {
                                    // Dernière tentative, activer quand même
                                    frenchTrack.mode = 'showing'
                                    console.log(`⚠️ [ACTIVATION] Track français activé sans cues (dernière tentative)`)
                                    setSelectedSubtitle(subtitleTracks.length)
                                    return true
                                  }
                                } else {
                                  console.warn(`⚠️ Track français non trouvé, activation du premier track téléchargé`)
                                  // Fallback: activer le premier track téléchargé par index
                                  const firstDownloadedIdx = subtitleTracks.length
                                  if (firstDownloadedIdx < allTextTracks.length) {
                                    const track = allTextTracks[firstDownloadedIdx]
                                    const cuesCount = track.cues ? track.cues.length : 0
                                    
                                    if (cuesCount > 0 || activationAttempts >= maxAttempts - 1) {
                                      track.mode = 'showing'
                                      console.log(`✅ [ACTIVATION] Premier track activé (index ${firstDownloadedIdx}), cues=${cuesCount}`)
                                      setSelectedSubtitle(firstDownloadedIdx)
                                      return true
                                    } else {
                                      activationAttempts++
                                      setTimeout(tryActivateTrack, 500)
                                      return false
                                    }
                                  }
                                }
                                return false
                              }
                              
                              // Première tentative après 1 seconde
                              setTimeout(tryActivateTrack, 1000)
                              
                              console.log(`✅ [TERMINÉ] ${downloadedTracks.length} sous-titre(s) téléchargé(s) depuis OpenSubtitles`)
                            } else {
                              setError('Aucun sous-titre trouvé sur OpenSubtitles')
                              setTimeout(() => setError(null), 5000)
                            }
                          } catch (error) {
                            console.error('Erreur téléchargement sous-titres:', error)
                            setError('Erreur lors du téléchargement des sous-titres')
                            setTimeout(() => setError(null), 5000)
                          } finally {
                            setIsDownloadingSubtitles(false)
                          }
                        }}
                        style={{ opacity: isDownloadingSubtitles ? 0.5 : 1 }}
                      >
                        <div className={menuStyles.settingsOptionInfo}>
                          <span className={menuStyles.settingsOptionTitle}>
                            {isDownloadingSubtitles ? 'Téléchargement...' : 'Télécharger depuis OpenSubtitles'}
                          </span>
                          <span className={menuStyles.settingsOptionSubtitle}>
                            {isDownloadingSubtitles ? 'Recherche en cours...' : 'Français et Anglais'}
                          </span>
                        </div>
                        {isDownloadingSubtitles && (
                          <svg className={menuStyles.settingsCheckmark} viewBox="0 0 24 24" fill="currentColor" style={{ animation: 'spin 1s linear infinite' }}>
                            <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Fullscreen */}
            <button onClick={handleFullscreen} className={styles.controlBtn}>
              <svg viewBox="0 0 24 24">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
