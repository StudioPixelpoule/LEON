/**
 * Hook: usePlayerPreferences
 * Persiste les préférences du lecteur vidéo (langue audio, sous-titres)
 * entre les sessions via localStorage
 */

import { useCallback, useEffect, useState } from 'react'

export interface PlayerPreferences {
  audioTrackIndex?: number
  subtitleTrackIndex?: number | null
  wasFullscreen?: boolean
  volume?: number
  lastUpdated?: number
}

const STORAGE_KEY_PREFIX = 'leon-player-prefs'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 jours

/**
 * Hook pour persister les préférences du lecteur vidéo
 * @param userId - ID de l'utilisateur (optionnel, utilise 'guest' par défaut)
 */
export function usePlayerPreferences(userId?: string) {
  const [preferences, setPreferences] = useState<PlayerPreferences | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  
  const storageKey = `${STORAGE_KEY_PREFIX}-${userId || 'guest'}`

  // Charger les préférences au montage
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoaded(true)
      return
    }
    
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed: PlayerPreferences = JSON.parse(stored)
        
        // Vérifier si les préférences ne sont pas trop anciennes
        if (parsed.lastUpdated && Date.now() - parsed.lastUpdated < MAX_AGE_MS) {
          setPreferences(parsed)
          console.log('[PREFERENCES] ✅ Préférences chargées:', parsed)
        } else {
          // Supprimer les préférences expirées
          localStorage.removeItem(storageKey)
          console.log('[PREFERENCES] ⏰ Préférences expirées, supprimées')
        }
      }
    } catch (error) {
      console.error('[PREFERENCES] ❌ Erreur chargement:', error)
    }
    
    setIsLoaded(true)
  }, [storageKey])

  /**
   * Sauvegarder les préférences
   */
  const savePreferences = useCallback((prefs: Partial<PlayerPreferences>) => {
    if (typeof window === 'undefined') return
    
    try {
      const updated: PlayerPreferences = {
        ...preferences,
        ...prefs,
        lastUpdated: Date.now()
      }
      
      localStorage.setItem(storageKey, JSON.stringify(updated))
      setPreferences(updated)
      console.log('[PREFERENCES] 💾 Préférences sauvegardées:', updated)
    } catch (error) {
      console.error('[PREFERENCES] ❌ Erreur sauvegarde:', error)
    }
  }, [preferences, storageKey])

  /**
   * Réinitialiser les préférences
   */
  const clearPreferences = useCallback(() => {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.removeItem(storageKey)
      setPreferences(null)
      console.log('[PREFERENCES] 🗑️ Préférences supprimées')
    } catch (error) {
      console.error('[PREFERENCES] ❌ Erreur suppression:', error)
    }
  }, [storageKey])

  /**
   * Obtenir les préférences initiales pour le lecteur
   * Fusionne les préférences sauvegardées avec des valeurs par défaut
   */
  const getInitialPreferences = useCallback((): PlayerPreferences => {
    return {
      audioTrackIndex: preferences?.audioTrackIndex ?? 0,
      subtitleTrackIndex: preferences?.subtitleTrackIndex ?? null,
      wasFullscreen: preferences?.wasFullscreen ?? false,
      volume: preferences?.volume ?? 1
    }
  }, [preferences])

  return {
    preferences,
    isLoaded,
    savePreferences,
    clearPreferences,
    getInitialPreferences
  }
}
