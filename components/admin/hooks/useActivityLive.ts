import { useState, useEffect, useCallback, useRef } from 'react'
import type { ActiveSession, ActivityLiveData } from '@/types/admin'

// ============================================
// TYPES
// ============================================

interface UseActivityLiveReturn {
  liveData: ActivityLiveData | null
  activeSessions: ActiveSession[]
  recentSessions: ActiveSession[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// Intervalle de polling en millisecondes
const POLL_INTERVAL_MS = 10_000

// ============================================
// HOOK
// ============================================

/**
 * Hook pour les données d'activité en temps réel.
 * - Visibility-aware : ne poll pas quand l'onglet est caché
 * - Protection concurrence : empêche les requêtes simultanées
 * - Vérification response.ok
 * - État error exposé
 */
export function useActivityLive(): UseActivityLiveReturn {
  const [liveData, setLiveData] = useState<ActivityLiveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchingRef = useRef(false)

  const loadLiveData = useCallback(async () => {
    // Protection concurrence : si un fetch est déjà en cours, on skip
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      const response = await fetch('/api/stats/watching')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const result: ActivityLiveData = await response.json()
      setLiveData(result)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('[ACTIVITY] Erreur chargement live:', message)
      setError(message)
    } finally {
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    // Chargement initial
    loadLiveData().finally(() => setLoading(false))

    // Visibility-aware polling
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      timer = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          loadLiveData()
        }
        schedule()
      }, POLL_INTERVAL_MS)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Rafraîchir immédiatement au retour sur l'onglet
        loadLiveData()
        // Relancer le timer
        if (timer) clearTimeout(timer)
        schedule()
      } else {
        // Arrêter le timer quand l'onglet est caché
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    schedule()

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (timer) clearTimeout(timer)
    }
  }, [loadLiveData])

  // Les sessions actives et récentes sont déjà séparées par l'API
  const activeSessions = liveData?.activeSessions || []
  const recentSessions = liveData?.recentHistory || []

  return { liveData, activeSessions, recentSessions, loading, error, refresh: loadLiveData }
}
