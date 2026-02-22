/**
 * useVideoCore - Coeur du lecteur vidéo
 * Extrait de SimpleVideoPlayer.tsx (Phase 8)
 * 
 * Responsabilités :
 * - Initialisation HLS.js / vidéo native
 * - Event listeners vidéo (timeupdate, play, pause, seeking, error, etc.)
 * - Chargement des infos média (durée, pistes audio/sous-titres)
 * - Gestion du buffer adaptatif et autoplay
 * - Récupération d'erreur réseau/média
 * - État de lecture (isPlaying, currentTime, duration, buffered, etc.)
 * - Gestion MP4 direct (pistes natives Safari, sous-titres)
 * - Preloader de segments HLS
 */

import { useState, useRef, useEffect, useCallback, type MutableRefObject, type Dispatch, type SetStateAction } from 'react'
import Hls from 'hls.js'
import { selectHlsConfig } from '@/lib/hls-config'
import { formatTime } from '../utils/timeUtils'
import type { AudioTrack, SubtitleTrack, PlayerPreferences, VideoElementWithAudioTracks } from '../types'

// Callbacks regroupés (utilisés via ref pour toujours être à jour)
interface VideoCoreCallbacks {
  // Audio manager
  onAudioTracksDiscovered: (tracks: AudioTrack[]) => void
  onInitialAudioSet: (index: number) => void
  // Subtitle manager
  onSubtitleTracksDiscovered: (tracks: SubtitleTrack[]) => void
  onInitialSubtitleSet: (index: number | null) => void
  // Next episode
  checkNextEpisode: (currentTime: number, duration: number) => void
  // Parent state
  setIsLoading: (v: boolean) => void
  setError: (v: string | null) => void
  // Volume (pour init MP4)
  setVolume: (v: number) => void
  setIsMuted: (m: boolean) => void
}

interface UseVideoCoreOptions {
  src: string
  initialPreferences?: PlayerPreferences
  connectionQuality: string

  // Refs partagés (créés dans le parent)
  videoRef: React.RefObject<HTMLVideoElement | null>
  hlsRef: MutableRefObject<Hls | null>

  // Ref et callback partagés (créés dans le parent)
  currentVideoUrl: MutableRefObject<string>
  getFilepath: () => string | null

  // Refs des managers audio/sous-titres (pour accès dans les effets)
  audioTracksRef: MutableRefObject<AudioTrack[]>
  selectedAudioRef: MutableRefObject<number>
  isChangingTrack: MutableRefObject<boolean>
  subtitleAbortControllerRef: MutableRefObject<AbortController | null>
  pendingSubtitleApplyRef: MutableRefObject<number | null>

  // Préférences
  getInitialPreferences: () => PlayerPreferences | null

  // Callbacks (toujours à jour via ref interne)
  callbacks: VideoCoreCallbacks
}

interface UseVideoCoreReturn {
  // États de lecture
  isPlaying: boolean
  currentTime: number
  duration: number
  buffered: number
  isSeeking: boolean
  isDragging: boolean
  bufferReady: boolean
  maxSeekableTime: number
  seekWarning: string | null
  isPreTranscoded: boolean

  // State setters nécessaires au parent
  setIsDragging: Dispatch<SetStateAction<boolean>>
  setSeekWarning: Dispatch<SetStateAction<string | null>>
  setMaxSeekableTime: Dispatch<SetStateAction<number>>

  // Refs nécessaires au parent
  realDurationRef: MutableRefObject<number>

  // Callbacks
  getAudioTrack: () => string
  handlePlayPause: () => void
  handleSkip: (seconds: number) => void
}

