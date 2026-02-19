'use client'

import Image from 'next/image'
import {
  Tv,
  Film,
  X,
  Eye,
  Edit3,
  AlertCircle,
  Trash2,
  RefreshCw,
  RotateCcw,
  Check
} from 'lucide-react'
import styles from '@/app/admin/admin.module.css'
import type { MediaItem } from '../hooks/useLibrarySearch'
import type { DeletePreview } from '../hooks/useMediaDelete'
import type { ModalMode } from '../hooks/useMediaEdit'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MediaDetailModalProps {
  selectedMedia: MediaItem
  deletePreview: DeletePreview | null
  modalMode: ModalMode
  setModalMode: (mode: ModalMode) => void
  editTitle: string
  setEditTitle: (value: string) => void
  editYear: string
  setEditYear: (value: string) => void
  editTmdbId: string
  setEditTmdbId: (value: string) => void
  editPosterUrl: string
  setEditPosterUrl: (value: string) => void
  editTrailerUrl: string
  setEditTrailerUrl: (value: string) => void
  saving: boolean
  deleting: boolean
  deleteSourceFiles: boolean
  setDeleteSourceFiles: (value: boolean) => void
  handleSaveEdit: () => Promise<void>
  handleRefreshFromTmdb: () => Promise<void>
  handleDelete: () => void
  closeModal: () => void
}

// ─── Composant ───────────────────────────────────────────────────────────────

export function MediaDetailModal({
  selectedMedia,
  deletePreview,
  modalMode,
  setModalMode,
  editTitle,
  setEditTitle,
  editYear,
  setEditYear,
  editTmdbId,
  setEditTmdbId,
  editPosterUrl,
  setEditPosterUrl,
  editTrailerUrl,
  setEditTrailerUrl,
  saving,
  deleting,
  deleteSourceFiles,
  setDeleteSourceFiles,
  handleSaveEdit,
  handleRefreshFromTmdb,
  handleDelete,
  closeModal
}: MediaDetailModalProps) {
  return (
    <div className={styles.modal} onClick={closeModal}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <button className={styles.modalClose} onClick={closeModal}><X size={20} /></button>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setModalMode('view')}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: modalMode === 'view' ? 'white' : 'rgba(255,255,255,0.1)',
              color: modalMode === 'view' ? 'black' : 'white',
              fontWeight: 500, fontSize: 13
            }}
          >
            <Eye size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Détails
          </button>
          <button
            onClick={() => setModalMode('edit')}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: modalMode === 'edit' ? 'white' : 'rgba(255,255,255,0.1)',
              color: modalMode === 'edit' ? 'black' : 'white',
              fontWeight: 500, fontSize: 13
            }}
          >
            <Edit3 size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Modifier
          </button>
        </div>

        {modalMode === 'view' ? (
          <ViewMode
            selectedMedia={selectedMedia}
            deletePreview={deletePreview}
            deleting={deleting}
            deleteSourceFiles={deleteSourceFiles}
            setDeleteSourceFiles={setDeleteSourceFiles}
            handleDelete={handleDelete}
            closeModal={closeModal}
          />
        ) : (
          <EditMode
            editTitle={editTitle}
            setEditTitle={setEditTitle}
            editYear={editYear}
            setEditYear={setEditYear}
            editTmdbId={editTmdbId}
            setEditTmdbId={setEditTmdbId}
            editPosterUrl={editPosterUrl}
            setEditPosterUrl={setEditPosterUrl}
            editTrailerUrl={editTrailerUrl}
            setEditTrailerUrl={setEditTrailerUrl}
            saving={saving}
            setModalMode={setModalMode}
            handleSaveEdit={handleSaveEdit}
            handleRefreshFromTmdb={handleRefreshFromTmdb}
          />
        )}
      </div>
    </div>
  )
}

// ─── Vue Détails ─────────────────────────────────────────────────────────────

interface ViewModeProps {
  selectedMedia: MediaItem
  deletePreview: DeletePreview | null
  deleting: boolean
  deleteSourceFiles: boolean
  setDeleteSourceFiles: (value: boolean) => void
  handleDelete: () => void
  closeModal: () => void
}

