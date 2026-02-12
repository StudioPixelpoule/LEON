'use client'

import { useState } from 'react'
import { useAdminToast } from '@/components/admin/Toast/Toast'
import type { ToastType } from '@/types/admin'
import type { TranscodeJob } from './useTranscodeQueue'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UseTranscodeActionsDeps {
  queue: TranscodeJob[]
  setQueue: React.Dispatch<React.SetStateAction<TranscodeJob[]>>
  setIsModifying: React.Dispatch<React.SetStateAction<boolean>>
  modifyTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>
  loadStats: (quick?: boolean) => Promise<void>
  isModifying: boolean
}

export interface UseTranscodeActionsReturn {
  actionLoading: string | null
  performAction: (action: string) => Promise<void>
  deleteTranscoded: (folder: string, name: string) => Promise<void>
  moveJobToTop: (jobId: string) => Promise<void>
  removeFromQueue: (jobId: string, filename: string) => Promise<void>
  cleanupDuplicates: () => Promise<void>
  moveJobToPosition: (jobId: string, newPosition: number) => Promise<void>
  moveJobBy: (jobId: string, delta: number) => Promise<void>
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook regroupant toutes les actions sur la queue de transcodage :
 * start/pause/resume/stop, réorganisation, suppression, etc.
 */
export function useTranscodeActions({
  queue,
  setQueue,
  setIsModifying,
  modifyTimeoutRef,
  loadStats,
}: UseTranscodeActionsDeps): UseTranscodeActionsReturn {
  const { addToast } = useAdminToast()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Débloquer le polling après un délai
  function scheduleUnblock() {
    modifyTimeoutRef.current = setTimeout(() => {
      setIsModifying(false)
      loadStats(true)
    }, 2000)
  }

  // Bloquer le polling
  function startModifying() {
    setIsModifying(true)
    if (modifyTimeoutRef.current) clearTimeout(modifyTimeoutRef.current)
  }

  async function performAction(action: string) {
    setActionLoading(action)
    try {
      await fetch('/api/transcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        credentials: 'include'
      })
      
      const messages: Record<string, { title: string; type: ToastType }> = {
        'start': { title: 'Transcodage démarré', type: 'success' },
        'pause': { title: 'Transcodage en pause', type: 'info' },
        'resume': { title: 'Transcodage repris', type: 'success' },
        'stop': { title: 'Transcodage arrêté', type: 'warning' },
        'scan': { title: 'Scan terminé', type: 'success' },
        'start-watcher': { title: 'Watcher activé', type: 'success' },
        'stop-watcher': { title: 'Watcher désactivé', type: 'info' }
      }
      
      const msg = messages[action]
      if (msg) addToast(msg.type, msg.title)
      
      await loadStats(true)
    } catch (error) {
      console.error(`[TRANSCODE] Erreur action ${action}:`, error)
      addToast('error', 'Erreur', `Action "${action}" échouée`)
    } finally {
      setActionLoading(null)
    }
  }

  async function deleteTranscoded(folder: string, name: string) {
    if (!confirm(`Supprimer "${name}" ?`)) return
    try {
      await fetch(`/api/transcode?folder=${encodeURIComponent(folder)}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      addToast('success', 'Supprimé', name)
      await loadStats(false)
    } catch (error) {
      console.error('[TRANSCODE] Erreur suppression:', error)
      addToast('error', 'Erreur suppression')
    }
  }

  async function moveJobToTop(jobId: string) {
    startModifying()
    
    // Mise à jour optimiste immédiate
    setQueue(prev => {
      const jobIndex = prev.findIndex(j => j.id === jobId)
      if (jobIndex > 0) {
        const newQueue = [...prev]
        const [job] = newQueue.splice(jobIndex, 1)
        newQueue.unshift(job)
        return newQueue
      }
      return prev
    })
    
    try {
      await fetch('/api/admin/transcode-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move-to-top', jobId }),
        credentials: 'include'
      })
      addToast('success', 'Placé en priorité')
    } catch (error) {
      console.error('[TRANSCODE] Erreur move-to-top:', error)
      addToast('error', 'Erreur', 'Déplacement échoué')
      await loadStats(true)
    }
    
    scheduleUnblock()
  }
  
  async function removeFromQueue(jobId: string, filename: string) {
    if (!confirm(`Retirer "${filename}" de la file ?`)) return
    
    startModifying()
    
    // Mise à jour optimiste immédiate
    setQueue(prev => prev.filter(j => j.id !== jobId))
    
    try {
      await fetch('/api/admin/transcode-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', jobId }),
        credentials: 'include'
      })
      addToast('info', 'Retiré de la file')
    } catch (error) {
      console.error('[TRANSCODE] Erreur remove:', error)
      addToast('error', 'Erreur', 'Suppression échouée')
      await loadStats(true)
    }
    
    scheduleUnblock()
  }

  async function cleanupDuplicates() {
    setIsModifying(true)
    try {
      const response = await fetch('/api/admin/transcode-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-duplicates' }),
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success) {
        addToast('success', 'Nettoyage terminé', data.message)
        await loadStats(true)
      } else {
        addToast('error', 'Erreur', 'Nettoyage échoué')
      }
    } catch (error) {
      console.error('[TRANSCODE] Erreur nettoyage:', error)
      addToast('error', 'Erreur', 'Nettoyage échoué')
    } finally {
      setIsModifying(false)
    }
  }

  async function moveJobToPosition(jobId: string, newPosition: number) {
    const currentIndex = queue.findIndex(j => j.id === jobId)
    if (currentIndex === -1) return
    
    // Valider la position (1-indexed pour l'utilisateur)
    const targetIndex = Math.max(0, Math.min(newPosition - 1, queue.length - 1))
    if (targetIndex === currentIndex) return
    
    startModifying()
    
    // Mise à jour optimiste
    const newQueue = [...queue]
    const [job] = newQueue.splice(currentIndex, 1)
    newQueue.splice(targetIndex, 0, job)
    setQueue(newQueue)
    
    // Envoyer au serveur
    const newOrder = newQueue.map(j => j.id)
    try {
      await fetch('/api/admin/transcode-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', jobIds: newOrder }),
        credentials: 'include'
      })
      addToast('success', 'Position modifiée', `Déplacé en position ${targetIndex + 1}`)
    } catch (error) {
      console.error('[TRANSCODE] Erreur déplacement:', error)
      addToast('error', 'Erreur', 'Déplacement échoué')
      await loadStats(true)
    }
    
    scheduleUnblock()
  }
  
  async function moveJobBy(jobId: string, delta: number) {
    const currentIndex = queue.findIndex(j => j.id === jobId)
    if (currentIndex === -1) return
    const newPosition = currentIndex + 1 + delta
    if (newPosition < 1 || newPosition > queue.length) return
    await moveJobToPosition(jobId, newPosition)
  }

  return {
    actionLoading,
    performAction,
    deleteTranscoded,
    moveJobToTop,
    removeFromQueue,
    cleanupDuplicates,
    moveJobToPosition,
    moveJobBy,
  }
}
