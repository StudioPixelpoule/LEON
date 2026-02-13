import { useState, useEffect, useCallback, useRef } from 'react'
import type { AdminUser } from '@/types/admin'

// ============================================
// TYPES
// ============================================

interface UseUsersReturn {
  users: AdminUser[]
  loading: boolean
  error: string | null
  expandedUser: string | null
  setExpandedUser: (id: string | null) => void
  deletingItem: string | null
  refresh: () => Promise<void>
  deletePosition: (userId: string, mediaId: string, title: string) => Promise<boolean>
}

// ============================================
// HOOK
// ============================================

/**
 * Hook pour la gestion des utilisateurs admin.
 * - Chargement avec vérification response.ok
 * - Suppression de position avec rollback en cas d'échec
 * - État error exposé
 */
export function useUsers(): UseUsersReturn {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [deletingItem, setDeletingItem] = useState<string | null>(null)
  const fetchingRef = useRef(false)

  const loadUsers = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      setLoading(true)
      const response = await fetch('/api/users?includeInProgress=true')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Erreur inconnue')
      }

      setUsers(data.users)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('[USERS] Erreur chargement utilisateurs:', message)
      setError(message)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  /**
   * Supprime une position de lecture avec optimistic update + rollback.
   * Retourne true si la suppression a réussi, false sinon.
   */
  const deletePosition = useCallback(async (
    userId: string,
    mediaId: string,
    _title: string
  ): Promise<boolean> => {
    // Sauvegarder l'état actuel pour rollback
    const previousUsers = [...users]

    // Optimistic update
    setDeletingItem(mediaId)
    setUsers(prev => prev.map(user => {
      if (user.id === userId) {
        return {
          ...user,
          in_progress_items: user.in_progress_items.filter(item => item.media_id !== mediaId),
          in_progress_count: Math.max(0, user.in_progress_count - 1)
        }
      }
      return user
    }))

    try {
      const response = await fetch(`/api/users?userId=${userId}&mediaId=${mediaId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Suppression échouée')
      }

      return true
    } catch (err) {
      // Rollback en cas d'échec
      console.error('[USERS] Erreur suppression, rollback:', err)
      setUsers(previousUsers)
      return false
    } finally {
      setDeletingItem(null)
    }
  }, [users])

  return {
    users,
    loading,
    error,
    expandedUser,
    setExpandedUser,
    deletingItem,
    refresh: loadUsers,
    deletePosition
  }
}
