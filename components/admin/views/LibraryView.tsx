'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  HardDrive,
  Search,
  RefreshCw,
  Tv,
  Film,
  ChevronRight,
  X,
  Eye,
  Edit3,
  AlertCircle,
  Trash2,
  RotateCcw,
  Check
} from 'lucide-react'
import styles from '@/app/admin/admin.module.css'
import { useAdminToast } from '@/components/admin/Toast/Toast'

interface MediaItem {
  id: string
  title: string
  year?: number
  poster_url?: string
  filepath?: string
  type: 'movie' | 'series'
  episode_count?: number
  tmdb_id?: number
  overview?: string
}

interface DeletePreview {
  media: MediaItem | null
  episodes?: number
  favorites: number
  playbackPositions: number
  hasTranscoded: boolean
  hasSourceFiles: boolean
  sourceFilesCount: number
  filepath?: string
}

type ModalMode = 'view' | 'edit'

export function LibraryView() {
  const [searchQuery, setSearchQuery] = useState('')
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'series'>('all')
  const [results, setResults] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null)
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteSourceFiles, setDeleteSourceFiles] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('view')
  const [saving, setSaving] = useState(false)
  
  // Champs d'édition
  const [editTitle, setEditTitle] = useState('')
  const [editYear, setEditYear] = useState('')
  const [editTmdbId, setEditTmdbId] = useState('')
  const [editPosterUrl, setEditPosterUrl] = useState('')
  
  const { addToast } = useAdminToast()

  // Recherche avec debounce
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    if (searchQuery.length < 2) {
      setResults([])
      return
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchMedia()
    }, 300)
    
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, mediaType])

  async function searchMedia() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ q: searchQuery })
      if (mediaType !== 'all') params.set('type', mediaType)
      
      const response = await fetch(`/api/admin/library-search?${params}`)
      const data = await response.json()
      
      if (data.success && data.results) {
        const items: MediaItem[] = []
        
        if (data.results.movies) {
          items.push(...data.results.movies.map((m: any) => ({
            id: m.id,
            title: m.title,
            year: m.year,
            poster_url: m.poster_url,
            filepath: m.pcloud_fileid,
            type: 'movie' as const
          })))
        }
        
        if (data.results.series) {
          items.push(...data.results.series.map((s: any) => ({
            id: s.id,
            title: s.title,
            year: s.year,
            poster_url: s.poster_url,
            type: 'series' as const,
            episode_count: s.episode_count
          })))
        }
        
        setResults(items)
      }
    } catch (error) {
      console.error('Erreur recherche:', error)
      addToast('error', 'Erreur', 'Recherche échouée')
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectMedia(media: MediaItem) {
    setSelectedMedia(media)
    setDeletePreview(null)
    setModalMode('view')
    setDeleteSourceFiles(false)
    
    // Charger les infos complètes et la prévisualisation
    try {
      const [previewRes, infoRes] = await Promise.all([
        fetch(`/api/admin/delete-media?id=${media.id}&type=${media.type}`),
        fetch(`/api/admin/update-media-info?id=${media.id}&type=${media.type}`)
      ])
      
      const previewData = await previewRes.json()
      const infoData = await infoRes.json()
      
      if (previewData.success) {
        setDeletePreview(previewData.preview)
      }
      
      if (infoData.success && infoData.media) {
        // Mettre à jour les infos complètes
        setSelectedMedia(prev => prev ? {
          ...prev,
          tmdb_id: infoData.media.tmdb_id,
          overview: infoData.media.overview
        } : null)
        
        // Initialiser les champs d'édition
        setEditTitle(infoData.media.title || '')
        setEditYear(infoData.media.year?.toString() || '')
        setEditTmdbId(infoData.media.tmdb_id?.toString() || '')
        setEditPosterUrl(infoData.media.poster_url || '')
      }
    } catch (error) {
      console.error('Erreur chargement infos:', error)
    }
  }

  async function handleDelete() {
    if (!selectedMedia) return
    
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
    
    if (!confirm(confirmMsg)) return
    
    // Double confirmation pour la suppression des fichiers sources
    if (deleteSourceFiles && deletePreview?.hasSourceFiles) {
      if (!confirm('DERNIÈRE CONFIRMATION\n\nVoulez-vous vraiment supprimer les fichiers sources du NAS ?\n\nCette action ne peut pas être annulée.')) {
        return
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
        closeModal()
      } else {
        addToast('error', 'Erreur', data.error || 'Suppression échouée')
      }
    } catch (error) {
      console.error('Erreur suppression:', error)
      addToast('error', 'Erreur', 'Suppression échouée')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSaveEdit() {
    if (!selectedMedia) return
    
    setSaving(true)
    try {
      const payload: any = {
        id: selectedMedia.id,
        type: selectedMedia.type
      }
      
      if (editTitle !== selectedMedia.title) payload.title = editTitle
      if (editYear !== (selectedMedia.year?.toString() || '')) {
        payload.year = editYear ? parseInt(editYear, 10) : null
      }
      if (editTmdbId !== (selectedMedia.tmdb_id?.toString() || '')) {
        payload.tmdb_id = editTmdbId ? parseInt(editTmdbId, 10) : null
      }
      if (editPosterUrl !== (selectedMedia.poster_url || '')) {
        payload.poster_url = editPosterUrl || null
      }
      
      const response = await fetch('/api/admin/update-media-info', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      const data = await response.json()
      
      if (data.success) {
        addToast('success', 'Sauvegardé', data.message)
        
        // Mettre à jour la liste et le média sélectionné
        const updatedMedia = { ...selectedMedia, ...data.media }
        setSelectedMedia(updatedMedia)
        setResults(prev => prev.map(r => r.id === selectedMedia.id ? updatedMedia : r))
        setModalMode('view')
      } else {
        addToast('error', 'Erreur', data.error || 'Sauvegarde échouée')
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
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
        setEditPosterUrl(data.media.poster_url || '')
        setResults(prev => prev.map(r => r.id === selectedMedia.id ? updatedMedia : r))
      } else {
        addToast('error', 'Erreur', data.error || 'Import TMDB échoué')
      }
    } catch (error) {
      console.error('Erreur TMDB:', error)
      addToast('error', 'Erreur', 'Import TMDB échoué')
    } finally {
      setSaving(false)
    }
  }

  function closeModal() {
    setSelectedMedia(null)
    setDeletePreview(null)
    setModalMode('view')
    setDeleteSourceFiles(false)
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
              <>
                {/* Vue détails */}
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
            ) : (
              <>
                {/* Mode édition */}
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
                </div>
                
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                  <button className={styles.btnSecondary} onClick={() => setModalMode('view')}>Annuler</button>
                  <button className={styles.btnPrimary} onClick={handleSaveEdit} disabled={saving}>
                    {saving ? <><RefreshCw size={16} className={styles.spin} /> Enregistrement...</> : <><Check size={16} /> Enregistrer</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
