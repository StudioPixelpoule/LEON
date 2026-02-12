/**
 * Hook useNextEpisode
 * Gère le compte à rebours Netflix pour l'épisode suivant :
 * - Détection du générique (via creditsDuration)
 * - Countdown 5s
 * - Auto-play ou annulation
 * - Reset au changement de source
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type { PlayerPreferences, NextEpisodeInfo, AudioTrack } from '../types'

interface UseNextEpisodeOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** URL source, utilisé pour reset au changement d'épisode */
  src: string
  /** Info de l'épisode suivant (null = pas de next episode) */
  nextEpisode?: NextEpisodeInfo
  /** Durée du générique en secondes (temps avant la fin, défaut: 45) */
  creditsDuration: number
  /** Callback quand on passe à l'épisode suivant */
  onNextEpisode?: (preferences: PlayerPreferences) => void
  /** Marquer l'épisode courant comme terminé */
  markAsFinished: () => Promise<void>
  /** ID du média courant */
  mediaId?: string
  /** Fonction pour obtenir les préférences courantes (audio, subtitle, fullscreen) */
  getPreferences: () => PlayerPreferences
}

interface UseNextEpisodeReturn {
  showUI: boolean
  countdown: number
  isCancelled: boolean
  /** Ref synchronisée pour utilisation dans les closures (ex: handleTimeUpdate) */
  showUIRef: React.RefObject<boolean>
  cancel: () => void
  playNow: () => void
  /**
   * Appelé depuis handleTimeUpdate pour détecter le début du générique.
   * Déclenche l'affichage de l'UI si les conditions sont remplies.
   */
  checkTimeRemaining: (currentTime: number, duration: number) => void
}

export function useNextEpisode({
  videoRef,
  src,
  nextEpisode,
  creditsDuration,
  onNextEpisode,
  markAsFinished,
  mediaId,
  getPreferences
}: UseNextEpisodeOptions): UseNextEpisodeReturn {
  const [showUI, setShowUI] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [isCancelled, setIsCancelled] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const showUIRef = useRef(false)
  const creditsDurationRef = useRef(creditsDuration)

  // Refs pour éviter closures stale dans le countdown
  const nextEpisodeRef = useRef(nextEpisode)
  const onNextEpisodeRef = useRef(onNextEpisode)
  const markAsFinishedRef = useRef<(() => Promise<void>) | null>(markAsFinished)

  // Synchroniser les refs
  useEffect(() => {
    showUIRef.current = showUI
    nextEpisodeRef.current = nextEpisode
    onNextEpisodeRef.current = onNextEpisode
    markAsFinishedRef.current = markAsFinished
    creditsDurationRef.current = creditsDuration
  }, [showUI, nextEpisode, onNextEpisode, markAsFinished, creditsDuration])

  // Reset au changement de source (nouvel épisode)
  useEffect(() => {
    setShowUI(false)
    setIsCancelled(false)
    setCountdown(5)
  }, [src])

  // Gestion de la fin de vidéo (passage direct si countdown pas affiché)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleVideoEnded = () => {
      console.log('[PLAYER] Vidéo terminée')

      // Marquer comme terminé
      if (mediaId) {
        markAsFinished()
      }

      // Si on arrive ici sans countdown affiché (vidéo courte), passage direct
      if (nextEpisode && onNextEpisode && !isCancelled && !showUI) {
        console.log('[PLAYER] Vidéo terminée, passage direct à l\'épisode suivant:', nextEpisode.title)
        const preferences = getPreferences()
        onNextEpisode(preferences)
      }
    }

    video.addEventListener('ended', handleVideoEnded)
    return () => video.removeEventListener('ended', handleVideoEnded)
  }, [videoRef, mediaId, nextEpisode, onNextEpisode, markAsFinished, isCancelled, showUI, getPreferences])

  // Compte à rebours 5s (style Netflix)
  // Dépendances minimales pour éviter les resets intempestifs
  useEffect(() => {
    console.log('[PLAYER] useEffect countdown déclenché:', { showUI, isCancelled })

    // Nettoyer le timer précédent
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Conditions de démarrage
    if (!showUI || isCancelled || !nextEpisodeRef.current || !onNextEpisodeRef.current) {
      console.log('[PLAYER] Countdown non démarré - conditions non remplies')
      return
    }

    console.log('[PLAYER] Démarrage du compte à rebours 5s (style Netflix)')

    let currentCount = 5
    setCountdown(5)

    timerRef.current = setInterval(() => {
      currentCount -= 1
      console.log('[PLAYER] Countdown:', currentCount)

      if (currentCount <= 0) {
        console.log('[PLAYER] Compte à rebours terminé, lancement épisode suivant')

        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }

        // Marquer l'épisode actuel comme terminé (via ref)
        if (mediaId && markAsFinishedRef.current) {
          markAsFinishedRef.current()
        }

        // Lancer l'épisode suivant avec les préférences (via ref)
        if (onNextEpisodeRef.current) {
          onNextEpisodeRef.current(getPreferences())
        }
      } else {
        setCountdown(currentCount)
      }
    }, 1000)

    return () => {
      console.log('[PLAYER] Cleanup countdown timer')
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [showUI, isCancelled, mediaId, getPreferences])

  // Annuler le passage à l'épisode suivant
  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setShowUI(false)
    setIsCancelled(true)
  }, [])

  // Lancer l'épisode suivant immédiatement
  const playNow = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (mediaId) {
      markAsFinished()
    }
    onNextEpisode?.(getPreferences())
  }, [mediaId, markAsFinished, onNextEpisode, getPreferences])

  // Vérification appelée depuis handleTimeUpdate
  const checkTimeRemaining = useCallback((currentTime: number, duration: number) => {
    if (!nextEpisodeRef.current || !onNextEpisodeRef.current || isCancelled) return
    // Ne pas afficher l'UI pour les vidéos trop courtes (< 60s) ou si durée inconnue
    if (duration <= 60) return

    const triggerTime = duration - creditsDurationRef.current
    const shouldShow = currentTime >= triggerTime && currentTime < duration
    const isCurrentlyShown = showUIRef.current

    // Afficher l'UI au début du générique
    if (shouldShow && !isCurrentlyShown) {
      console.log(`[PLAYER] Déclenchement UI épisode suivant à ${currentTime.toFixed(1)}s (trigger: ${triggerTime.toFixed(1)}s, générique: ${creditsDurationRef.current}s)`)
      setShowUI(true)
    }

    // Masquer si on recule avant le générique
    if (!shouldShow && isCurrentlyShown) {
      console.log('[PLAYER] Masquage UI épisode suivant (recul)')
      setShowUI(false)
      setCountdown(5)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isCancelled])

  return {
    showUI,
    countdown,
    isCancelled,
    showUIRef,
    cancel,
    playNow,
    checkTimeRemaining
  }
}
