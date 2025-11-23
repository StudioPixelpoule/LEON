/**
 * Hook: usePlaybackPosition
 * Charge la position sauvegardée au montage
 * Sauvegarde automatiquement la position de lecture toutes les 10s
 * Permet de reprendre un film là où on l'a arrêté
 */

import { useEffect, useRef, useState, useCallback } from 'react'

interface UsePlaybackPositionOptions {
  mediaId: string | null
  currentTime: number
  duration: number
  enabled?: boolean // Activer/désactiver la sauvegarde
}

const SAVE_INTERVAL = 10000 // Sauvegarder toutes les 10 secondes
const MIN_TIME_TO_SAVE = 30 // Ne sauvegarder qu'après 30s de visionnage

export function usePlaybackPosition({
  mediaId,
  currentTime,
  duration,
  enabled = true
}: UsePlaybackPositionOptions) {
  const lastSavedTimeRef = useRef<number>(0)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [initialPosition, setInitialPosition] = useState<number>(0)
  const hasLoadedPosition = useRef(false)
  const currentTimeRef = useRef<number>(currentTime)
  const durationRef = useRef<number>(duration)

  // Mettre à jour les refs à chaque render
  currentTimeRef.current = currentTime
  durationRef.current = duration

  // Charger la position sauvegardée au montage
  useEffect(() => {
    if (!enabled || !mediaId || hasLoadedPosition.current) {
      return
    }

    const loadPosition = async () => {
      try {
        const response = await fetch(`/api/playback-position?mediaId=${encodeURIComponent(mediaId)}`)
        
        if (!response.ok) {
          return
        }

        const data = await response.json()
        if (data.currentTime && data.currentTime > 0) {
          setInitialPosition(data.currentTime)
          lastSavedTimeRef.current = data.currentTime
          console.log(`[PLAYBACK] Position chargée: ${Math.floor(data.currentTime)}s`)
        }
      } catch (error) {
        console.error('[PLAYBACK] Erreur chargement position:', error)
      }
    }

    loadPosition()
    hasLoadedPosition.current = true
  }, [mediaId, enabled])

  // Sauvegarder la position périodiquement
  useEffect(() => {
    // Ne rien faire si désactivé ou pas de mediaId
    if (!enabled || !mediaId) {
      return
    }

    // Fonction pour sauvegarder la position (utilise les refs pour avoir les valeurs actuelles)
    const savePosition = async () => {
      const time = currentTimeRef.current
      const dur = durationRef.current

      // Ne rien faire si le film n'a pas encore commencé
      if (time < MIN_TIME_TO_SAVE) {
        return
      }

      // Ne rien faire si on est à la fin du film (> 95%)
      if (dur > 0 && time > dur * 0.95) {
        return
      }

      // Ne sauvegarder que si la position a changé significativement (> 5s)
      if (Math.abs(time - lastSavedTimeRef.current) < 5) {
        return
      }

      try {
        const response = await fetch('/api/playback-position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaId,
            position: Math.floor(time),
            duration: dur > 0 ? Math.floor(dur) : null,
            media_type: 'movie'
          })
        })

        if (response.ok) {
          lastSavedTimeRef.current = time
          console.log(`[PLAYBACK] ✅ Position sauvegardée: ${Math.floor(time)}s / ${Math.floor(dur)}s`)
        }
      } catch (error) {
        console.error('[PLAYBACK] ❌ Erreur sauvegarde position:', error)
      }
    }

    // Sauvegarder toutes les 10s
    saveTimeoutRef.current = setInterval(savePosition, SAVE_INTERVAL)
    console.log('[PLAYBACK] 🔄 Intervalle de sauvegarde démarré (toutes les 10s)')

    return () => {
      if (saveTimeoutRef.current) {
        clearInterval(saveTimeoutRef.current)
        console.log('[PLAYBACK] 🛑 Intervalle de sauvegarde arrêté')
      }
    }
  }, [mediaId, enabled]) // ✨ NE PLUS dépendre de currentTime et duration !

  // Sauvegarder une dernière fois au démontage du composant
  useEffect(() => {
    return () => {
      const time = currentTimeRef.current
      const dur = durationRef.current
      
      if (enabled && mediaId && time > MIN_TIME_TO_SAVE) {
        // Sauvegarde finale (fire and forget)
        console.log(`[PLAYBACK] 💾 Sauvegarde finale au démontage: ${Math.floor(time)}s`)
        fetch('/api/playback-position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaId,
            position: Math.floor(time),
            duration: dur > 0 ? Math.floor(dur) : null,
            media_type: 'movie'
          })
        }).catch(() => {
          // Ignorer les erreurs au démontage
        })
      }
    }
  }, [enabled, mediaId]) // Dépendre uniquement de enabled et mediaId

  // Fonction pour marquer comme terminé
  const markAsFinished = useCallback(async () => {
    if (!enabled || !mediaId) return

    try {
      await fetch('/api/playback-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId,
          position: 0,
          duration: 0,
          media_type: 'movie'
        })
      })
      console.log(`[PLAYBACK] Marqué comme terminé: ${mediaId}`)
    } catch (error) {
      console.error('[PLAYBACK] Erreur marquage terminé:', error)
    }
  }, [mediaId, enabled])

  return { initialPosition, markAsFinished }
}
