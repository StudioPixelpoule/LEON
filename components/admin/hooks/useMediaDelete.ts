'use client'

import { useState } from 'react'
import { useAdminToast } from '@/components/admin/Toast/Toast'
import type { MediaItem } from './useLibrarySearch'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeletePreview {
  media: MediaItem | null
  episodes?: number
  favorites: number
  playbackPositions: number
  hasTranscoded: boolean
  hasSourceFiles: boolean
  sourceFilesCount: number
  filepath?: string
}

interface UseMediaDeleteDeps {
  selectedMedia: MediaItem | null
  setResults: React.Dispatch<React.SetStateAction<MediaItem[]>>
}

export interface UseMediaDeleteReturn {
  deletePreview: DeletePreview | null
  setDeletePreview: React.Dispatch<React.SetStateAction<DeletePreview | null>>
  deleting: boolean
  deleteSourceFiles: boolean
  setDeleteSourceFiles: (value: boolean) => void
  handleDelete: () => Promise<boolean>
  resetDelete: () => void
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useMediaDelete({ selectedMedia, setResults }: UseMediaDeleteDeps): UseMediaDeleteReturn {
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteSourceFiles, setDeleteSourceFiles] = useState(false)

  const { addToast } = useAdminToast()

  /**
   * Gère la suppression d'un média avec confirmations.
   * Retourne true si la suppression a réussi.
   */
  async function handleDelete(): Promise<boolean> {
    if (!selectedMedia) return false

    let confirmMsg = selectedMedia.type === 'series'
      ? `Supprimer la série "${selectedMedia.title}" et tous ses épisodes ?`
      : `Supprimer le film "${selectedMedia.title}" ?`

    confirmMsg += '\n\nCette action supprimera :'
    confirmMsg += selectedMedia.type === 'series'
      ? `\n- La série et ses ${deletePreview?.episodes || 0} épisodes`
      : '\n- Le film de la base'
    if (deletePreview?.favorites) confirmMsg += `\n- ${deletePreview.favorites} favoris`
    if (deletePreview?.playbackPositions) confirmMsg += `\n- ${deletePreview.playbackPositions} positions de lecture`
    if (deletePreview?.hasTranscoded) confirmMsg += '\n- Les fichiers transcodés'

    if (deleteSourceFiles && deletePreview?.hasSourceFiles) {
      confirmMsg += `\n\n⚠️ ATTENTION: ${deletePreview.sourceFilesCount} FICHIER(S) SOURCE SERONT SUPPRIMÉS DU NAS !`
      confirmMsg += '\nCette action est IRRÉVERSIBLE !'
    }

    if (!confirm(confirmMsg)) return false

    // Double confirmation pour la suppression des fichiers sources
    if (deleteSourceFiles && deletePreview?.hasSourceFiles) {
      if (!confirm('DERNIÈRE CONFIRMATION\n\nVoulez-vous vraiment supprimer les fichiers sources du NAS ?\n\nCette action ne peut pas être annulée.')) {
        return false
      }
    }

    setDeleting(true)
    try {
      const params = new URLSearchParams({
        id: selectedMedia.id,
        type: selectedMedia.type
      })
      if (deleteSourceFiles) params.set('deleteSource', 'true')

      const response = await fetch(`/api/admin/delete-media?${params}`, { method: 'DELETE' })
      const data = await response.json()

      if (data.success) {
        addToast('success', 'Supprimé', data.message)
        setResults(prev => prev.filter(r => r.id !== selectedMedia.id))
        return true
      } else {
        addToast('error', 'Erreur', data.error || 'Suppression échouée')
        return false
      }
    } catch (error) {
      console.error('[LIBRARY] Erreur suppression:', error)
      addToast('error', 'Erreur', 'Suppression échouée')
      return false
    } finally {
      setDeleting(false)
    }
  }

  function resetDelete() {
    setDeletePreview(null)
    setDeleteSourceFiles(false)
  }

  return {
    deletePreview,
    setDeletePreview,
    deleting,
    deleteSourceFiles,
    setDeleteSourceFiles,
    handleDelete,
    resetDelete
  }
}
