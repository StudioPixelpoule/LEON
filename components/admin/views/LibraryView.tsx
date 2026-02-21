'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  HardDrive,
  Search,
  RefreshCw,
  Tv,
  Film,
  ChevronRight
} from 'lucide-react'
import styles from '@/app/admin/admin.module.css'
import { useLibrarySearch } from '@/components/admin/hooks/useLibrarySearch'
import { useMediaEdit } from '@/components/admin/hooks/useMediaEdit'
import { useMediaDelete } from '@/components/admin/hooks/useMediaDelete'
import { MediaDetailModal } from '@/components/admin/components/MediaDetailModal'
import type { MediaItem } from '@/components/admin/hooks/useLibrarySearch'

export function LibraryView() {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null)

  const {
    searchQuery, setSearchQuery,
    mediaType, setMediaType,
    results, setResults,
    loading
  } = useLibrarySearch()

  const edit = useMediaEdit({ selectedMedia, setSelectedMedia, setResults })
  const mediaDelete = useMediaDelete({ selectedMedia, setResults })

  function closeModal() {
    setSelectedMedia(null)
    mediaDelete.resetDelete()
    edit.setModalMode('view')
  }

  async function handleSelectMedia(media: MediaItem) {
    setSelectedMedia(media)
    mediaDelete.resetDelete()
    edit.setModalMode('view')

    // Charger les infos complètes et la prévisualisation
    try {
      const [previewRes, infoRes] = await Promise.all([
        fetch(`/api/admin/delete-media?id=${media.id}&type=${media.type}`),
        fetch(`/api/admin/update-media-info?id=${media.id}&type=${media.type}`)
      ])

      const previewData = await previewRes.json()
      const infoData = await infoRes.json()

      if (previewData.success) {
        mediaDelete.setDeletePreview(previewData.preview)
      }

      if (infoData.success && infoData.media) {
        setSelectedMedia(prev => prev ? {
          ...prev,
          tmdb_id: infoData.media.tmdb_id,
          overview: infoData.media.overview,
          backdrop_url: infoData.media.backdrop_url,
          trailer_url: infoData.media.trailer_url,
        } : null)

        edit.initEditFields(infoData.media)
      }
    } catch (error) {
      console.error('[LIBRARY] Erreur chargement infos:', error)
    }
  }

  async function handleDeleteAndClose() {
    const success = await mediaDelete.handleDelete()
    if (success) closeModal()
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <HardDrive size={24} />
          Gestion de la bibliothèque
        </h2>
        <p className={styles.sectionSubtitle}>
          Rechercher, modifier ou supprimer les médias
        </p>
      </div>

      {/* Barre de recherche */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Rechercher un média</h3>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255,255,255,0.4)'
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Titre du film ou de la série..."
              className={styles.input}
              style={{ paddingLeft: 40 }}
            />
          </div>

          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as 'all' | 'movie' | 'series')}
            className={styles.input}
            style={{ width: 'auto', minWidth: 140 }}
          >
            <option value="all">Tous</option>
            <option value="movie">Films</option>
            <option value="series">Séries</option>
          </select>
        </div>

        {/* Résultats */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <RefreshCw size={24} className={styles.spin} style={{ color: 'rgba(255,255,255,0.4)' }} />
          </div>
        ) : results.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map(media => (
              <div
                key={`${media.type}-${media.id}`}
                onClick={() => handleSelectMedia(media)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                <div style={{ width: 40, height: 60, borderRadius: 4, overflow: 'hidden', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
                  {media.poster_url && !media.poster_url.includes('placeholder') ? (
                    <Image src={media.poster_url} alt={media.title} width={40} height={60} style={{ objectFit: 'cover' }} unoptimized />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.2)' }}>
                      {media.type === 'series' ? <Tv size={16} /> : <Film size={16} />}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {media.title}
                    {media.year && <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>({media.year})</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    {media.type === 'series' ? `${media.episode_count || '?'} épisodes` : 'Film'}
                  </div>
                </div>

                <span style={{
                  padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                  background: media.type === 'series' ? 'rgba(147, 51, 234, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                  color: media.type === 'series' ? 'rgb(192, 132, 252)' : 'rgb(147, 197, 253)'
                }}>
                  {media.type === 'series' ? 'Série' : 'Film'}
                </span>

                <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
              </div>
            ))}
          </div>
        ) : searchQuery.length >= 2 ? (
          <p style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>
            Aucun résultat pour &quot;{searchQuery}&quot;
          </p>
        ) : (
          <p style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>
            Entrez au moins 2 caractères pour rechercher
          </p>
        )}
      </div>

      {/* Modal de détails/édition/suppression */}
      {selectedMedia && (
        <MediaDetailModal
          selectedMedia={selectedMedia}
          deletePreview={mediaDelete.deletePreview}
          modalMode={edit.modalMode}
          setModalMode={edit.setModalMode}
          editTitle={edit.editTitle}
          setEditTitle={edit.setEditTitle}
          editYear={edit.editYear}
          setEditYear={edit.setEditYear}
          editTmdbId={edit.editTmdbId}
          setEditTmdbId={edit.setEditTmdbId}
          editPosterUrl={edit.editPosterUrl}
          setEditPosterUrl={edit.setEditPosterUrl}
          editBackdropUrl={edit.editBackdropUrl}
          setEditBackdropUrl={edit.setEditBackdropUrl}
          editTrailerUrl={edit.editTrailerUrl}
          setEditTrailerUrl={edit.setEditTrailerUrl}
          saving={edit.saving}
          deleting={mediaDelete.deleting}
          deleteSourceFiles={mediaDelete.deleteSourceFiles}
          setDeleteSourceFiles={mediaDelete.setDeleteSourceFiles}
          handleSaveEdit={edit.handleSaveEdit}
          handleRefreshFromTmdb={edit.handleRefreshFromTmdb}
          handleDelete={handleDeleteAndClose}
          closeModal={closeModal}
        />
      )}
    </div>
  )
}
