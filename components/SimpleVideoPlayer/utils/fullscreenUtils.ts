/**
 * Utilitaires Fullscreen compatibles Safari et iOS
 * Gère les différentes implémentations (standard, webkit, iOS video)
 */

interface ExtendedDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}

interface ExtendedHTMLElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>
}

interface ExtendedHTMLVideoElement extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void
  webkitExitFullscreen?: () => void
  webkitDisplayingFullscreen?: boolean
  webkitSupportsFullscreen?: boolean
}

/** Détecter iOS (iPhone, iPad, iPod) */
export const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Détecter Safari */
export const isSafari = (): boolean => {
  if (typeof navigator === 'undefined') return false
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

export const getFullscreenElement = (): Element | null => {
  const doc = document as ExtendedDocument
  return doc.fullscreenElement || doc.webkitFullscreenElement || null
}

export const requestFullscreen = async (element: HTMLElement, videoElement?: HTMLVideoElement): Promise<void> => {
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

export const exitFullscreen = async (videoElement?: HTMLVideoElement): Promise<void> => {
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

export const isVideoFullscreen = (videoElement?: HTMLVideoElement): boolean => {
  if (isIOS() && videoElement) {
    const video = videoElement as ExtendedHTMLVideoElement
    return video.webkitDisplayingFullscreen || false
  }
  return !!getFullscreenElement()
}

export const addFullscreenChangeListener = (handler: () => void, videoElement?: HTMLVideoElement): (() => void) => {
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
