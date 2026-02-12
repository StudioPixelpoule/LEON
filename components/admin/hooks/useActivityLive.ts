import { useState, useEffect, useCallback } from 'react'

// ============================================
// TYPES
// ============================================

export interface ActiveSession {
  id: string
  userId: string | null
  userName: string
  userEmail: string | null
  title: string
  posterUrl: string | null
  year: number | null
  progress: number
  updatedAt: string
  isActive: boolean
}

interface ActivityStats {
  totalWatches: number
  uniqueViewers: number
  totalWatchTimeMinutes: number
}

export interface ActivityLiveData {
  activeSessions: ActiveSession[]
  stats: ActivityStats
}

interface UseActivityLiveReturn {
  liveData: ActivityLiveData | null
  activeSessions: ActiveSession[]
  recentSessions: ActiveSession[]
  loading: boolean
  refresh: () => Promise<void>
}

// ============================================
// HOOK
// ============================================

/**
 * Hook pour les données d'activité en temps réel.
 * Charge les sessions actives et rafraîchit toutes les 10 secondes.
 */
export function useActivityLive(): UseActivityLiveReturn {
  const [liveData, setLiveData] = useState<ActivityLiveData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadLiveData = useCallback(async () => {
    try {
      const response = await fetch('/api/stats/watching')
      const result = await response.json()
      setLiveData(result)
    } catch (error) {
      console.error('[ACTIVITY] Erreur chargement live:', error)
    }
  }, [])

  useEffect(() => {
    loadLiveData().finally(() => setLoading(false))

    // Rafraîchir les données live toutes les 10 secondes
    const interval = setInterval(loadLiveData, 10000)
    return () => clearInterval(interval)
  }, [loadLiveData])

  const activeSessions = liveData?.activeSessions.filter(s => s.isActive) || []
  const recentSessions = liveData?.activeSessions.filter(s => !s.isActive) || []

  return { liveData, activeSessions, recentSessions, loading, refresh: loadLiveData }
}
