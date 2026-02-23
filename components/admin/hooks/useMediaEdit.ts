'use client'

import { useState } from 'react'
import { useAdminToast } from '@/components/admin/Toast/Toast'
import type { MediaItem } from './useLibrarySearch'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ModalMode = 'view' | 'edit'

interface UseMediaEditDeps {
  selectedMedia: MediaItem | null
  setSelectedMedia: React.Dispatch<React.SetStateAction<MediaItem | null>>
  setResults: React.Dispatch<React.SetStateAction<MediaItem[]>>
}

export interface UseMediaEditReturn {
  modalMode: ModalMode
  setModalMode: (mode: ModalMode) => void
  saving: boolean
  editTitle: string
  setEditTitle: (value: string) => void
  editYear: string
  setEditYear: (value: string) => void
  editTmdbId: string
  setEditTmdbId: (value: string) => void
  editPosterUrl: string
  setEditPosterUrl: (value: string) => void
  editBackdropUrl: string
  setEditBackdropUrl: (value: string) => void
  editTrailerUrl: string
  setEditTrailerUrl: (value: string) => void
  initEditFields: (media: { title?: string; year?: number; tmdb_id?: number; poster_url?: string; backdrop_url?: string; trailer_url?: string }) => void
  handleSaveEdit: () => Promise<void>
  handleRefreshFromTmdb: () => Promise<void>
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useMediaEdit({ selectedMedia, setSelectedMedia, setResults }: UseMediaEditDeps): UseMediaEditReturn {
  const [modalMode, setModalMode] = useState<ModalMode>('view')
  const [saving, setSaving] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editYear, setEditYear] = useState('')
  const [editTmdbId, setEditTmdbId] = useState('')
  const [editPosterUrl, setEditPosterUrl] = useState('')
  const [editBackdropUrl, setEditBackdropUrl] = useState('')
  const [editTrailerUrl, setEditTrailerUrl] = useState('')

  const { addToast } = useAdminToast()

  function initEditFields(media: { title?: string; year?: number; tmdb_id?: number; poster_url?: string; backdrop_url?: string; trailer_url?: string }) {
    setEditTitle(media.title || '')
    setEditYear(media.year?.toString() || '')
    setEditTmdbId(media.tmdb_id?.toString() || '')
    setEditPosterUrl(media.poster_url || '')
    setEditBackdropUrl(media.backdrop_url || '')
    setEditTrailerUrl(media.trailer_url || '')
  }

  async function handleSaveEdit() {
    if (!selectedMedia) return

    setSaving(true)
    try {
      const payload: Record<string, string | number | boolean | null> = {
        id: selectedMedia.id,
        type: selectedMedia.type
      }

      if (editTitle !== selectedMedia.title) payload.title = editTitle
      if (editYear !== (selectedMedia.year?.toString() || '')) {
        payload.year = editYear ? parseInt(editYear, 10) : null
      }
      if (editTmdbId !== (selectedMedia.tmdb_id?.toString() || '')) {
        payload.tmdb_id = editTmdbId ? parseInt(editTmdbId, 10) : null
        if (editTmdbId) {
          payload.refreshFromTmdb = true
        }
      }
      if (editPosterUrl !== (selectedMedia.poster_url || '')) {
        payload.poster_url = editPosterUrl || null
      }
      if (editBackdropUrl !== (selectedMedia.backdrop_url || '')) {
        payload.backdrop_url = editBackdropUrl || null
      }
      if (editTrailerUrl !== (selectedMedia.trailer_url || '')) {
        payload.trailer_url = editTrailerUrl || null
      }

      const response = await fetch('/api/admin/update-media-info', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        addToast('success', 'Sauvegardé', data.message)

        const updatedMedia = { ...selectedMedia, ...data.media }
        setSelectedMedia(updatedMedia)
        setResults(prev => prev.map(r => r.id === selectedMedia.id ? updatedMedia : r))
        setModalMode('view')
      } else {
        addToast('error', 'Erreur', data.error || 'Sauvegarde échouée')
      }
    } catch (error) {
      console.error('[LIBRARY] Erreur sauvegarde:', error)
      addToast('error', 'Erreur', 'Sauvegarde échouée')
    } finally {
      setSaving(false)
    }
  }

  async function handleRefreshFromTmdb() {
    if (!selectedMedia || !editTmdbId) return

    setSaving(true)
    try {
      const response = await fetch('/api/admin/update-media-info', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedMedia.id,
          type: selectedMedia.type,
          tmdb_id: parseInt(editTmdbId, 10),
          refreshFromTmdb: true
        })
      })

      const data = await response.json()

      if (data.success) {
        addToast('success', 'Mis à jour', 'Métadonnées TMDB importées')

        const updatedMedia = { ...selectedMedia, ...data.media }
        setSelectedMedia(updatedMedia)
        setEditTitle(data.media.title || '')
        setEditYear(data.media.year?.toString() || '')
        setEditTmdbId(data.media.tmdb_id?.toString() || '')
        setEditPosterUrl(data.media.poster_url || '')
        setEditBackdropUrl(data.media.backdrop_url || '')
        setEditTrailerUrl(data.media.trailer_url || '')
        setResults(prev => prev.map(r => r.id === selectedMedia.id ? updatedMedia : r))
      } else {
        addToast('error', 'Erreur', data.error || 'Import TMDB échoué')
      }
    } catch (error) {
      console.error('[LIBRARY] Erreur TMDB:', error)
      addToast('error', 'Erreur', 'Import TMDB échoué')
    } finally {
      setSaving(false)
    }
  }

  return {
    modalMode,
    setModalMode,
    saving,
    editTitle,
    setEditTitle,
    editYear,
    setEditYear,
    editTmdbId,
    setEditTmdbId,
    editPosterUrl,
    setEditPosterUrl,
    editBackdropUrl,
    setEditBackdropUrl,
    editTrailerUrl,
    setEditTrailerUrl,
    initEditFields,
    handleSaveEdit,
    handleRefreshFromTmdb
  }
}
