/**
 * Hook: useControlsVisibility
 * Gère l'affichage/masquage automatique des contrôles du lecteur vidéo
 * 
 * - Affiche les contrôles au mouvement de souris
 * - Les masque automatiquement après 3 secondes si la vidéo joue
 * - Bloque le masquage si le menu settings est ouvert
 */

import { useState, useRef, useEffect, useCallback, RefObject } from 'react'

const HIDE_DELAY_MS = 3000

interface UseControlsVisibilityOptions {
  videoRef: RefObject<HTMLVideoElement>
  isPlaying: boolean
  showSettingsMenu: boolean
}

interface UseControlsVisibilityReturn {
  showControls: boolean
  setShowControls: (show: boolean) => void
  handleMouseMove: () => void
}

/**
 * Hook pour gérer la visibilité des contrôles du lecteur
 */
export function useControlsVisibility({
  videoRef,
  isPlaying,
  showSettingsMenu
}: UseControlsVisibilityOptions): UseControlsVisibilityReturn {
  const [showControls, setShowControls] = useState(true)
  const hideControlsTimeout = useRef<NodeJS.Timeout>()

  // Masquer automatiquement les contrôles quand la vidéo joue
  useEffect(() => {
    if (isPlaying && !showSettingsMenu) {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current)
      }
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false)
      }, HIDE_DELAY_MS)
    }

    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current)
      }
    }
  }, [isPlaying, showSettingsMenu])

  // Afficher les contrôles au mouvement de souris, relancer le timer
  const handleMouseMove = useCallback(() => {
    setShowControls(true)

    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current)
    }

    // Vérifier l'état réel de la vidéo, pas juste le state
    const videoElement = videoRef.current
    const actuallyPlaying = videoElement && !videoElement.paused && !videoElement.ended

    if ((actuallyPlaying || isPlaying) && !showSettingsMenu) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false)
      }, HIDE_DELAY_MS)
    }
  }, [isPlaying, showSettingsMenu, videoRef])

  return {
    showControls,
    setShowControls,
    handleMouseMove
  }
}
