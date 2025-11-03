/**
 * 🎬 SIMPLE VIDEO PLAYER - VERSION OPTIMISÉE NETFLIX-LIKE
 * 
 * Améliorations majeures :
 * - Buffer management intelligent adaptatif
 * - Configuration HLS.js optimisée
 * - Gestion d'erreurs avec retry graduel
 * - Préchargement stratégique
 * - Communication avec FFmpeg status
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import Hls from 'hls.js'

// 🎯 CONFIGURATION HLS.JS OPTIMISÉE NETFLIX-STYLE
const HLS_CONFIG = {
  // Performance & Rapidité
  enableWorker: true,
  lowLatencyMode: false, // VOD, pas live
  
  // Buffer Management Optimisé
  backBufferLength: 30,              // 30s en arrière (au lieu de 90)
  maxBufferLength: 60,               // 1 minute ahead (au lieu de 5 min)
  maxMaxBufferLength: 120,           // 2 minutes max (au lieu de 10 min)
  maxBufferSize: 30 * 1000 * 1000,  // 30MB (au lieu de 120MB)
  maxBufferHole: 0.3,                // Tolérance 300ms
  
  // Prefetch & Chargement Proactif
  startFragPrefetch: true,           // ACTIVER prefetch
  progressive: true,                 // Lecture progressive
  
  // Timeouts Agressifs
  manifestLoadingTimeOut: 10000,     // 10s pour manifest
  manifestLoadingMaxRetry: 3,        // 3 essais
  manifestLoadingRetryDelay: 500,    // 500ms entre essais
  
  levelLoadingTimeOut: 10000,
  levelLoadingMaxRetry: 3,
  levelLoadingRetryDelay: 500,
  
  fragLoadingTimeOut: 10000,         // 10s pour fragment
  fragLoadingMaxRetry: 4,
  fragLoadingRetryDelay: 300,
  
  // Démarrage Optimisé
  startLevel: -1,                    // Auto-select qualité
  capLevelToPlayerSize: true,
  
  // Debug
  debug: false,
  
  // ABR (Adaptive Bitrate)
  abrEwmaDefaultEstimate: 500000,
  abrBandWidthFactor: 0.95,
  abrBandWidthUpFactor: 0.7
}

// 📊 CONSTANTES BUFFER
const BUFFER_CONFIG = {
  INITIAL_TARGET: 10,    // Démarrage rapide avec 10s
  SAFE_TARGET: 20,       // Buffer confortable 20s
  SEGMENT_DURATION: 2,   // Durée d'un segment HLS
  CHECK_INTERVAL: 250,   // Check buffer toutes les 250ms
  TIMEOUT: 60000         // Timeout max 60s
}

interface BufferStatus {
  ready: boolean
  bufferedSeconds: number
  targetSeconds: number
  ffmpegSegments: number
  ffmpegComplete: boolean
}

interface FFmpegStatus {
  exists: boolean
  segmentsReady: number
  totalSegments: number
  isComplete: boolean
  progress: number
}

export function SimpleVideoPlayer({ src, ...props }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [bufferStatus, setBufferStatus] = useState<BufferStatus>({
    ready: false,
    bufferedSeconds: 0,
    targetSeconds: BUFFER_CONFIG.INITIAL_TARGET,
    ffmpegSegments: 0,
    ffmpegComplete: false
  })
  
  const MAX_RETRIES = 3
  const RETRY_DELAYS = [1000, 3000, 5000]
  
  // 🧠 CHECK ÉTAT FFMPEG
  const checkFFmpegProgress = useCallback(async (filepath: string): Promise<FFmpegStatus | null> => {
    try {
      const res = await fetch(`/api/hls/status?path=${encodeURIComponent(filepath)}`)
      if (!res.ok) return null
      
      const data = await res.json()
      console.log('📊 FFmpeg status:', data)
      
      return {
        exists: data.exists || false,
        segmentsReady: data.segmentsReady || 0,
        totalSegments: data.totalSegments || 0,
        isComplete: data.isComplete || false,
        progress: data.progress || 0
      }
    } catch (err) {
      console.warn('⚠️ Impossible de récupérer l\'état FFmpeg:', err)
      return null
    }
  }, [])
  
  // 🚀 BUFFER MANAGEMENT INTELLIGENT
  useEffect(() => {
    if (!videoRef.current || bufferStatus.ready || !src) return
    
    const video = videoRef.current
    let checkCount = 0
    const startTime = Date.now()
    
    // Extraire le filepath du src
    const urlParams = new URLSearchParams(src.split('?')[1])
    const filepath = urlParams.get('path')
    
    if (!filepath) {
      console.error('❌ Impossible d\'extraire le filepath')
      setIsLoading(false)
      return
    }
    
    console.log('🎬 Démarrage buffer check intelligent...')
    
    const bufferInterval = setInterval(async () => {
      checkCount++
      const elapsed = Date.now() - startTime
      
      // 📊 Check buffer local
      let bufferedSeconds = 0
      if (video.buffered.length > 0) {
        bufferedSeconds = video.buffered.end(0) - video.buffered.start(0)
      }
      
      // 🔍 Check état FFmpeg (toutes les 2 secondes)
      let ffmpegState: FFmpegStatus | null = null
      if (checkCount % 8 === 0) { // 8 * 250ms = 2s
        ffmpegState = await checkFFmpegProgress(filepath)
      }
      
      // 🧠 DÉCISION INTELLIGENTE
      const canStart = (
        bufferedSeconds >= BUFFER_CONFIG.INITIAL_TARGET ||  // Minimum 10s
        (ffmpegState && ffmpegState.segmentsReady >= 10) || // Ou 10 segments prêts
        (ffmpegState?.isComplete && bufferedSeconds >= 5)   // Ou complet + 5s
      )
      
      // 📈 Logger progression
      if (checkCount % 4 === 0) { // Log toutes les secondes
        console.log(`📊 Buffer: ${bufferedSeconds.toFixed(1)}s | FFmpeg: ${ffmpegState?.segmentsReady || '?'} segments`)
      }
      
      if (canStart) {
        clearInterval(bufferInterval)
        console.log(`✅ Buffer prêt ! (${bufferedSeconds.toFixed(1)}s / ${elapsed}ms)`)
        
        setBufferStatus({
          ready: true,
          bufferedSeconds,
          targetSeconds: BUFFER_CONFIG.SAFE_TARGET,
          ffmpegSegments: ffmpegState?.segmentsReady || 0,
          ffmpegComplete: ffmpegState?.isComplete || false
        })
        setIsLoading(false)
        
        // Autoplay
        video.play().catch(err => {
          console.warn('Autoplay bloqué:', err)
        })
      }
      
      // 🚨 TIMEOUT DE SÉCURITÉ
      if (elapsed >= BUFFER_CONFIG.TIMEOUT) {
        clearInterval(bufferInterval)
        console.warn(`⏰ Timeout buffer (${elapsed}ms), lancement forcé`)
        
        setBufferStatus({
          ready: true,
          bufferedSeconds,
          targetSeconds: 5,
          ffmpegSegments: ffmpegState?.segmentsReady || 0,
          ffmpegComplete: false
        })
        setIsLoading(false)
        
        video.play().catch(err => console.warn('Autoplay bloqué:', err))
      }
    }, BUFFER_CONFIG.CHECK_INTERVAL)
    
    return () => {
      clearInterval(bufferInterval)
    }
  }, [src, bufferStatus.ready, checkFFmpegProgress])
  
  // 🎬 INITIALISATION HLS
  useEffect(() => {
    if (!videoRef.current || !src) return
    
    const video = videoRef.current
    
    // Réinitialiser les états
    setError(null)
    setRetryCount(0)
    setIsLoading(true)
    setBufferStatus({
      ready: false,
      bufferedSeconds: 0,
      targetSeconds: BUFFER_CONFIG.INITIAL_TARGET,
      ffmpegSegments: 0,
      ffmpegComplete: false
    })
    
    if (Hls.isSupported()) {
      console.log('🎯 HLS.js supporté, initialisation...')
      
      // Créer instance HLS avec config optimisée
      const hls = new Hls(HLS_CONFIG)
      hlsRef.current = hls
      
      // 📦 ÉVÉNEMENTS HLS
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('📦 Manifest HLS parsé')
      })
      
      hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
        console.log(`📦 Segment ${data.frag.sn} chargé`)
      })
      
      hls.on(Hls.Events.BUFFER_APPENDED, () => {
        if (video.buffered.length > 0) {
          const buffered = video.buffered.end(0) - video.buffered.start(0)
          console.log(`📊 Buffer mis à jour: ${buffered.toFixed(1)}s`)
        }
      })
      
      // ❌ GESTION D'ERREURS INTELLIGENTE
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('❌ Erreur HLS:', data)
        
        if (data.fatal) {
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('🔄 Erreur réseau détectée')
              
              if (retryCount < MAX_RETRIES) {
                const delay = RETRY_DELAYS[retryCount] || 5000
                console.log(`⏳ Retry ${retryCount + 1}/${MAX_RETRIES} dans ${delay}ms`)
                
                setTimeout(() => {
                  if (data.details === 'manifestLoadError') {
                    console.log('🔄 Rechargement du manifest...')
                    hls.loadSource(src)
                  } else {
                    console.log('🔄 Reprise du chargement...')
                    hls.startLoad()
                  }
                  setRetryCount(prev => prev + 1)
                }, delay)
              } else {
                console.error('💀 Échec définitif après 3 tentatives')
                setError('Impossible de charger la vidéo. Vérifiez votre connexion.')
                setIsLoading(false)
              }
              break
              
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('🔄 Erreur média, tentative de récupération...')
              
              if (retryCount < MAX_RETRIES) {
                hls.recoverMediaError()
                setRetryCount(prev => prev + 1)
              } else {
                console.log('🔄 Rechargement complet du lecteur...')
                reloadPlayer()
              }
              break
              
            default:
              console.error('❌ Erreur fatale non gérée:', data.details)
              setError(`Erreur de lecture: ${data.details}`)
              setIsLoading(false)
              break
          }
        } else if (data.details === 'bufferStalledError') {
          console.log('⏳ Buffer en attente (non critique)')
        }
      })
      
      // Charger la source
      hls.loadSource(src)
      hls.attachMedia(video)
      
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari support natif
      console.log('🎯 Safari: support HLS natif')
      video.src = src
      video.load()
    } else {
      console.error('❌ HLS non supporté sur ce navigateur')
      setError('Votre navigateur ne supporte pas la lecture de cette vidéo.')
      setIsLoading(false)
    }
    
    // Cleanup
    return () => {
      if (hlsRef.current) {
        console.log('🧹 Nettoyage HLS.js')
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [src])
  
  // 🔄 FONCTION DE RECHARGEMENT COMPLET (dernier recours)
  const reloadPlayer = useCallback(() => {
    if (!videoRef.current || !hlsRef.current) return
    
    console.log('🔄 Rechargement complet du player...')
    
    const currentTime = videoRef.current.currentTime
    const wasPlaying = !videoRef.current.paused
    
    // Détruire proprement
    hlsRef.current.destroy()
    
    // Recréer HLS
    const newHls = new Hls(HLS_CONFIG)
    hlsRef.current = newHls
    
    newHls.loadSource(src)
    newHls.attachMedia(videoRef.current)
    
    // Restaurer la position
    newHls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime
        if (wasPlaying) {
          videoRef.current.play()
        }
      }
    })
    
    setRetryCount(0)
  }, [src])
  
  // 🎯 PRÉCHARGEMENT STRATÉGIQUE
  useEffect(() => {
    if (!videoRef.current || !hlsRef.current) return
    
    const video = videoRef.current
    const hls = hlsRef.current
    
    const handleTimeUpdate = () => {
      if (!video.buffered.length) return
      
      const currentTime = video.currentTime
      const bufferedEnd = video.buffered.end(video.buffered.length - 1)
      const bufferAhead = bufferedEnd - currentTime
      
      // 🎯 Si moins de 10s de buffer devant, logger
      if (bufferAhead < 10 && bufferAhead > 0) {
        console.log(`⚠️ Buffer faible: ${bufferAhead.toFixed(1)}s`)
      }
    }
    
    video.addEventListener('timeupdate', handleTimeUpdate)
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [videoRef.current, hlsRef.current])
  
  // Render
  return (
    <div className="video-player">
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Préparation de la vidéo...</p>
          {bufferStatus.bufferedSeconds > 0 && (
            <p className="buffer-info">
              Buffer: {bufferStatus.bufferedSeconds.toFixed(1)}s
            </p>
          )}
        </div>
      )}
      
      {error && (
        <div className="error-overlay">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Recharger
          </button>
        </div>
      )}
      
      <video
        ref={videoRef}
        controls
        {...props}
      />
    </div>
  )
}
