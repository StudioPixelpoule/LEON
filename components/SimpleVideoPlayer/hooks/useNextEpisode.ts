/**
 * Hook: useNextEpisode
 * Gère la logique de l'épisode suivant (compte à rebours, détection de fin, etc.)
 */

import { useEffect, useRef, useState, useCallback } from 'react'

export interface NextEpisodeInfo {
  id: string
  title: string
  seasonNumber: number
  episodeNumber: number
  thumbnail?: string
}

export interface PlayerPreferences {
  audioTrackIndex?: number
  audioStreamIndex?: number
  audioLanguage?: string
  subtitleTrackIndex?: number | null
  wasFullscreen?: boolean
}

interface UseNextEpisodeOptions {
  nextEpisode?: NextEpisodeInfo
  onNextEpisode?: (preferences: PlayerPreferences) => void
  getPreferences: () => PlayerPreferences
  markAsFinished: () => void
  mediaId?: string
  countdownDuration?: number
  triggerTimeBeforeEnd?: number
}

interface UseNextEpisodeReturn {
  showUI: boolean
  countdown: number
  isCancelled: boolean
  cancel: () => void
  playNow: () => void
  reset: () => void
  checkTimeRemaining: (timeRemaining: number, totalDuration: number) => void
}

/**
 * Hook pour gérer l'épisode suivant avec compte à rebours
 */
export function useNextEpisode({
  nextEpisode,
  onNextEpisode,
  getPreferences,
  markAsFinished,
  mediaId,
  countdownDuration = 10,
  triggerTimeBeforeEnd = 30
}: UseNextEpisodeOptions): UseNextEpisodeReturn {
  const [showUI, setShowUI] = useState(false)
  const [countdown, setCountdown] = useState(countdownDuration)
  const [isCancelled, setIsCancelled] = useState(false)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const preferencesRef = useRef<() => PlayerPreferences>(getPreferences)
  
  // Mettre à jour la ref des préférences
  useEffect(() => {
    preferencesRef.current = getPreferences
  }, [getPreferences])

  // Nettoyer le timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Annuler le passage à l'épisode suivant
  const cancel = useCallback(() => {
    clearTimer()
    setIsCancelled(true)
    setShowUI(false)
  }, [clearTimer])

  // Lancer l'épisode suivant immédiatement
  const playNow = useCallback(() => {
    clearTimer()
    
    if (mediaId) {
      markAsFinished()
    }
    
    if (onNextEpisode) {
      onNextEpisode(preferencesRef.current())
    }
    
    setShowUI(false)
  }, [clearTimer, mediaId, markAsFinished, onNextEpisode])

  // Réinitialiser l'état (lors d'un changement de source)
  const reset = useCallback(() => {
    clearTimer()
    setShowUI(false)
    setIsCancelled(false)
    setCountdown(countdownDuration)
  }, [clearTimer, countdownDuration])

  // Vérifier le temps restant et afficher/masquer l'UI
  const checkTimeRemaining = useCallback((timeRemaining: number, totalDuration: number) => {
    // Ne rien faire si pas d'épisode suivant ou annulé
    if (!nextEpisode || !onNextEpisode || isCancelled) return
    
    // Ne pas afficher pour les vidéos trop courtes
    if (totalDuration <= 60) return

    // Afficher l'UI quand on approche de la fin
    if (timeRemaining <= triggerTimeBeforeEnd && timeRemaining > 0) {
      if (!showUI) {
        setShowUI(true)
        setCountdown(countdownDuration)
      }
    }

    // Masquer si on recule
    if (timeRemaining > triggerTimeBeforeEnd && showUI) {
      clearTimer()
      setShowUI(false)
      setCountdown(countdownDuration)
    }
  }, [nextEpisode, onNextEpisode, isCancelled, triggerTimeBeforeEnd, showUI, clearTimer, countdownDuration])

  // Gérer le compte à rebours quand l'UI est affichée
  useEffect(() => {
    clearTimer()

    if (!showUI || isCancelled || !nextEpisode || !onNextEpisode) {
      return
    }

    console.log('[NEXT_EPISODE] ⏱️ Démarrage du compte à rebours')
    
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          console.log('[NEXT_EPISODE] ⏱️ Compte à rebours terminé')
          clearTimer()
          
          if (mediaId) {
            markAsFinished()
          }
          
          onNextEpisode(preferencesRef.current())
          setShowUI(false)
          
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return clearTimer
  }, [showUI, isCancelled, nextEpisode, onNextEpisode, mediaId, markAsFinished, clearTimer])

  return {
    showUI,
    countdown,
    isCancelled,
    cancel,
    playNow,
    reset,
    checkTimeRemaining
  }
}
