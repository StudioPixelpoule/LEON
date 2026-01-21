/**
 * Hook: useHlsPlayer
 * Gère l'initialisation et la configuration de HLS.js pour le streaming
 * 
 * Ce hook encapsule toute la logique HLS :
 * - Détection du support HLS natif (Safari) vs HLS.js
 * - Configuration adaptative selon la connexion
 * - Gestion des erreurs et récupération automatique
 * - Préchargement des segments
 */

import { useEffect, useRef, useCallback, useState, RefObject } from 'react'
import type Hls from 'hls.js'
import { HLS_BASE_CONFIG, selectHlsConfig } from '@/lib/hls-config'

type HlsConfig = ConstructorParameters<typeof Hls>[0]

interface UseHlsPlayerOptions {
  videoRef: RefObject<HTMLVideoElement>
  src: string
  enabled?: boolean
  onReady?: () => void
  onError?: (error: Error) => void
  onBuffering?: (isBuffering: boolean) => void
  connectionQuality?: 'excellent' | 'good' | 'poor'
}

interface UseHlsPlayerReturn {
  isHlsSupported: boolean
  isNativeHls: boolean
  hlsInstance: Hls | null
  isLoading: boolean
  error: Error | null
  retryCount: number
  destroy: () => void
}

/**
 * Vérifie si le navigateur supporte HLS nativement (Safari)
 */
const checkNativeHlsSupport = (): boolean => {
  if (typeof document === 'undefined') return false
  const video = document.createElement('video')
  return video.canPlayType('application/vnd.apple.mpegurl') !== ''
}

/**
 * Vérifie si HLS.js est supporté
 */
const checkHlsJsSupport = async (): Promise<boolean> => {
  try {
    const Hls = (await import('hls.js')).default
    return Hls.isSupported()
  } catch {
    return false
  }
}

/**
 * Hook pour gérer la lecture HLS
 */
export function useHlsPlayer({
  videoRef,
  src,
  enabled = true,
  onReady,
  onError,
  onBuffering,
  connectionQuality = 'good'
}: UseHlsPlayerOptions): UseHlsPlayerReturn {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  
  const hlsRef = useRef<Hls | null>(null)
  const isNativeHls = useRef(checkNativeHlsSupport())
  const [isHlsSupported, setIsHlsSupported] = useState(false)
  
  const maxRetries = 5

  // Vérifier le support HLS.js au montage
  useEffect(() => {
    checkHlsJsSupport().then(setIsHlsSupported)
  }, [])

  // Détruire l'instance HLS
  const destroy = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }, [])

  // Initialiser HLS
  useEffect(() => {
    if (!enabled || !videoRef.current) {
      return
    }

    const video = videoRef.current
    const isHlsUrl = src.includes('.m3u8') || src.includes('/api/hls')

    // Si ce n'est pas un stream HLS, ne rien faire
    if (!isHlsUrl) {
      setIsLoading(false)
      return
    }

    // Safari avec support natif HLS
    if (isNativeHls.current) {
      video.src = src
      setIsLoading(false)
      onReady?.()
      return
    }

    // Autres navigateurs : utiliser HLS.js
    const initHls = async () => {
      try {
        const Hls = (await import('hls.js')).default
        
        if (!Hls.isSupported()) {
          throw new Error('HLS.js non supporté sur ce navigateur')
        }

        // Sélectionner la config selon le contexte
        const config = selectHlsConfig({
          isFirstLoad: retryCount === 0,
          connectionQuality,
          isRecovery: retryCount > 0,
          startPosition: 0
        })

        const hls = new Hls(config)
        hlsRef.current = hls

        // Événements HLS
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false)
          onReady?.()
        })

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('[HLS] Erreur fatale:', data.type, data.details)
            
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (retryCount < maxRetries) {
                  console.log('[HLS] Tentative de récupération réseau...')
                  setRetryCount(c => c + 1)
                  hls.startLoad()
                } else {
                  setError(new Error('Erreur réseau - impossible de charger la vidéo'))
                  onError?.(new Error('Erreur réseau'))
                }
                break
                
              case Hls.ErrorTypes.MEDIA_ERROR:
                if (retryCount < maxRetries) {
                  console.log('[HLS] Tentative de récupération média...')
                  setRetryCount(c => c + 1)
                  hls.recoverMediaError()
                } else {
                  setError(new Error('Erreur média - format non supporté'))
                  onError?.(new Error('Erreur média'))
                }
                break
                
              default:
                setError(new Error('Erreur de lecture'))
                onError?.(new Error('Erreur fatale'))
                destroy()
            }
          }
        })

        hls.on(Hls.Events.FRAG_LOADING, () => {
          onBuffering?.(true)
        })

        hls.on(Hls.Events.FRAG_LOADED, () => {
          onBuffering?.(false)
        })

        // Attacher au video element
        hls.loadSource(src)
        hls.attachMedia(video)

      } catch (err) {
        console.error('[HLS] Erreur initialisation:', err)
        setError(err as Error)
        onError?.(err as Error)
        setIsLoading(false)
      }
    }

    initHls()

    return destroy
  }, [src, enabled, videoRef, connectionQuality, retryCount, onReady, onError, onBuffering, destroy])

  return {
    isHlsSupported,
    isNativeHls: isNativeHls.current,
    hlsInstance: hlsRef.current,
    isLoading,
    error,
    retryCount,
    destroy
  }
}
