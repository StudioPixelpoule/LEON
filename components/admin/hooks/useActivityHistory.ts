import { useState, useEffect } from 'react'

// ============================================
// TYPES
// ============================================

export interface HistoryEntry {
  id: string
  userId: string | null
  userName: string
  userEmail: string | null
  mediaId: string
  title: string
  posterUrl: string | null
  year: number | null
  watchedAt: string
  watchDuration: number | null
  completed: boolean
  progress: number
}

export interface UserStats {
  userId: string
  userName: string
  userEmail: string | null
  totalWatches: number
  totalWatchTimeMinutes: number
  completedCount: number
  lastActivity: string
}

export interface HistoryData {
  history: HistoryEntry[]
  userStats: UserStats[]
  users: Array<{ id: string; name: string; email: string }>
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

// ============================================
// HOOK
// ============================================

/**
 * Hook pour les données d'historique d'activité.
 * Gère le chargement initial, les filtres utilisateur/période et la pagination.
 */
export function useActivityHistory() {
  const [historyData, setHistoryData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [selectedDays, setSelectedDays] = useState<number>(30)
  const [currentPage, setCurrentPage] = useState(1)
  const [preloaded, setPreloaded] = useState(false)

  // Chargement initial (parallèle avec useActivityLive)
  useEffect(() => {
    async function loadInitial() {
      try {
        const response = await fetch('/api/stats/history?limit=30&days=30')
        const result = await response.json()
        setHistoryData(result)
        setPreloaded(true)
      } catch (error) {
        console.error('[ACTIVITY] Erreur chargement historique:', error)
      } finally {
        setLoading(false)
      }
    }
    loadInitial()
  }, [])

  // Recharger uniquement si les filtres changent après le préchargement
  useEffect(() => {
    if (preloaded && (selectedUser !== 'all' || selectedDays !== 30 || currentPage !== 1)) {
      loadHistoryData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, selectedDays, currentPage, preloaded])

  async function loadHistoryData() {
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '30',
        days: selectedDays.toString(),
        ...(selectedUser !== 'all' && { userId: selectedUser })
      })
      const response = await fetch(`/api/stats/history?${params}`)
      const result = await response.json()
      setHistoryData(result)
    } catch (error) {
      console.error('[ACTIVITY] Erreur chargement historique:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  return {
    historyData,
    loading,
    historyLoading,
    selectedUser,
    setSelectedUser,
    selectedDays,
    setSelectedDays,
    currentPage,
    setCurrentPage,
    refresh: loadHistoryData
  }
}
