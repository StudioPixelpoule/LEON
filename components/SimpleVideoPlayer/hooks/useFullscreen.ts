/**
 * Hook useFullscreen
 * Gère le plein écran cross-browser (standard, webkit, iOS)
 * S'appuie sur les utilitaires de fullscreenUtils.ts
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  requestFullscreen,
  exitFullscreen,
  isVideoFullscreen,
  addFullscreenChangeListener
} from '../utils/fullscreenUtils'

interface UseFullscreenOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** Si true, restaure le plein écran au montage (transition entre épisodes) */
  initialWasFullscreen?: boolean
  /** Callback pour masquer les contrôles après passage en fullscreen */
  onFullscreenEnter?: () => void
}

interface UseFullscreenReturn {
  isFullscreen: boolean
  isFullscreenRef: React.RefObject<boolean>
  toggleFullscreen: () => void
}

export function useFullscreen({
  containerRef,
  videoRef,
  initialWasFullscreen,
  onFullscreenEnter
}: UseFullscreenOptions): UseFullscreenReturn {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const isFullscreenRef = useRef(false)

  // Synchroniser la ref avec le state
  useEffect(() => {
    isFullscreenRef.current = isFullscreen
  }, [isFullscreen])

  // Écouter les changements fullscreen (natif, webkit, iOS)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreen = isVideoFullscreen(videoRef.current || undefined)
      setIsFullscreen(fullscreen)

      if (fullscreen && onFullscreenEnter) {
        // Forcer la disparition des contrôles après 3s en fullscreen
        setTimeout(() => {
          onFullscreenEnter()
        }, 3000)
      }
    }

    const cleanup = addFullscreenChangeListener(handleFullscreenChange, videoRef.current || undefined)
    return cleanup
  }, [videoRef, onFullscreenEnter])

  // Restaurer le plein écran entre épisodes
  useEffect(() => {
    if (initialWasFullscreen && containerRef.current && videoRef.current) {
      const restoreFullscreen = async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        try {
          await requestFullscreen(containerRef.current!, videoRef.current || undefined)
          setIsFullscreen(true)
          console.log('[PLAYER] Plein écran restauré depuis l\'épisode précédent')
        } catch (err) {
          console.log('[PLAYER] Impossible de restaurer le plein écran:', err)
        }
      }
      restoreFullscreen()
    }
  }, [initialWasFullscreen, containerRef, videoRef])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (isVideoFullscreen(videoRef.current || undefined)) {
      exitFullscreen(videoRef.current || undefined)
    } else if (containerRef.current) {
      requestFullscreen(containerRef.current, videoRef.current || undefined)
    }
  }, [containerRef, videoRef])

  return { isFullscreen, isFullscreenRef, toggleFullscreen }
}
