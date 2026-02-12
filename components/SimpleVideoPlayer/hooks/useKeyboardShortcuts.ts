/**
 * Hook: useKeyboardShortcuts
 * Gère les raccourcis clavier du lecteur vidéo
 * 
 * - Espace / K : Play/Pause
 * - Flèche gauche : Reculer de 10s
 * - Flèche droite : Avancer de 10s
 * - F : Plein écran
 * - M : Mute/Unmute
 * - Escape : Fermer le menu settings ou quitter le plein écran
 */

import { useEffect, RefObject } from 'react'
import { isVideoFullscreen, exitFullscreen } from '../utils/fullscreenUtils'

interface UseKeyboardShortcutsOptions {
  videoRef: RefObject<HTMLVideoElement>
  onPlayPause: () => void
  onSkip: (seconds: number) => void
  onFullscreen: () => void
  onToggleMute: () => void
  onCloseSettings: () => void
  showSettingsMenu: boolean
}

/**
 * Hook pour les raccourcis clavier du lecteur vidéo
 */
export function useKeyboardShortcuts({
  videoRef,
  onPlayPause,
  onSkip,
  onFullscreen,
  onToggleMute,
  onCloseSettings,
  showSettingsMenu
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!videoRef.current) return

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault()
          onPlayPause()
          break
        case 'arrowleft':
          e.preventDefault()
          onSkip(-10)
          break
        case 'arrowright':
          e.preventDefault()
          onSkip(10)
          break
        case 'f':
          e.preventDefault()
          onFullscreen()
          break
        case 'm':
          e.preventDefault()
          onToggleMute()
          break
        case 'escape':
          if (showSettingsMenu) {
            onCloseSettings()
          } else if (isVideoFullscreen(videoRef.current || undefined)) {
            exitFullscreen(videoRef.current || undefined)
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [videoRef, onPlayPause, onSkip, onFullscreen, onToggleMute, onCloseSettings, showSettingsMenu])
}