function ViewMode({
  selectedMedia,
  deletePreview,
  deleting,
  deleteSourceFiles,
  setDeleteSourceFiles,
  handleDelete,
  closeModal
}: ViewModeProps) {
  return (
    <>
      <h3 style={{ margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {selectedMedia.type === 'series' ? <Tv size={20} /> : <Film size={20} />}
        {selectedMedia.title}
      </h3>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div style={{ width: 100, height: 150, borderRadius: 8, overflow: 'hidden', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
          {selectedMedia.poster_url && !selectedMedia.poster_url.includes('placeholder') ? (
            <Image src={selectedMedia.poster_url} alt={selectedMedia.title} width={100} height={150} style={{ objectFit: 'cover' }} unoptimized />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.2)' }}>
              {selectedMedia.type === 'series' ? <Tv size={32} /> : <Film size={32} />}
            </div>
          )}
        </div>

        <div style={{ fontSize: 13 }}>
          <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.7)' }}>
            <strong>Type :</strong> {selectedMedia.type === 'series' ? 'Série TV' : 'Film'}
          </p>
          {selectedMedia.year && (
            <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.7)' }}><strong>Année :</strong> {selectedMedia.year}</p>
          )}
          {selectedMedia.tmdb_id && (
            <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.7)' }}><strong>TMDB ID :</strong> {selectedMedia.tmdb_id}</p>
          )}
          {selectedMedia.trailer_url && (
            <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.7)', wordBreak: 'break-all' }}>
              <strong>Bande-annonce :</strong>{' '}
              <a href={selectedMedia.trailer_url} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                {selectedMedia.trailer_url}
              </a>
            </p>
          )}
          {selectedMedia.type === 'series' && deletePreview?.episodes !== undefined && (
            <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.7)' }}><strong>Épisodes :</strong> {deletePreview.episodes}</p>
          )}
        </div>
      </div>

      {/* Zone de suppression */}
      {deletePreview && (
        <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', color: 'rgb(252, 165, 165)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} /> Suppression
          </h4>
          <ul style={{ margin: '0 0 12px', paddingLeft: 20, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            <li>{selectedMedia.type === 'series' ? `La série et ses ${deletePreview.episodes || 0} épisodes` : 'Le film'}</li>
            {deletePreview.favorites > 0 && <li>{deletePreview.favorites} favoris</li>}
            {deletePreview.playbackPositions > 0 && <li>{deletePreview.playbackPositions} positions de lecture</li>}
            {deletePreview.hasTranscoded && <li>Fichiers transcodés</li>}
          </ul>

          {deletePreview.hasSourceFiles && (
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              background: deleteSourceFiles ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0,0,0,0.2)',
              borderRadius: 6, cursor: 'pointer', marginTop: 12,
              border: deleteSourceFiles ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid transparent'
            }}>
              <input
                type="checkbox"
                checked={deleteSourceFiles}
                onChange={(e) => setDeleteSourceFiles(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <div>
                <span style={{ color: deleteSourceFiles ? '#ef4444' : 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: 13 }}>
                  Supprimer aussi {deletePreview.sourceFilesCount} fichier(s) source du NAS
                </span>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                  ⚠️ Action irréversible !
                </p>
              </div>
            </label>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button className={styles.btnSecondary} onClick={closeModal}>Fermer</button>
        <button className={styles.btnDanger} onClick={handleDelete} disabled={deleting}>
          {deleting ? <><RefreshCw size={16} className={styles.spin} /> Suppression...</> : <><Trash2 size={16} /> Supprimer</>}
        </button>
      </div>
    </>
  )
}

// ─── Mode Édition ────────────────────────────────────────────────────────────

interface EditModeProps {
  editTitle: string
  setEditTitle: (value: string) => void
  editYear: string
  setEditYear: (value: string) => void
  editTmdbId: string
  setEditTmdbId: (value: string) => void
  editPosterUrl: string
  setEditPosterUrl: (value: string) => void
  editTrailerUrl: string
  setEditTrailerUrl: (value: string) => void
  saving: boolean
  setModalMode: (mode: ModalMode) => void
  handleSaveEdit: () => Promise<void>
  handleRefreshFromTmdb: () => Promise<void>
}

function EditMode({
  editTitle,
  setEditTitle,
  editYear,
  setEditYear,
  editTmdbId,
  setEditTmdbId,
  editPosterUrl,
  setEditPosterUrl,
  editTrailerUrl,
  setEditTrailerUrl,
  saving,
  setModalMode,
  handleSaveEdit,
  handleRefreshFromTmdb
}: EditModeProps) {
  return (
    <>
      <h3 style={{ margin: '0 0 20px' }}>Modifier les métadonnées</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Titre</label>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className={styles.input}
            placeholder="Titre du média"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Année</label>
            <input
              type="number"
              value={editYear}
              onChange={(e) => setEditYear(e.target.value)}
              className={styles.input}
              placeholder="2024"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>TMDB ID</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                value={editTmdbId}
                onChange={(e) => setEditTmdbId(e.target.value)}
                className={styles.input}
                placeholder="12345"
                style={{ flex: 1 }}
              />
              <button
                onClick={handleRefreshFromTmdb}
                disabled={!editTmdbId || saving}
                className={styles.btnIcon}
                title="Importer depuis TMDB"
                style={{ width: 40, height: 40 }}
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>URL de l&apos;affiche</label>
          <input
            type="url"
            value={editPosterUrl}
            onChange={(e) => setEditPosterUrl(e.target.value)}
            className={styles.input}
            placeholder="https://image.tmdb.org/..."
          />
        </div>

        {editPosterUrl && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 100, height: 150, borderRadius: 8, overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
              <Image src={editPosterUrl} alt="Aperçu" width={100} height={150} style={{ objectFit: 'cover' }} unoptimized />
            </div>
          </div>
        )}

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            Bande-annonce YouTube
          </label>
          <input
            type="url"
            value={editTrailerUrl}
            onChange={(e) => setEditTrailerUrl(e.target.value)}
            className={styles.input}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <p style={{ margin: '6px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            Vide = bande-annonce automatique depuis TMDB
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
        <button className={styles.btnSecondary} onClick={() => setModalMode('view')}>Annuler</button>
        <button className={styles.btnPrimary} onClick={handleSaveEdit} disabled={saving}>
          {saving ? <><RefreshCw size={16} className={styles.spin} /> Enregistrement...</> : <><Check size={16} /> Enregistrer</>}
        </button>
      </div>
    </>
  )
}
