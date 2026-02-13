/**
 * Hook: usePlaybackPosition
 * Charge la position sauvegardée au montage (avec retry)
 * Sauvegarde automatiquement la position de lecture toutes les 10s (avec retry)
 * Sauvegarde fiable au démontage via navigator.sendBeacon
 * Permet de reprendre un film là où on l'a arrêté
 */

import { useEffect, useRef, useState, useCallback } from 'react'

interface UsePlaybackPositionOptions {
  mediaId: string | null
  currentTime: number
  duration: number
  enabled?: boolean
  mediaType?: 'movie' | 'episode'
  userId?: string | null
}

const SAVE_INTERVAL = 10_000 // Sauvegarder toutes les 10 secondes
const MIN_TIME_TO_SAVE = 30 // Ne sauvegarder qu'après 30s de visionnage
const MAX_LOAD_RETRIES = 2 // Nombre max de tentatives pour charger la position
const LOAD_RETRY_DELAY = 2_000 // Délai entre tentatives de chargement (ms)
const MAX_SAVE_RETRIES = 2 // Nombre max de tentatives pour sauvegarder
const COMPLETION_THRESHOLD = 0.95 // 95% = film terminé

/**
 * Sauvegarder la position via sendBeacon (fiable au démontage/fermeture)
 * sendBeacon envoie un POST avec Content-Type: text/plain par défaut.
 * On utilise un Blob JSON pour garantir le bon format.
 */
function savePositionBeacon(
  mediaId: string,
  position: number,
  duration: number | null,
  mediaType: string,
  userId?: string | null
): boolean {
  try {
    const payload = JSON.stringify({
      mediaId,
      position: Math.floor(position),
      duration: duration && duration > 0 ? Math.floor(duration) : null,
      media_type: mediaType,
      userId: userId || undefined
    })
    const blob = new Blob([payload], { type: 'application/json' })
    return navigator.sendBeacon('/api/playback-position/beacon', blob)
  } catch {
    return false
  }
}

/**
 * Sauvegarder la position via fetch avec retry automatique
 */
async function savePositionWithRetry(
  mediaId: string,
  position: number,
  duration: number | null,
  mediaType: string,
  userId?: string | null,
  retries = MAX_SAVE_RETRIES
): Promise<boolean> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch('/api/playback-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId,
          position: Math.floor(position),
          duration: duration && duration > 0 ? Math.floor(duration) : null,
          media_type: mediaType,
          userId: userId || undefined
        })
      })

      if (response.ok) return true

      // Si erreur serveur (5xx), retry
      if (response.status >= 500 && attempt < retries) {
        await new Promise(r => setTimeout(r, 1_000 * (attempt + 1)))
        continue
      }

      return false
    } catch {
      // Erreur réseau, retry si tentatives restantes
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1_000 * (attempt + 1)))
        continue
      }
      return false
    }
  }
  return false
}

