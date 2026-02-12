/**
 * useAudioManager - Gestion complète des pistes audio
 * Extrait de SimpleVideoPlayer.tsx (Phase 7)
 * 
 * Responsabilités :
 * - État des pistes audio (audioTracks, selectedAudio)
 * - Changement de piste audio (MP4 natif Safari, MP4 remuxé, HLS.js, HLS fallback)
 * - Restauration de position après changement de piste
 * - Gestion du remuxing (indicateur isRemuxing)
 */

import { useState, useRef, useEffect, useCallback, type MutableRefObject } from 'react'
import Hls from 'hls.js'
import { HLS_BASE_CONFIG } from '@/lib/hls-config'
import type { AudioTrack, VideoElementWithAudioTracks } from '../types'

interface UseAudioManagerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  hlsRef: MutableRefObject<Hls | null>
  src: string
  getFilepath: () => string | null
  currentVideoUrl: MutableRefObject<string>
  onLoading: (loading: boolean) => void
  onError: (error: string | null) => void
  onCloseSettings: () => void
}

interface UseAudioManagerReturn {
  audioTracks: AudioTrack[]
  selectedAudio: number
  isRemuxing: boolean
  audioTracksRef: MutableRefObject<AudioTrack[]>
  selectedAudioRef: MutableRefObject<number>
  isChangingTrack: MutableRefObject<boolean>
  setAudioTracks: React.Dispatch<React.SetStateAction<AudioTrack[]>>
  setSelectedAudio: React.Dispatch<React.SetStateAction<number>>
  handleAudioChange: (track: AudioTrack, idx: number) => void
}

