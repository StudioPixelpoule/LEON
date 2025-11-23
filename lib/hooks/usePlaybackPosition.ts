/**
 * Hook: usePlaybackPosition
 * Sauvegarde automatiquement la position de lecture toutes les 10s
 * Permet de reprendre un film là où on l'a arrêté
 */

import { useEffect, useRef } from 'react'

interface UsePlaybackPositionOptions {
  mediaId: string | null
  currentTime: number
  duration: number
  isPlaying: boolean
  enabled?: boolean // Activer/désactiver la sauvegarde
}

const SAVE_INTERVAL = 10000 // Sauvegarder toutes les 10 secondes
const MIN_TIME_TO_SAVE = 30 // Ne sauvegarder qu'après 30s de visionnage

export function usePlaybackPosition({
  mediaId,
  currentTime,
  duration,
  isPlaying,
  enabled = true
}: UsePlaybackPositionOptions) {
  const lastSavedTimeRef = useRef<number>(0)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Ne rien faire si désactivé ou pas de mediaId
    if (!enabled || !mediaId) {
      return
    }

    // Ne rien faire si le film n'a pas encore commencé
    if (currentTime < MIN_TIME_TO_SAVE) {
      return
    }

    // Ne rien faire si on est à la fin du film (> 95%)
    if (duration > 0 && currentTime > duration * 0.95) {
      return
    }

    // Fonction pour sauvegarder la position
    const savePosition = async () => {
      // Ne sauvegarder que si la position a changé significativement (> 5s)
      if (Math.abs(currentTime - lastSavedTimeRef.current) < 5) {
        return
      }

      try {
        const response = await fetch('/api/playback-position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaId,
            currentTime: Math.floor(currentTime),
            duration: duration > 0 ? Math.floor(duration) : null
          })
        })

        if (response.ok) {
          lastSavedTimeRef.current = currentTime
          console.log(`[PLAYBACK] Position sauvegardée: ${Math.floor(currentTime)}s`)
        }
      } catch (error) {
        console.error('[PLAYBACK] Erreur sauvegarde position:', error)
      }
    }

    // Sauvegarder immédiatement si la vidéo est en pause
    if (!isPlaying) {
      savePosition()
      return
    }

    // Si la vidéo joue, sauvegarder toutes les 10s
    if (saveTimeoutRef.current) {
      clearInterval(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setInterval(savePosition, SAVE_INTERVAL)

    return () => {
      if (saveTimeoutRef.current) {
        clearInterval(saveTimeoutRef.current)
      }
    }
  }, [mediaId, currentTime, duration, isPlaying, enabled])

  // Sauvegarder une dernière fois au démontage du composant
  useEffect(() => {
    return () => {
      if (enabled && mediaId && currentTime > MIN_TIME_TO_SAVE) {
        // Sauvegarde finale (fire and forget)
        fetch('/api/playback-position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaId,
            currentTime: Math.floor(currentTime),
            duration: duration > 0 ? Math.floor(duration) : null
          })
        }).catch(() => {
          // Ignorer les erreurs au démontage
        })
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Hook pour récupérer la position sauvegardée
 */
export async function getPlaybackPosition(mediaId: string): Promise<number | null> {
  try {
    const response = await fetch(`/api/playback-position?mediaId=${mediaId}`)
    
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.currentTime || null
  } catch (error) {
    console.error('[PLAYBACK] Erreur récupération position:', error)
    return null
  }
}

