import { useState, useEffect, useCallback, useRef } from 'react'
import type { HistoryData } from '@/types/admin'

// ============================================
// TYPES
// ============================================

interface UseActivityHistoryReturn {
  historyData: HistoryData | null
  loading: boolean
  historyLoading: boolean
  error: string | null
  selectedUser: string
  setSelectedUser: (user: string) => void
  selectedDays: number
  setSelectedDays: (days: number) => void
  currentPage: number
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>
  refresh: () => Promise<void>
}

// ============================================
// HOOK
// ============================================

/**
 * Hook pour les données d'historique d'activité.
 * - Gère le chargement initial, les filtres utilisateur/période et la pagination
 * - AbortController pour annuler les requêtes en cours lors d'un changement de filtres
 * - Vérification response.ok
 * - État error exposé
 */
export function useActivityHistory(): UseActivityHistoryReturn {
  const [historyData, setHistoryData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [selectedDays, setSelectedDays] = useState<number>(30)
  const [currentPage, setCurrentPage] = useState(1)
  const [preloaded, setPreloaded] = useState(false)

  // Ref pour AbortController — annule la requête précédente si une nouvelle arrive
  const abortRef = useRef<AbortController | null>(null)

  const loadHistoryData = useCallback(async (
    user: string = selectedUser,
    days: number = selectedDays,
    page: number = currentPage,
    isInitial: boolean = false
  ) => {
    // Annuler la requête précédente si elle est encore en cours
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    if (!isInitial) setHistoryLoading(true)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '30',
        days: days.toString(),
        ...(user !== 'all' && { userId: user })
      })

      const response = await fetch(`/api/stats/history?${params}`, {
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result: HistoryData = await response.json()
      setHistoryData(result)
      setError(null)
    } catch (err) {
      // Ne pas traiter les erreurs d'abort (changement de filtre normal)
      if (err instanceof DOMException && err.name === 'AbortError') return

      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('[ACTIVITY] Erreur chargement historique:', message)
      setError(message)
    } finally {
      if (!isInitial) setHistoryLoading(false)
    }
  }, [selectedUser, selectedDays, currentPage])

  // Chargement initial
  useEffect(() => {
    loadHistoryData('all', 30, 1, true).finally(() => {
      setLoading(false)
      setPreloaded(true)
    })

    // Cleanup au démontage
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recharger quand les filtres changent après le préchargement
  useEffect(() => {
    if (preloaded && (selectedUser !== 'all' || selectedDays !== 30 || currentPage !== 1)) {
      loadHistoryData(selectedUser, selectedDays, currentPage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, selectedDays, currentPage, preloaded])

  const refresh = useCallback(async () => {
    await loadHistoryData(selectedUser, selectedDays, currentPage)
  }, [loadHistoryData, selectedUser, selectedDays, currentPage])

  return {
    historyData,
    loading,
    historyLoading,
    error,
    selectedUser,
    setSelectedUser,
    selectedDays,
    setSelectedDays,
    currentPage,
    setCurrentPage,
    refresh
  }
}