export function useAudioManager({
  videoRef,
  hlsRef,
  src,
  getFilepath,
  currentVideoUrl,
  onLoading,
  onError,
  onCloseSettings
}: UseAudioManagerOptions): UseAudioManagerReturn {
  // États
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
  const [selectedAudio, setSelectedAudio] = useState(0)
  const [isRemuxing, setIsRemuxing] = useState(false)

  // Refs synchronisées
  const audioTracksRef = useRef<AudioTrack[]>([])
  const selectedAudioRef = useRef(0)
  const isChangingTrack = useRef(false)

  // Synchroniser la ref audio avec le state
  useEffect(() => {
    selectedAudioRef.current = selectedAudio
  }, [selectedAudio])

  // Changement de langue audio DYNAMIQUE
  const handleAudioChange = useCallback((track: AudioTrack, idx: number) => {
    if (!videoRef.current) {
      onCloseSettings()
      return
    }
    
    // 🔧 FIX: Ne PAS bloquer si selectedAudio === idx
    // Après un changement d'épisode, le state peut afficher la bonne piste
    // mais HLS.js/la vidéo peut jouer une autre piste (désynchronisation)
    
    
    const video = videoRef.current
    const filepath = getFilepath()
    
    if (!filepath) return
    
    // Vérifier si c'est un MP4 direct (avec pistes audio intégrées)
    const isDirectMP4 = !src.includes('/api/hls')
    
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
          onCloseSettings()
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
        onCloseSettings()
        onLoading(true)
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
          console.error(`[PLAYER] Erreur chargement vidéo remuxée: ${newUrl}`)
          const videoError = video.error
          let errorMessage = 'Erreur lors du changement de langue audio.'
          
          if (videoError) {
            switch (videoError.code) {
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
          
          onError(errorMessage)
          onLoading(false)
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
              let httpErrorMessage = 'Erreur lors du remuxage.'
              if (response.status === 404) {
                httpErrorMessage = 'Fichier non trouvé. Vérifiez que le fichier existe.'
              } else if (response.status === 500) {
                httpErrorMessage = 'Erreur serveur lors du remuxage. Le fichier est peut-être trop volumineux ou corrompu.'
              } else if (response.status === 408 || response.status === 504) {
                httpErrorMessage = 'Le remuxage prend trop de temps. Le fichier est peut-être trop volumineux.'
              } else {
                httpErrorMessage = `Erreur ${response.status} lors du remuxage.`
              }
              
              console.error(`[PLAYER] Erreur HTTP ${response.status} pour ${newUrl}`)
              onError(httpErrorMessage)
              onLoading(false)
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
            console.error('[PLAYER] Erreur réseau lors de la vérification:', err)
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
                console.warn(`[PLAYER] Position incorrecte: ${actualPos.toFixed(1)}s (attendu: ${safePos.toFixed(1)}s), réessai...`)
                video.currentTime = safePos
                // Réattendre seeked
                video.addEventListener('seeked', seekedHandler, { once: true })
                return
              }
              
              
              if (wasPlaying) {
                // Petit délai avant de reprendre la lecture pour être sûr
                setTimeout(() => {
                  video.play().catch((err) => {
                    console.error('[PLAYER] Erreur play après restauration:', err)
                  })
                }, 100)
              }
              onLoading(false)
              setIsRemuxing(false) // Remuxage terminé
            }
            video.addEventListener('seeked', seekedHandler, { once: true })
            
            // Timeout de sécurité pour le seeked (si seeked ne se déclenche pas)
            setTimeout(() => {
              if (!seekedFired) {
                const actualPos = video.currentTime
                console.warn(`[PLAYER] Seeked non déclenché, position actuelle: ${actualPos.toFixed(1)}s`)
                // Forcer la restauration une dernière fois
                if (Math.abs(actualPos - safePos) > 1) {
                  video.currentTime = safePos
                  // Attendre encore un peu
                  setTimeout(() => {
                    onLoading(false)
                    setIsRemuxing(false)
                    if (wasPlaying) {
                      video.play().catch(() => {})
                    }
                  }, 500)
                } else {
                  onLoading(false)
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
            console.error('[PLAYER] Timeout restauration: durée non disponible après 5s')
            console.error(`[PLAYER] Durée: ${video.duration}, readyState: ${video.readyState}`)
            restoreAttempted = true
            onLoading(false)
            setIsRemuxing(false)
            onError('Erreur: impossible de charger les métadonnées de la vidéo.')
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
            console.error('[PLAYER] Timeout global: vidéo ne charge pas après 5 minutes')
            onLoading(false)
            setIsRemuxing(false)
            onError('Le remuxage prend trop de temps. Le fichier est peut-être trop volumineux.')
          }
        }, 300000) // 5 minutes
      }
    } else {
      // Pour HLS : essayer d'abord de changer via l'API HLS.js audioTrack
      
      // 🔧 FIX: Si HLS.js est actif avec plusieurs pistes audio, utiliser son API native
      if (hlsRef.current && hlsRef.current.audioTracks && hlsRef.current.audioTracks.length > 1) {
        console.log(`[PLAYER] Changement piste audio via HLS.js API: ${idx}`)
        console.log(`[PLAYER] Pistes disponibles:`, hlsRef.current.audioTracks.map((t, i) => `${i}: ${t.name || t.lang}`))
        
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
        onCloseSettings()
        console.log(`[PLAYER] Audio changé via HLS.js (piste ${hlsTrackIndex})`)
        return
      }
      
      // Fallback: recharger avec la nouvelle piste audio (si HLS.js n'a pas plusieurs pistes)
      const currentPos = video.currentTime
      const wasPlaying = !video.paused
      
      // Construire la nouvelle URL avec l'index de piste correct
      const newUrl = `/api/hls?path=${encodeURIComponent(filepath)}&playlist=true&audio=${track.index}`
      
      console.log(`[PLAYER] Rechargement stream avec piste audio ${track.index}`)
      
      // Marquer qu'on change de piste
      isChangingTrack.current = true
      currentVideoUrl.current = newUrl
      setSelectedAudio(idx)
      onCloseSettings()
      onLoading(true)
      
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
          onLoading(false)
          console.log('[PLAYER] Audio changé et position restaurée')
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
          onLoading(false)
          console.log('[PLAYER] Audio changé et position restaurée')
        }
        
        video.addEventListener('loadeddata', restorePlayback)
      }
    }
  }, [videoRef, hlsRef, src, getFilepath, currentVideoUrl, onLoading, onError, onCloseSettings])

  return {
    audioTracks,
    selectedAudio,
    isRemuxing,
    audioTracksRef,
    selectedAudioRef,
    isChangingTrack,
    setAudioTracks,
    setSelectedAudio,
    handleAudioChange
  }
}
