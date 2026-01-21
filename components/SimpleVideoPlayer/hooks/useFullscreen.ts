/**
 * Hook: useFullscreen
 * Gestion du plein écran compatible Safari, Chrome, Firefox et iOS
 */

import { useEffect, useState, useCallback, RefObject } from 'react'

// Types étendus pour la compatibilité Safari/iOS
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

/**
 * Détecter iOS (iPhone, iPad, iPod)
 */
export const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * Détecter Safari
 */
export const isSafari = (): boolean => {
  if (typeof navigator === 'undefined') return false
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

/**
 * Obtenir l'élément en plein écran
 */
export const getFullscreenElement = (): Element | null => {
  if (typeof document === 'undefined') return null
  const doc = document as ExtendedDocument
  return doc.fullscreenElement || doc.webkitFullscreenElement || null
}

/**
 * Demander le plein écran (compatible iOS/Safari)
 */
export const requestFullscreen = async (
  element: HTMLElement, 
  videoElement?: HTMLVideoElement
): Promise<void> => {
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

/**
 * Quitter le plein écran (compatible iOS/Safari)
 */
export const exitFullscreen = async (videoElement?: HTMLVideoElement): Promise<void> => {
  if (typeof document === 'undefined') return
  
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

/**
 * Vérifier si la vidéo est en plein écran (compatible iOS)
 */
export const isVideoFullscreen = (videoElement?: HTMLVideoElement): boolean => {
  if (isIOS() && videoElement) {
    const video = videoElement as ExtendedHTMLVideoElement
    return video.webkitDisplayingFullscreen || false
  }
  return !!getFullscreenElement()
}

/**
 * Ajouter un listener de changement de plein écran (compatible iOS/Safari)
 */
export const addFullscreenChangeListener = (
  handler: () => void, 
  videoElement?: HTMLVideoElement
): (() => void) => {
  if (typeof document === 'undefined') return () => {}
  
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

interface UseFullscreenOptions {
  containerRef: RefObject<HTMLElement>
  videoRef?: RefObject<HTMLVideoElement>
  onEnter?: () => void
  onExit?: () => void
}

/**
 * Hook pour gérer le plein écran avec support iOS/Safari
 */
export function useFullscreen({ 
  containerRef, 
  videoRef,
  onEnter,
  onExit 
}: UseFullscreenOptions) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Écouter les changements de plein écran
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreen = isVideoFullscreen(videoRef?.current || undefined)
      setIsFullscreen(fullscreen)
      
      if (fullscreen) {
        onEnter?.()
      } else {
        onExit?.()
      }
    }
    
    const cleanup = addFullscreenChangeListener(
      handleFullscreenChange, 
      videoRef?.current || undefined
    )
    
    return cleanup
  }, [videoRef, onEnter, onExit])

  // Entrer en plein écran
  const enterFullscreen = useCallback(async () => {
    if (!containerRef.current) return
    
    try {
      await requestFullscreen(containerRef.current, videoRef?.current || undefined)
    } catch (error) {
      console.warn('[FULLSCREEN] Impossible d\'entrer en plein écran:', error)
    }
  }, [containerRef, videoRef])

  // Quitter le plein écran
  const exitFullscreenMode = useCallback(async () => {
    try {
      await exitFullscreen(videoRef?.current || undefined)
    } catch (error) {
      console.warn('[FULLSCREEN] Impossible de quitter le plein écran:', error)
    }
  }, [videoRef])

  // Toggle plein écran
  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreenMode()
    } else {
      await enterFullscreen()
    }
  }, [isFullscreen, enterFullscreen, exitFullscreenMode])

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen: exitFullscreenMode,
    toggleFullscreen
  }
}