export function useVideoCore({
  src,
  initialPreferences,
  connectionQuality,
  videoRef,
  hlsRef,
  currentVideoUrl,
  getFilepath,
  audioTracksRef,
  selectedAudioRef,
  isChangingTrack,
  subtitleAbortControllerRef,
  pendingSubtitleApplyRef,
  getInitialPreferences,
  callbacks
}: UseVideoCoreOptions): UseVideoCoreReturn {

  // === ÉTATS ===
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [bufferReady, setBufferReady] = useState(false)
  const [maxSeekableTime, setMaxSeekableTime] = useState<number>(Infinity)
  const [seekWarning, setSeekWarning] = useState<string | null>(null)
  const [isPreTranscoded, setIsPreTranscoded] = useState<boolean>(false)

  // === REFS INTERNES ===
  const retryCountRef = useRef(0)
  const realDurationRef = useRef<number>(0)
  const lastKnownPositionRef = useRef<number>(0)
  const isRecoveringRef = useRef<boolean>(false)
  const hasStartedPlaying = useRef(false)
  const bufferCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastTimeRef = useRef(0)
  
  // Compteurs pour gestion intelligente des erreurs non-fatales
  const nonFatalErrorCountRef = useRef(0)
  const lastNonFatalErrorTimeRef = useRef(0)
  const bufferAppendErrorCountRef = useRef(0)

  // Ref pour callbacks (toujours à jour, pas de closure stale)
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks

  // === CALLBACKS ===
  const getAudioTrack = useCallback(() => {
    const urlParams = new URLSearchParams(src.split('?')[1] || '')
    return urlParams.get('audio') || '0'
  }, [src])

  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch(() => {})
    }
  }, [videoRef, isPlaying])

  const handleSkip = useCallback((seconds: number) => {
    if (!videoRef.current) return
    const actualDuration = realDurationRef.current || duration || videoRef.current.duration
    const newTime = Math.max(0, Math.min(actualDuration, videoRef.current.currentTime + seconds))
    videoRef.current.currentTime = newTime
  }, [videoRef, duration])

  // === EFFETS ===

  // Reset des positions au changement de source
  useEffect(() => {
    currentVideoUrl.current = src
    setCurrentTime(0)
    lastTimeRef.current = 0
    lastKnownPositionRef.current = 0
  }, [src])

  // Charger les infos des pistes et la durée
  useEffect(() => {
    const filepath = getFilepath()
    if (!filepath) return

    // Récupérer la durée
    fetch(`/api/video-duration?path=${encodeURIComponent(filepath)}`)
      .then(res => {
        if (!res.ok) throw new Error('API video-duration non disponible')
        return res.json()
      })
      .then(data => {
        if (data.duration > 0) {
          realDurationRef.current = data.duration
          setDuration(data.duration)
        }
      })
      .catch(() => {})
    
    // Récupérer les pistes
    fetch(`/api/media-info?path=${encodeURIComponent(filepath)}`)
      .then(res => {
        if (!res.ok) throw new Error('API media-info non disponible')
        return res.json()
      })
      .then(data => {
        const tracks = (data.audioTracks || []) as AudioTrack[]
        cbRef.current.onAudioTracksDiscovered(tracks)
        cbRef.current.onSubtitleTracksDiscovered(data.subtitleTracks || [])
        
        // Résolution de la piste audio préférée
        const savedPrefs = getInitialPreferences()
        const effectivePrefs = initialPreferences || savedPrefs
        
        let resolvedAudioIdx = 0
        let audioResolved = false
        
        // 1) Résolution par code langue
        if (effectivePrefs?.audioLanguage && tracks.length > 0) {
          const langMatchIdx = tracks.findIndex(t => 
            t.language.toLowerCase() === effectivePrefs.audioLanguage!.toLowerCase()
          )
          if (langMatchIdx !== -1) {
            resolvedAudioIdx = langMatchIdx
            audioResolved = true
            console.log(`[PLAYER] Piste audio résolue par langue: "${effectivePrefs.audioLanguage}" → index ${langMatchIdx} (${tracks[langMatchIdx].language})`, initialPreferences ? '(épisode)' : '(localStorage)')
          }
        }
        
        // 2) Fallback par index numérique
        if (!audioResolved && effectivePrefs?.audioTrackIndex !== undefined && tracks.length > effectivePrefs.audioTrackIndex) {
          resolvedAudioIdx = effectivePrefs.audioTrackIndex
          audioResolved = true
          console.log('[PLAYER] Préférence audio restaurée par index:', effectivePrefs.audioTrackIndex, initialPreferences ? '(épisode)' : '(localStorage)')
        }
        
        // 3) Fallback : français par défaut
        if (!audioResolved && tracks.length > 0) {
          const frenchAudioIdx = tracks.findIndex(t => 
            /^(fr|fre|fra|français)$/i.test(t.language) || /français/i.test(t.language)
          )
          if (frenchAudioIdx !== -1) {
            resolvedAudioIdx = frenchAudioIdx
            console.log(`[PLAYER] Piste audio française détectée: index ${frenchAudioIdx} (${tracks[frenchAudioIdx].language})`)
          }
        }
        
        cbRef.current.onInitialAudioSet(resolvedAudioIdx)
        
        // Corriger HLS.js si nécessaire
        if (hlsRef.current && hlsRef.current.audioTracks && hlsRef.current.audioTracks.length > 1) {
          if (hlsRef.current.audioTrack !== resolvedAudioIdx) {
            console.log(`[PLAYER] Correction audio post-fetch: HLS.js piste ${hlsRef.current.audioTrack} → ${resolvedAudioIdx}`)
            hlsRef.current.audioTrack = resolvedAudioIdx
          }
        }
        
        // Sous-titres : préférence explicite ou sélection intelligente
        if (effectivePrefs?.subtitleTrackIndex !== undefined && effectivePrefs.subtitleTrackIndex !== null) {
          cbRef.current.onInitialSubtitleSet(effectivePrefs.subtitleTrackIndex)
          console.log('[PLAYER] Préférence sous-titres restaurée:', effectivePrefs.subtitleTrackIndex, initialPreferences ? '(épisode)' : '(localStorage)')
        } else if (tracks.length > 0 && data.subtitleTracks?.length > 0) {
          const subtitles = data.subtitleTracks as SubtitleTrack[]
          const selectedTrack = tracks[resolvedAudioIdx]
          const isFrenchAudio = selectedTrack && (/^(fr|fre|fra|français)$/i.test(selectedTrack.language) || /français/i.test(selectedTrack.language))
          
          if (isFrenchAudio) {
            const forcedFrIdx = subtitles.findIndex(t => 
              t.forced === true && (/^(fr|fre|fra|français)$/i.test(t.language) || /français/i.test(t.language))
            )
            if (forcedFrIdx !== -1) {
              cbRef.current.onInitialSubtitleSet(forcedFrIdx)
              console.log(`[PLAYER] Audio FR → sous-titres forced FR activés: index ${forcedFrIdx}`)
            } else {
              console.log('[PLAYER] Audio FR → pas de sous-titres (aucun forced FR trouvé)')
            }
          } else {
            const frSubIdx = subtitles.findIndex(t => 
              !t.forced && (/^(fr|fre|fra|français)$/i.test(t.language) || /français/i.test(t.language))
            )
            if (frSubIdx !== -1) {
              cbRef.current.onInitialSubtitleSet(frSubIdx)
              console.log(`[PLAYER] Audio non-FR → sous-titres FR activés: index ${frSubIdx} (${subtitles[frSubIdx].language})`)
            } else {
              console.log('[PLAYER] Audio non-FR → aucun sous-titre FR disponible')
            }
          }
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFilepath, src])

  // MP4 direct : pistes audio natives et sous-titres natifs
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    
    const isDirectMP4 = !src.includes('/api/hls')
    if (!isDirectMP4) return
    
    const handleLoadedMetadata = () => {
      if (video.volume === 0) {
        video.volume = 1
        cbRef.current.setVolume(1)
      }
      if (video.muted) {
        video.muted = false
        cbRef.current.setIsMuted(false)
      }
      
      const videoWithAudioTracks = video as VideoElementWithAudioTracks
      if ('audioTracks' in videoWithAudioTracks && videoWithAudioTracks.audioTracks && videoWithAudioTracks.audioTracks.length > 0) {
        const preferredIdx = selectedAudioRef.current
        const nativeTracks = videoWithAudioTracks.audioTracks
        
        for (let i = 0; i < nativeTracks.length; i++) {
          const t = nativeTracks[i]
          if (t) t.enabled = false
        }
        
        const targetIdx = preferredIdx < nativeTracks.length ? preferredIdx : 0
        const targetTrack = nativeTracks[targetIdx]
        if (targetTrack) {
          targetTrack.enabled = true
          console.log(`[PLAYER] Piste audio native activée: ${targetIdx} (${targetTrack.language || targetTrack.label || 'inconnue'})`)
        }
      }
      
      // Détecter les sous-titres natifs
      const checkTextTracks = () => {
        const textTracks = Array.from(video.textTracks)
        if (textTracks.length > 0) {
          const showingTracks = textTracks.filter(t => t.mode === 'showing')
          if (showingTracks.length > 1) {
            console.warn(`[PLAYER] ${showingTracks.length} pistes en mode 'showing' simultanément, désactivation des doublons`)
            for (let i = 1; i < showingTracks.length; i++) {
              showingTracks[i].mode = 'disabled'
            }
          }
          
          if (audioTracksRef.current.length === 0 && textTracks.length > 0) {
            const defaultTrack = textTracks.find(t => t.mode === 'showing' || t.mode === 'hidden')
            if (defaultTrack && defaultTrack.mode !== 'showing') {
              textTracks.forEach(t => {
                if (t !== defaultTrack) t.mode = 'disabled'
              })
              defaultTrack.mode = 'showing'
            }
          }
        }
      }
      
      checkTextTracks()
      
      const subtitleCheckInterval = setInterval(() => {
        const textTracks = Array.from(video.textTracks)
        const showingTracks = textTracks.filter(t => t.mode === 'showing')
        if (showingTracks.length > 1) {
          for (let i = 1; i < showingTracks.length; i++) {
            showingTracks[i].mode = 'disabled'
          }
        }
      }, 1000)
      
      return () => {
        clearInterval(subtitleCheckInterval)
      }
    }
    
    if (video.readyState >= 1) {
      handleLoadedMetadata()
    } else {
      video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  // Synchroniser isPlaying avec l'état réel du video
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    
    const syncPlayState = () => {
      const actuallyPlaying = !video.paused && !video.ended && video.readyState > 2
      if (actuallyPlaying !== isPlaying) {
        setIsPlaying(actuallyPlaying)
      }
    }
    
    const syncInterval = setInterval(syncPlayState, 1000)
    
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
  }, [videoRef, isPlaying])

  // === EFFET PRINCIPAL : Initialisation HLS / vidéo ===
  useEffect(() => {
    if (!videoRef.current) return

    const video = videoRef.current
    
    // Ne pas recharger si on est en train de changer de piste
    if (isChangingTrack.current) {
      isChangingTrack.current = false
      return
    }
    
    // Nettoyer l'instance HLS précédente
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    
    const isHLS = currentVideoUrl.current.includes('playlist=true') || currentVideoUrl.current.includes('.m3u8')
    
    if (isHLS) {
      if (Hls.isSupported()) {
        const hlsConfig = selectHlsConfig({
          isFirstLoad: true,
          connectionQuality: connectionQuality as 'excellent' | 'good' | 'poor',
        })
        const hls = new Hls(hlsConfig)
        hlsRef.current = hls
        
        if (lastKnownPositionRef.current === 0) {
          video.currentTime = 0
          video.load()
        }
        
        hls.loadSource(currentVideoUrl.current)
        hls.attachMedia(video)
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          retryCountRef.current = 0
          
          if (lastKnownPositionRef.current > 5 && video.currentTime < 5) {
            video.currentTime = lastKnownPositionRef.current
          }
          
          // Appliquer la piste audio préférée
          if (hls.audioTracks && hls.audioTracks.length > 1) {
            const preferredIdx = selectedAudioRef.current
            if (preferredIdx >= 0 && preferredIdx < hls.audioTracks.length && hls.audioTrack !== preferredIdx) {
              console.log(`[PLAYER] MANIFEST_PARSED: application piste audio préférée: ${preferredIdx} (${hls.audioTracks[preferredIdx]?.name || hls.audioTracks[preferredIdx]?.lang})`)
              hls.audioTrack = preferredIdx
            }
          }
          
          if (bufferCheckIntervalRef.current) {
            clearInterval(bufferCheckIntervalRef.current)
            bufferCheckIntervalRef.current = null
          }
          
          // Buffer adaptatif (pré-transcodé uniquement)
          setIsPreTranscoded(true)
          setMaxSeekableTime(Infinity)
          console.log('[PLAYER] Fichier pré-transcodé détecté - scrubbing complet activé')
          
          let hasStarted = false
          
          bufferCheckIntervalRef.current = setInterval(() => {
            if (hasStarted) {
              if (bufferCheckIntervalRef.current) {
                clearInterval(bufferCheckIntervalRef.current)
                bufferCheckIntervalRef.current = null
              }
              return
            }
            
            let bufferedSeconds = 0
            if (video.buffered.length > 0) {
              bufferedSeconds = video.buffered.end(0) - video.buffered.start(0)
            }
            
            // Contenu pré-transcodé : démarrage rapide dès 2s de buffer
            if (bufferedSeconds >= 2) {
              hasStarted = true
              if (bufferCheckIntervalRef.current) {
                clearInterval(bufferCheckIntervalRef.current)
                bufferCheckIntervalRef.current = null
              }
              setBufferReady(true)
              
              const wasMuted = video.muted
              video.muted = true
              
              video.play().then(() => {
                setIsPlaying(true)
                cbRef.current.setIsLoading(false)
                setTimeout(() => { video.muted = wasMuted }, 100)
              }).catch((err) => {
                console.warn('[PLAYER] Autoplay bloqué:', err.message)
                video.muted = wasMuted
                cbRef.current.setIsLoading(false)
              })
            }
          }, 250)
        })
        
        hls.on(Hls.Events.FRAG_LOADED, () => {})
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('[PLAYER] Erreur HLS:', data.type, data.details)
          
          const savedPosition = lastKnownPositionRef.current || video.currentTime || 0
          const wasPlaying = !video.paused
          
          if (data.fatal) {
            switch(data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR: {
                console.log('[PLAYER] Erreur réseau détectée')
                
                const retryDelays = [1000, 3000, 5000, 10000]
                const maxNetworkRetries = retryDelays.length
                
                if (retryCountRef.current >= maxNetworkRetries) {
                  console.error(`[PLAYER] Maximum de tentatives atteint (${maxNetworkRetries})`)
                  cbRef.current.setError(`Impossible de charger la vidéo après plusieurs tentatives. Position sauvegardée: ${formatTime(savedPosition)}`)
                  cbRef.current.setIsLoading(false)
                  return
                }
                
                const delay = retryDelays[retryCountRef.current]
                retryCountRef.current++
                console.log(`[PLAYER] Retry ${retryCountRef.current}/${maxNetworkRetries} dans ${delay}ms`)
                
                setTimeout(() => {
                  console.log('[PLAYER] Rechargement...')
                  if (data.details === 'levelLoadError' || data.details === 'manifestLoadError') {
                    hls.loadSource(currentVideoUrl.current)
                  } else {
                    hls.startLoad()
                  }
                }, delay)
                break
              }
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('[PLAYER] Tentative de récupération média...')
                hls.recoverMediaError()
                break
              default: {
                console.log(`[PLAYER] Rechargement complet dans 3s... (position: ${savedPosition.toFixed(1)}s)`)
                isRecoveringRef.current = true
                
                setTimeout(() => {
                  hls.destroy()
                  
                  const recoveryConfig = selectHlsConfig({
                    isRecovery: true,
                    startPosition: savedPosition,
                  })
                  const newHls = new Hls(recoveryConfig)
                  hlsRef.current = newHls
                  
                  if (savedPosition <= 5) {
                    video.currentTime = 0
                    video.load()
                  }
                  
                  newHls.loadSource(currentVideoUrl.current)
                  newHls.attachMedia(video)
                  
                  newHls.on(Hls.Events.MANIFEST_PARSED, () => {
                    console.log(`[PLAYER] Manifest rechargé, restauration position: ${savedPosition.toFixed(1)}s`)
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
            }
          } else {
            // === Gestion intelligente des erreurs non-fatales ===
            const now = Date.now()
            
            // Réinitialiser le compteur si la dernière erreur date de plus de 30s
            if (now - lastNonFatalErrorTimeRef.current > 30000) {
              nonFatalErrorCountRef.current = 0
              bufferAppendErrorCountRef.current = 0
            }
            lastNonFatalErrorTimeRef.current = now
            
            if (data.details === 'bufferStalledError') {
              nonFatalErrorCountRef.current++
              console.log(`[PLAYER] Buffer stall (${nonFatalErrorCountRef.current}/10)`)
              
              // Après plusieurs stalls, tenter un nudge de position
              if (nonFatalErrorCountRef.current >= 5 && video) {
                const bufferedEnd = video.buffered.length > 0 
                  ? video.buffered.end(video.buffered.length - 1) 
                  : 0
                if (bufferedEnd > video.currentTime + 1) {
                  // Il y a du buffer devant nous, forcer un petit saut
                  console.log(`[PLAYER] Nudge +0.5s pour débloquer (buffer: ${bufferedEnd.toFixed(1)}s)`)
                  video.currentTime = Math.min(video.currentTime + 0.5, bufferedEnd - 0.5)
                  nonFatalErrorCountRef.current = 0
                }
              }
              
              // Si trop de stalls consécutifs, essayer recoverMediaError
              if (nonFatalErrorCountRef.current >= 10 && hls) {
                console.warn('[PLAYER] Trop de stalls, tentative de récupération média...')
                hls.recoverMediaError()
                nonFatalErrorCountRef.current = 0
              }
              
            } else if (data.details === 'fragLoadError' || data.details === 'fragLoadTimeOut') {
              nonFatalErrorCountRef.current++
              const httpStatus = data.response?.code
              
              if (httpStatus === 503) {
                // Serveur dit "pas encore prêt" (Retry-After) — comportement attendu
                console.log(`[PLAYER] Segment en attente (503), retry automatique HLS.js`)
              } else if (httpStatus === 502) {
                console.log(`[PLAYER] Segment indisponible (502), retry automatique`)
              } else {
                console.log(`[PLAYER] Fragment non chargé (${httpStatus || '?'}), ${nonFatalErrorCountRef.current}/15`)
              }
              
              // Si trop d'erreurs consécutives de fragments : forcer rechargement HLS
              if (nonFatalErrorCountRef.current >= 15 && hls) {
                console.warn('[PLAYER] Trop d\'erreurs fragments, rechargement stream...')
                const currentPos = lastKnownPositionRef.current || video.currentTime || 0
                hls.stopLoad()
                setTimeout(() => {
                  hls.startLoad(currentPos)
                  nonFatalErrorCountRef.current = 0
                }, 2000)
              }
              
            } else if (data.details === 'bufferAppendError') {
              bufferAppendErrorCountRef.current++
              console.log(`[PLAYER] Buffer append error (${bufferAppendErrorCountRef.current}/5)`)
              
              // Les bufferAppendError surviennent souvent après un seek
              // Après plusieurs erreurs, flush et relance
              if (bufferAppendErrorCountRef.current >= 3 && hls) {
                console.warn('[PLAYER] Flush buffer et récupération après bufferAppendErrors...')
                hls.recoverMediaError()
                bufferAppendErrorCountRef.current = 0
              }
              
            } else if (data.details === 'levelLoadError') {
              console.warn('[PLAYER] Erreur chargement playlist (non-fatal):', data.response?.code)
              if (data.response?.code === 500) {
                console.warn('[PLAYER] Serveur retourne 500 - possible FFmpeg mort')
              }
            }
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari support natif HLS
        video.src = currentVideoUrl.current
        video.load()
        setBufferReady(true)
      } else {
        console.error('[PLAYER] HLS non supporté sur ce navigateur')
        cbRef.current.setError('Format vidéo non supporté sur ce navigateur')
        return
      }
    } else {
      // Vidéo normale (MP4)
      setBufferReady(true)
      video.src = currentVideoUrl.current
      video.load()
    }
    
    // Autoplay
    const tryAutoplay = async () => {
      const isHLSUrl = src.includes('/api/hls')
      if (isHLSUrl && !bufferReady) return
      
      try {
        if (video.readyState < 2) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        const playPromise = video.play()
        hasStartedPlaying.current = true
        
        if (playPromise !== undefined) {
          await playPromise
        }
        
        setIsPlaying(true)
        cbRef.current.setIsLoading(false)
      } catch (err: unknown) {
        console.log('[PLAYER] Autoplay bloqué:', err instanceof Error ? err.message : err)
        cbRef.current.setIsLoading(false)
      }
    }
    
    const handleCanPlay = () => {
      const isHLSUrl = src.includes('/api/hls')
      if (!isHLSUrl) {
        cbRef.current.setIsLoading(false)
        tryAutoplay()
      }
    }
    
    const handleCanPlayThrough = () => {
      const isHLSUrl = src.includes('/api/hls')
      if (!isHLSUrl && !isPlaying) {
        tryAutoplay()
      }
    }
    
    const handlePlay = () => {
      hasStartedPlaying.current = true
      setIsPlaying(true)
      cbRef.current.setIsLoading(false)
    }
    
    const handlePause = () => {
      setIsPlaying(false)
    }
    
    const handleTimeUpdate = () => {
      const currentPos = video.currentTime
      const lastTime = lastTimeRef.current
      
      if (currentPos > 1 && !isRecoveringRef.current) {
        lastKnownPositionRef.current = currentPos
      }
      
      if (Math.abs(currentPos - lastTime) > 10 && lastTime > 0.1 && !isSeeking && !isRecoveringRef.current) {
        console.warn(`[PLAYER] SAUT DÉTECTÉ: ${lastTime.toFixed(1)}s → ${currentPos.toFixed(1)}s (delta: ${(currentPos - lastTime).toFixed(1)}s)`)
        
        if (currentPos < 5 && lastKnownPositionRef.current > 30) {
          console.log(`[PLAYER] RÉCUPÉRATION: Restauration vers ${lastKnownPositionRef.current.toFixed(1)}s`)
          isRecoveringRef.current = true
          video.currentTime = lastKnownPositionRef.current
          setTimeout(() => {
            isRecoveringRef.current = false
          }, 2000)
          return
        }
      }
      
      lastTimeRef.current = currentPos
      setCurrentTime(currentPos)
      
      if ((!duration || duration === 0) && !realDurationRef.current && isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration)
      }
      
      const actualDuration = realDurationRef.current || video.duration
      if (video.buffered.length > 0 && actualDuration > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1)
        setBuffered((bufferedEnd / actualDuration) * 100)
        
        const newMaxSeekable = bufferedEnd + 10
        if (Math.abs(newMaxSeekable - maxSeekableTime) > 5) {
          setMaxSeekableTime(newMaxSeekable)
        }
      }
      
      // Next episode check
      const videoDuration = isFinite(video.duration) && video.duration > 0 ? video.duration : 0
      const totalDuration = realDurationRef.current || videoDuration || duration
      cbRef.current.checkNextEpisode(currentPos, totalDuration)
    }
    
    const handleLoadedMetadata = () => {
      if (!realDurationRef.current && isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration)
      }
    }
    
    const handleLoadedData = () => {
      const isHLSUrl = src.includes('/api/hls')
      if (!isHLSUrl && !isPlaying && video.readyState >= 3) {
        tryAutoplay()
      }
    }
    
    const handleWaiting = () => cbRef.current.setIsLoading(true)
    const handlePlaying = () => cbRef.current.setIsLoading(false)
    const handleSeeking = () => setIsSeeking(true)
    const handleSeeked = () => {
      setIsSeeking(false)
      
      // Resynchroniser les sous-titres après un seek
      const textTracks = Array.from(video.textTracks)
      const activeTrack = textTracks.find(t => t.mode === 'showing')
      if (activeTrack) {
        activeTrack.mode = 'disabled'
        requestAnimationFrame(() => {
          activeTrack.mode = 'showing'
          console.log(`[PLAYER] Sous-titres resynchronisés après seek à ${video.currentTime.toFixed(1)}s`)
        })
      }
    }
    
    const handleError = () => {
      if (video.error) {
        console.error('[PLAYER] Erreur vidéo:', video.error)
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
            if (retryCountRef.current >= 3) {
              console.error('[PLAYER] Échec après 3 tentatives')
              msg = 'Format vidéo non supporté. Le transcodage a échoué.'
              cbRef.current.setError(msg)
              cbRef.current.setIsLoading(false)
              return
            }
            
            retryCountRef.current++
            msg = 'Format non supporté - Transcodage en cours...'
            
            setTimeout(() => {
              if (video.src && !video.src.includes('blob:')) {
                video.load()
                tryAutoplay()
              } else {
                console.error('[PLAYER] URL blob invalide, arrêt des tentatives')
                cbRef.current.setError('Erreur de lecture vidéo. Veuillez réessayer.')
                cbRef.current.setIsLoading(false)
              }
            }, 2000)
            return
        }
        
        cbRef.current.setError(msg)
      }
      cbRef.current.setIsLoading(false)
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
      if (bufferCheckIntervalRef.current) {
        clearInterval(bufferCheckIntervalRef.current)
        bufferCheckIntervalRef.current = null
      }
      if (subtitleAbortControllerRef.current) {
        subtitleAbortControllerRef.current.abort()
        subtitleAbortControllerRef.current = null
      }
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
  }, [src])

  return {
    isPlaying,
    currentTime,
    duration,
    buffered,
    isSeeking,
    isDragging,
    bufferReady,
    maxSeekableTime,
    seekWarning,
    isPreTranscoded,
    setIsDragging,
    setSeekWarning,
    setMaxSeekableTime,
    realDurationRef,
    getAudioTrack,
    handlePlayPause,
    handleSkip
  }
}
