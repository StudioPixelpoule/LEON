'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import styles from './SimpleVideoPlayer.module.css'
import menuStyles from './SettingsMenu.module.css'

interface SimpleVideoPlayerProps {
  src: string
  title?: string
  subtitle?: string
  onClose: () => void
  poster?: string
}

interface AudioTrack {
  index: number
  language: string
  title?: string
  codec?: string
}

interface SubtitleTrack {
  index: number
  language: string
  title?: string
  codec?: string
  forced?: boolean
}

// Nettoyer FFmpeg
async function cleanupFFmpeg() {
  try {
    await fetch('/api/cleanup-v2', { method: 'POST' })
    console.log('🧹 Processus FFmpeg nettoyés (v2)')
  } catch (error) {
    console.error('Erreur nettoyage:', error)
  }
}

export default function SimpleVideoPlayer({ 
  src, 
  title, 
  subtitle, 
  onClose,
  poster
}: SimpleVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const settingsMenuRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const retryCountRef = useRef(0)
  const maxRetries = 10
  const realDurationRef = useRef<number>(0) // Durée réelle du fichier
  
  // États du lecteur
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isSeeking, setIsSeeking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [bufferReady, setBufferReady] = useState(false) // 🚦 Flag pour bloquer l'autoplay
  
  // Menu et pistes
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
  const [selectedAudio, setSelectedAudio] = useState(0)
  const [selectedSubtitle, setSelectedSubtitle] = useState<number | null>(null)
  
  // Refs pour la gestion d'état
  const hideControlsTimeout = useRef<NodeJS.Timeout>()
  const currentVideoUrl = useRef(src)
  const isChangingTrack = useRef(false)
  const hasStartedPlaying = useRef(false)
  const bufferCheckIntervalRef = useRef<NodeJS.Timeout | null>(null) // 🔧 Pour nettoyer l'intervalle buffer

  // Extraire le filepath depuis l'URL
  const getFilepath = useCallback(() => {
    const urlParams = new URLSearchParams(src.split('?')[1] || '')
    return urlParams.get('path')
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
          console.log(`⏱️ Durée: ${data.formatted}`)
          realDurationRef.current = data.duration // Sauvegarder la vraie durée
          setDuration(data.duration)
        }
      })
      .catch(err => {
        console.log('⚠️ API durée non disponible, récupération depuis la vidéo')
      })
    
    // Récupérer les pistes (optionnel)
    fetch(`/api/media-info?path=${encodeURIComponent(filepath)}`)
      .then(res => {
        if (!res.ok) throw new Error('API media-info non disponible')
        return res.json()
      })
      .then(data => {
        console.log('📀 Pistes détectées:', data)
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
  }, [getFilepath])

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
          } else if (document.fullscreenElement) {
            document.exitFullscreen()
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
    
    console.log('🎬 Chargement vidéo:', currentVideoUrl.current)
    
    // Nettoyer l'instance HLS précédente
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    
    // Vérifier si c'est une URL HLS
    const isHLS = currentVideoUrl.current.includes('playlist=true') || currentVideoUrl.current.includes('.m3u8')
    
    if (isHLS) {
      // Utiliser HLS.js pour les navigateurs non-Safari
      if (Hls.isSupported()) {
        console.log('📺 Utilisation de HLS.js')
        // 🎯 Configuration NETFLIX-LIKE optimisée
        const hls = new Hls({
          debug: false,
          enableWorker: true,
          startPosition: -1,                // -1 = démarrer au début du buffer (accepte les micro-décalages)
          // Buffer optimisé (30-60s comme Netflix)
          maxBufferLength: 30,              // 30s ahead
          maxMaxBufferLength: 60,           // 60s max (au lieu de 600s)
          maxBufferSize: 30 * 1000 * 1000,  // 30MB (au lieu de 120MB)
          backBufferLength: 10,             // Garder 10s en arrière
          maxBufferHole: 0.5,               // Tolérance 500ms
          nudgeOffset: 0.1,                 // Accepter les décalages jusqu'à 100ms
          nudgeMaxRetry: 3,                 // Réessayer 3x avant d'abandonner
          // ✅ ACTIVER le prefetch pour anticiper les segments
          startFragPrefetch: true,
          // Timeouts agressifs
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 3,
          manifestLoadingRetryDelay: 500,
          levelLoadingTimeOut: 10000,
          fragLoadingTimeOut: 10000,
          fragLoadingMaxRetry: 4,
          fragLoadingRetryDelay: 300,
          // ABR et progressive
          progressive: true,
          startLevel: -1
        })
        hlsRef.current = hls
        
        hls.loadSource(currentVideoUrl.current)
        hls.attachMedia(video)
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('📋 Manifest HLS chargé')
          retryCountRef.current = 0
          
          // 🧹 Nettoyer l'ancien intervalle si existant
          if (bufferCheckIntervalRef.current) {
            clearInterval(bufferCheckIntervalRef.current)
            bufferCheckIntervalRef.current = null
          }
          
          // 🧠 BUFFER ADAPTATIF: check FFmpeg + buffer toutes les 250ms
          console.log('🎬 Buffer adaptatif activé (check 250ms)')
          
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
            
            // État FFmpeg (check toutes les secondes = 4 x 250ms)
            let ffmpegStatus = null
            if (checkCount % 4 === 0) {
              ffmpegStatus = await getFFmpegStatus()
            }
            
            const segmentsReady = ffmpegStatus?.segmentsReady || 0
            const isComplete = ffmpegStatus?.isComplete || false
            
            // 🧠 DÉCISION INTELLIGENTE
            // - Si transcodage complet : lancer dès qu'on a 10s
            // - Sinon : attendre 15 segments OU 30s de buffer
            const canStart = isComplete 
              ? bufferedSeconds >= 10
              : (segmentsReady >= 15 || bufferedSeconds >= 30)
            
            // Log toutes les secondes
            if (checkCount % 4 === 0) {
              console.log(`📊 Buffer: ${bufferedSeconds.toFixed(1)}s | FFmpeg: ${segmentsReady} segments${isComplete ? ' (complet)' : ''}`)
            }
            
            if (canStart) {
              hasStarted = true
              if (bufferCheckIntervalRef.current) {
                clearInterval(bufferCheckIntervalRef.current)
                bufferCheckIntervalRef.current = null
              }
              console.log(`✅ Prêt à lancer ! (${bufferedSeconds.toFixed(1)}s buffer, ${segmentsReady} segments)`)
              setBufferReady(true)
              
              // Muter temporairement pour autoplay
              const wasMuted = video.muted
              video.muted = true
              
              video.play().then(() => {
                setIsPlaying(true)
                setIsLoading(false)
                console.log('▶️ Lecture démarrée')
                setTimeout(() => { video.muted = wasMuted }, 100)
              }).catch((err) => {
                console.warn('⚠️ Autoplay bloqué:', err.message)
                video.muted = wasMuted
                setIsLoading(false)
              })
            }
          }, 250) // Check toutes les 250ms
        })
        
        // 🛡️ PROTECTION: Surveillance du buffer en continu pour éviter de rattraper FFmpeg
        let bufferWatchdog: NodeJS.Timeout | null = null
        
        hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
          // Log silencieux (décommenter pour debug)
          // const frag = data.frag
          // console.log(`📦 Fragment ${frag.sn} | start: ${frag.start.toFixed(2)}s`)
        })
        
        // 🔍 Surveiller le buffer toutes les 2 secondes pendant la lecture
        const startBufferWatchdog = () => {
          if (bufferWatchdog) clearInterval(bufferWatchdog)
          
          bufferWatchdog = setInterval(() => {
            if (!video.paused && video.buffered.length > 0) {
              const currentPos = video.currentTime
              const bufferedEnd = video.buffered.end(video.buffered.length - 1)
              const bufferAhead = bufferedEnd - currentPos
              
              // 🚨 Si moins de 10s de buffer restant, PAUSE automatique
              if (bufferAhead < 10) {
                console.warn(`⚠️ Buffer faible ! (${bufferAhead.toFixed(1)}s restants) → PAUSE`)
                video.pause()
                setIsPlaying(false)
                setIsLoading(true)
                
                // Attendre d'avoir 20s de buffer avant de reprendre
                const resumeCheck = setInterval(() => {
                  if (video.buffered.length > 0) {
                    const newBufferAhead = video.buffered.end(video.buffered.length - 1) - video.currentTime
                    console.log(`📊 Rebuffering: ${newBufferAhead.toFixed(1)}s / 20s`)
                    
                    if (newBufferAhead >= 20) {
                      clearInterval(resumeCheck)
                      // 🎯 Muter temporairement pour l'autoplay
                      const wasMuted = video.muted
                      video.muted = true
                      
                      video.play().then(() => {
                        setIsPlaying(true)
                        setIsLoading(false)
                        console.log('✅ Buffer rechargé, reprise')
                        
                        // Remettre le son après 100ms
                        setTimeout(() => {
                          video.muted = wasMuted
                        }, 100)
                      }).catch(() => {
                        video.muted = wasMuted
                        setIsLoading(false)
                      })
                    }
                  }
                }, 1000)
              }
            }
          }, 2000) // Check toutes les 2 secondes
        }
        
        // Démarrer le watchdog après le premier play
        video.addEventListener('play', startBufferWatchdog, { once: true })
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('❌ Erreur HLS:', data)
          
          if (data.fatal) {
            switch(data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('🔄 Erreur réseau détectée')
                
                // ✅ RETRY GRADUEL : 1s, 3s, 5s, 10s
                const retryDelays = [1000, 3000, 5000, 10000]
                const maxRetries = retryDelays.length
                
                if (retryCountRef.current >= maxRetries) {
                  console.error(`❌ Maximum de tentatives atteint (${maxRetries})`)
                  setError('Impossible de charger la vidéo après plusieurs tentatives')
                  setIsLoading(false)
                  return
                }
                
                const delay = retryDelays[retryCountRef.current]
                retryCountRef.current++
                console.log(`🔄 Retry ${retryCountRef.current}/${maxRetries} dans ${delay}ms`)
                
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
                // Pour les autres erreurs fatales, réessayer après un délai
                console.log('🔄 Rechargement complet dans 3s...')
                setTimeout(() => {
                  hls.destroy()
                  // 🔧 Config identique à l'initialisation
                  const newHls = new Hls({
                    debug: false,
                    enableWorker: true,
                    startPosition: -1,
                    maxBufferLength: 30,
                    maxMaxBufferLength: 60,
                    maxBufferSize: 30 * 1000 * 1000,
                    backBufferLength: 10,
                    maxBufferHole: 0.5,
                    nudgeOffset: 0.1,
                    nudgeMaxRetry: 3,
                    startFragPrefetch: true,
                    progressive: true
                  })
                  hlsRef.current = newHls
                  newHls.loadSource(currentVideoUrl.current)
                  newHls.attachMedia(video)
                }, 3000)
                break
            }
          } else if (data.details === 'bufferStalledError') {
            console.log('⏳ Buffer en attente...')
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari support natif HLS
        console.log('🎯 Safari: support HLS natif')
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
      console.log('🎬 Chargement vidéo standard')
      video.src = currentVideoUrl.current
      video.load()
    }
    
    // Essayer de jouer dès que possible
    const tryAutoplay = async () => {
      // 🚦 BLOQUER si le buffer n'est pas prêt (pour HLS uniquement)
      const isHLS = src.includes('/api/hls')
      if (isHLS && !bufferReady) {
        console.log('🚫 Autoplay bloqué : buffer pas encore prêt')
        return
      }
      
      try {
        // Attendre un peu si la vidéo n'est pas prête
        if (video.readyState < 2) {
          console.log('⏳ Attente readyState...')
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        console.log('🎮 Tentative de play()...')
        const playPromise = video.play()
        hasStartedPlaying.current = true
        
        if (playPromise !== undefined) {
          await playPromise
          console.log('▶️ Lecture démarrée automatiquement')
          console.log('📊 État vidéo:', {
            paused: video.paused,
            currentTime: video.currentTime,
            duration: video.duration,
            readyState: video.readyState,
            networkState: video.networkState,
            src: video.src
          })
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
      console.log('✅ Vidéo prête (canplay)')
      // ⚠️ NE PAS appeler tryAutoplay ici pour HLS
      // Le buffer check intelligent le fera au bon moment
      const isHLS = src.includes('/api/hls')
      if (!isHLS) {
        setIsLoading(false)
        tryAutoplay()
      }
    }
    
    const handleCanPlayThrough = () => {
      console.log('✅ Vidéo peut être lue sans interruption')
      // ⚠️ NE PAS appeler tryAutoplay ici pour HLS
      // Le buffer check intelligent le fera au bon moment
      const isHLS = src.includes('/api/hls')
      if (!isHLS && !isPlaying) {
        tryAutoplay()
      }
    }
    
    const handlePlay = () => {
      console.log('🎵 Événement play déclenché')
      hasStartedPlaying.current = true
      setIsPlaying(true)
      setIsLoading(false)
    }
    
    const handlePause = () => {
      console.log('⏸️ Événement pause déclenché')
      setIsPlaying(false)
    }
    
    const handleTimeUpdate = () => {
      const currentPos = video.currentTime
      
      // 🔍 DEBUG: Détecter les sauts anormaux
      if (Math.abs(currentPos - currentTime) > 5 && currentTime > 0) {
        console.warn(`⚠️ SAUT DÉTECTÉ: ${currentTime.toFixed(1)}s → ${currentPos.toFixed(1)}s (delta: ${(currentPos - currentTime).toFixed(1)}s)`)
      }
      
      // Vérifier si on a atteint la fin d'un segment HLS (reset inattendu)
      if (currentPos < 1 && video.currentTime < currentTime - 1) {
        console.warn(`⚠️ Reset détecté: ${currentTime} → ${currentPos}`)
        // Ne pas mettre à jour si c'est un reset non voulu
        return
      }
      
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
      }
    }
    
    const handleLoadedMetadata = () => {
      console.log('📊 Metadata chargées')
      // Ne PAS écraser la durée si on a déjà la vraie durée depuis l'API
      if (!realDurationRef.current && isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration)
      }
    }
    
    const handleLoadedData = () => {
      console.log('📦 Données chargées')
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
            msg = 'Format non supporté - Transcodage en cours...'
            console.log('🔄 Tentative de rechargement...')
            // Pour l'erreur 4, on réessaye après un délai
            setTimeout(() => {
              if (video.src) {
                video.load()
                tryAutoplay()
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
  }, [duration])

  // Changement de langue audio DYNAMIQUE
  const handleAudioChange = useCallback((track: AudioTrack, idx: number) => {
    if (!videoRef.current || selectedAudio === idx) {
      setShowSettingsMenu(false)
      return
    }
    
    console.log(`🔊 Changement audio: ${track.language} (index: ${track.index})`)
    
    const video = videoRef.current
    const currentPos = video.currentTime
    const wasPlaying = !video.paused
    const filepath = getFilepath()
    
    if (!filepath) return
    
    // Construire la nouvelle URL avec l'index de piste correct (API v2)
    const newUrl = src.includes('hls-v2') 
      ? `/api/hls-v2?path=${encodeURIComponent(filepath)}&playlist=true&audio=${track.index}`
      : `/api/hls?path=${encodeURIComponent(filepath)}&playlist=true&audio=${track.index}`
    
    console.log('🔄 Nouvelle URL:', newUrl)
    
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
      // 🔧 Config identique à l'initialisation
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        startPosition: -1,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 30 * 1000 * 1000,
        backBufferLength: 10,
        maxBufferHole: 0.5,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 3,
        startFragPrefetch: true,
        progressive: true
      })
      hlsRef.current = hls
      
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
  }, [selectedAudio, getFilepath])

  // Changement de sous-titres DYNAMIQUE
  const handleSubtitleChange = useCallback((idx: number | null) => {
    if (!videoRef.current) return
    
    console.log(`📝 Changement sous-titres: ${idx === null ? 'Désactivés' : `piste ${idx}`}`)
    
    const video = videoRef.current
    setSelectedSubtitle(idx)
    setShowSettingsMenu(false)
    
    // Supprimer les pistes existantes
    const existingTracks = video.querySelectorAll('track')
    existingTracks.forEach(t => t.remove())
    
    // Désactiver toutes les text tracks
    Array.from(video.textTracks).forEach(t => {
      t.mode = 'disabled'
    })
    
    // Si pas de sous-titres, on s'arrête
    if (idx === null) {
      console.log('✅ Sous-titres désactivés')
      return
    }
    
    // Ajouter la nouvelle piste
    const track = subtitleTracks[idx]
    const filepath = getFilepath()
    
    if (!filepath || !track) return
    
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
        console.log(`✅ Sous-titres activés: ${track.language}`)
      }
    })
    
    trackElement.addEventListener('error', () => {
      console.error(`❌ Erreur chargement sous-titres: ${track.language}`)
    })
  }, [subtitleTracks, getFilepath])

  // Contrôles
  const handleMouseMove = useCallback(() => {
    setShowControls(true)
    
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current)
    }

    if (isPlaying && !showSettingsMenu) {
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
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else if (containerRef.current) {
      containerRef.current.requestFullscreen()
    }
  }, [])

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current || isDragging) return
    
    const rect = progressRef.current.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const actualDuration = realDurationRef.current || duration || videoRef.current.duration
    
    if (isFinite(actualDuration) && actualDuration > 0) {
      videoRef.current.currentTime = percent * actualDuration
    }
  }

  const handleProgressDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current) return
    
    setIsDragging(true)
    const rect = progressRef.current.getBoundingClientRect()
    
    const updatePosition = (clientX: number) => {
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const actualDuration = realDurationRef.current || duration || videoRef.current?.duration || 0
      
      if (isFinite(actualDuration) && actualDuration > 0 && videoRef.current) {
        videoRef.current.currentTime = percent * actualDuration
      }
    }
    
    updatePosition(e.clientX)
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) updatePosition(e.clientX)
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
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
      className={styles.container} 
      onMouseMove={handleMouseMove}
      onMouseLeave={() => !showSettingsMenu && setShowControls(false)}
    >
      {/* Barre de titre */}
      <div className={`${styles.titleBar} ${showControls ? styles.visible : ''}`}>
        <button className={styles.closeButton} onClick={() => {
          cleanupFFmpeg()
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
        onDoubleClick={handleFullscreen}
      />

      {/* Loader */}
      {(isLoading || isSeeking) && !error && (
        <div className={styles.loader}>
          <div className={styles.spinner}></div>
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
                left: `${Math.min(Math.max(0, progressPercent), 100)}%`,
                transform: `translateX(-50%) translateY(-50%)`
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
                    {subtitleTracks.length > 0 && (
                      <div className={menuStyles.settingsSection}>
                        <div className={menuStyles.settingsSectionTitle}>Sous-titres</div>
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
                      </div>
                    )}
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