export function usePlaybackPosition({
  mediaId,
  currentTime,
  duration,
  enabled = true,
  mediaType = 'movie',
  userId
}: UsePlaybackPositionOptions) {
  const lastSavedTimeRef = useRef<number>(0)
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [initialPosition, setInitialPosition] = useState<number>(0)
  const hasLoadedPosition = useRef(false)
  const loadRetryCountRef = useRef(0)
  const loadRetryTimerRef = useRef<NodeJS.Timeout | null>(null)
  const currentTimeRef = useRef<number>(currentTime)
  const durationRef = useRef<number>(duration)
  const lastMediaIdRef = useRef<string | null>(null)
  const mediaIdRef = useRef<string | null>(mediaId)
  const enabledRef = useRef(enabled)
  const mediaTypeRef = useRef(mediaType)
  const userIdRef = useRef(userId)

  // Synchroniser toutes les refs à chaque render
  currentTimeRef.current = currentTime
  durationRef.current = duration
  mediaIdRef.current = mediaId
  enabledRef.current = enabled
  mediaTypeRef.current = mediaType
  userIdRef.current = userId

  // Réinitialiser quand le mediaId change (passage à l'épisode suivant)
  useEffect(() => {
    if (mediaId !== lastMediaIdRef.current) {
      console.log(`[PLAYBACK] 🔄 MediaId changé: ${lastMediaIdRef.current} → ${mediaId}`)
      hasLoadedPosition.current = false
      loadRetryCountRef.current = 0
      lastSavedTimeRef.current = 0
      setInitialPosition(0)
      lastMediaIdRef.current = mediaId

      // Nettoyer un éventuel retry en cours
      if (loadRetryTimerRef.current) {
        clearTimeout(loadRetryTimerRef.current)
        loadRetryTimerRef.current = null
      }
    }
  }, [mediaId])

  // Charger la position sauvegardée au montage (avec retry)
  useEffect(() => {
    if (!enabled || !mediaId || hasLoadedPosition.current) return

    const loadPosition = async () => {
      try {
        const params = new URLSearchParams({ mediaId })
        if (userId) params.append('userId', userId)
        const response = await fetch(`/api/playback-position?${params.toString()}`)

        if (!response.ok) {
          // Erreur serveur : tenter un retry
          if (response.status >= 500 && loadRetryCountRef.current < MAX_LOAD_RETRIES) {
            loadRetryCountRef.current++
            console.warn(`[PLAYBACK] Erreur serveur ${response.status}, retry ${loadRetryCountRef.current}/${MAX_LOAD_RETRIES}...`)
            loadRetryTimerRef.current = setTimeout(loadPosition, LOAD_RETRY_DELAY * loadRetryCountRef.current)
            return
          }
          hasLoadedPosition.current = true
          return
        }

        const data = await response.json()
        if (data.currentTime && data.currentTime > 0) {
          // Ne pas restaurer si position >= 95% de la durée (film terminé)
          const savedDuration = data.duration || 0
          if (savedDuration > 0 && data.currentTime >= savedDuration * COMPLETION_THRESHOLD) {
            console.log(`[PLAYBACK] Position ignorée (fin de lecture): ${Math.floor(data.currentTime)}s / ${Math.floor(savedDuration)}s`)
            // Nettoyer cette position terminée
            const deleteParams = new URLSearchParams({ mediaId })
            if (userId) deleteParams.append('userId', userId)
            deleteParams.append('recordHistory', 'true')
            deleteParams.append('mediaType', mediaType)
            fetch(`/api/playback-position?${deleteParams.toString()}`, {
              method: 'DELETE'
            }).catch(() => {})
            hasLoadedPosition.current = true
            return
          }

          setInitialPosition(data.currentTime)
          lastSavedTimeRef.current = data.currentTime
          console.log(`[PLAYBACK] Position chargée: ${Math.floor(data.currentTime)}s`)
        }
        hasLoadedPosition.current = true
      } catch (error) {
        console.error('[PLAYBACK] Erreur chargement position:', error)
        // Retry automatique en cas d'erreur réseau
        if (loadRetryCountRef.current < MAX_LOAD_RETRIES) {
          loadRetryCountRef.current++
          console.warn(`[PLAYBACK] Retry chargement ${loadRetryCountRef.current}/${MAX_LOAD_RETRIES}...`)
          loadRetryTimerRef.current = setTimeout(loadPosition, LOAD_RETRY_DELAY * loadRetryCountRef.current)
        } else {
          // Abandonner après toutes les tentatives
          hasLoadedPosition.current = true
          console.error('[PLAYBACK] Abandon chargement après retries')
        }
      }
    }

    loadPosition()

    return () => {
      if (loadRetryTimerRef.current) {
        clearTimeout(loadRetryTimerRef.current)
        loadRetryTimerRef.current = null
      }
    }
  }, [mediaId, enabled, userId, mediaType])

  // Sauvegarder la position périodiquement (avec retry)
  useEffect(() => {
    if (!enabled || !mediaId) return

    const savePosition = async () => {
      const time = currentTimeRef.current
      const dur = durationRef.current

      // Ne rien faire si le film n'a pas encore commencé
      if (time < MIN_TIME_TO_SAVE) return

      // Ne rien faire si on est à la fin (> 95%)
      if (dur > 0 && time > dur * COMPLETION_THRESHOLD) return

      // Ne sauvegarder que si la position a changé significativement (> 5s)
      if (Math.abs(time - lastSavedTimeRef.current) < 5) return

      const success = await savePositionWithRetry(
        mediaId,
        time,
        dur > 0 ? dur : null,
        mediaType,
        userId
      )

      if (success) {
        lastSavedTimeRef.current = time
        console.log(`[PLAYBACK] ✅ Position sauvegardée: ${Math.floor(time)}s / ${Math.floor(dur)}s (user: ${userId})`)
      } else {
        console.error(`[PLAYBACK] ❌ Échec sauvegarde après retries: ${Math.floor(time)}s`)
      }
    }

    saveIntervalRef.current = setInterval(savePosition, SAVE_INTERVAL)
    console.log('[PLAYBACK] 🔄 Intervalle de sauvegarde démarré (toutes les 10s)')

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current)
        console.log('[PLAYBACK] 🛑 Intervalle de sauvegarde arrêté')
      }
    }
  }, [mediaId, enabled, mediaType, userId])

  // Sauvegarde fiable au démontage via sendBeacon
  useEffect(() => {
    return () => {
      const time = currentTimeRef.current
      const dur = durationRef.current
      const id = mediaIdRef.current
      const isEnabled = enabledRef.current
      const type = mediaTypeRef.current
      const uid = userIdRef.current

      if (!isEnabled || !id || time <= MIN_TIME_TO_SAVE) return

      // Ne pas sauvegarder si fin de lecture (>= 95%)
      if (dur > 0 && time >= dur * COMPLETION_THRESHOLD) {
        console.log(`[PLAYBACK] 🏁 Fin de lecture, pas de sauvegarde (${Math.floor(time)}s / ${Math.floor(dur)}s)`)
        return
      }

      // Utiliser sendBeacon (garanti même si la page se ferme)
      console.log(`[PLAYBACK] 💾 Sauvegarde finale via sendBeacon: ${Math.floor(time)}s (user: ${uid})`)
      const sent = savePositionBeacon(id, time, dur, type, uid)

      if (!sent) {
        // Fallback sur fetch si sendBeacon échoue (très rare)
        console.warn('[PLAYBACK] sendBeacon échoué, fallback fetch')
        fetch('/api/playback-position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaId: id,
            position: Math.floor(time),
            duration: dur > 0 ? Math.floor(dur) : null,
            media_type: type,
            userId: uid || undefined
          })
        }).catch(() => {})
      }
    }
  }, []) // Aucune dépendance : on utilise les refs pour lire les valeurs courantes

  // Marquer comme terminé via DELETE + enregistrement dans watch_history
  const markAsFinished = useCallback(async () => {
    if (!enabled || !mediaId) return

    try {
      const params = new URLSearchParams({ mediaId })
      if (userId) params.append('userId', userId)
      params.append('recordHistory', 'true')
      params.append('mediaType', mediaType)

      const response = await fetch(`/api/playback-position?${params.toString()}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        console.log(`[PLAYBACK] ✅ Marqué comme terminé: ${mediaId} (user: ${userId})`)
      } else {
        console.error(`[PLAYBACK] Erreur marquage terminé: ${response.status}`)
      }
    } catch (error) {
      console.error('[PLAYBACK] Erreur marquage terminé:', error)
    }
  }, [mediaId, enabled, mediaType, userId])

  return { initialPosition, markAsFinished }
}
