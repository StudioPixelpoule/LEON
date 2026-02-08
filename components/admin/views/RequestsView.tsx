/**
 * RequestsView - Vue admin pour gérer les demandes de films/séries
 * Liste les demandes avec filtrage, actions marquer ajouté / supprimer
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Check, Trash2, MessageSquare, Film, Tv } from 'lucide-react'
import { useToast } from '@/components/admin/Toast/Toast'
import styles from '@/app/admin/admin.module.css'

interface MediaRequest {
  id: string
  user_id: string
  user_name?: string
  tmdb_id: number | null
  media_type: 'movie' | 'tv' | null
  title: string
  year: number | null
  poster_url: string | null
  comment: string | null
  status: 'pending' | 'added' | 'rejected'
  created_at: string
  updated_at: string
}

type FilterStatus = 'pending' | 'added' | 'all'

export function RequestsView() {
  const [requests, setRequests] = useState<MediaRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const { addToast } = useToast()

  // Charger les demandes
  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      const statusParam = filter === 'all' ? '' : `?status=${filter}`
      const res = await fetch(`/api/media-requests${statusParam}`)
      if (!res.ok) throw new Error('Erreur chargement')
      const data = await res.json()
      setRequests(data.requests || [])
    } catch (error) {
      console.error('[ADMIN] Erreur chargement demandes:', error)
      addToast('error', 'Erreur', 'Impossible de charger les demandes')
    } finally {
      setLoading(false)
    }
  }, [filter, addToast])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  // Marquer comme ajouté
  const handleMarkAdded = useCallback(async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/media-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'added' })
      })
      if (!res.ok) throw new Error('Erreur mise à jour')

      setRequests(prev => prev.map(r =>
        r.id === id ? { ...r, status: 'added' as const } : r
      ))
      addToast('success', 'Demande marquée comme ajoutée')
    } catch (error) {
      console.error('[ADMIN] Erreur PATCH:', error)
      addToast('error', 'Erreur', 'Impossible de mettre à jour')
    } finally {
      setActionLoading(null)
    }
  }, [addToast])

  // Supprimer
  const handleDelete = useCallback(async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/media-requests/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Erreur suppression')

      setRequests(prev => prev.filter(r => r.id !== id))
      addToast('success', 'Demande supprimée')
    } catch (error) {
      console.error('[ADMIN] Erreur DELETE:', error)
      addToast('error', 'Erreur', 'Impossible de supprimer')
    } finally {
      setActionLoading(null)
    }
  }, [addToast])

  // Formater la date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div>
      {/* En-tête */}
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Demandes</h2>
          <p className={styles.sectionSubtitle}>
            {pendingCount > 0 
              ? `${pendingCount} demande${pendingCount > 1 ? 's' : ''} en attente`
              : 'Aucune demande en attente'
            }
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={loadRequests} disabled={loading}>
          <RefreshCw size={16} className={loading ? styles.spinning : ''} />
          Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['pending', 'added', 'all'] as FilterStatus[]).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: filter === status ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
              background: filter === status ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: filter === status ? '#fff' : 'rgba(255,255,255,0.5)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 150ms'
            }}
          >
            {status === 'pending' ? 'En attente' : status === 'added' ? 'Ajoutés' : 'Tous'}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>
          Chargement...
        </div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
          Aucune demande {filter === 'pending' ? 'en attente' : filter === 'added' ? 'traitée' : ''}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {requests.map(req => (
            <div
              key={req.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                background: req.status === 'added' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.06)',
                opacity: req.status === 'added' ? 0.5 : 1,
                transition: 'opacity 200ms'
              }}
            >
              {/* Poster */}
              {req.poster_url ? (
                <img
                  src={req.poster_url}
                  alt={req.title}
                  style={{
                    width: '48px',
                    height: '72px',
                    borderRadius: '6px',
                    objectFit: 'cover',
                    flexShrink: 0
                  }}
                />
              ) : (
                <div style={{
                  width: '48px',
                  height: '72px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {req.tmdb_id ? (
                    req.media_type === 'tv' ? <Tv size={18} color="rgba(255,255,255,0.2)" /> : <Film size={18} color="rgba(255,255,255,0.2)" />
                  ) : (
                    <MessageSquare size={18} color="rgba(255,255,255,0.2)" />
                  )}
                </div>
              )}

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#fff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textDecoration: req.status === 'added' ? 'line-through' : 'none'
                  }}>
                    {req.title}
                  </span>
                  {req.media_type && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      background: 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.5)',
                      flexShrink: 0
                    }}>
                      {req.media_type === 'movie' ? 'Film' : 'Série'}
                    </span>
                  )}
                  {req.year && (
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                      {req.year}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                  {req.user_name || 'Utilisateur'} &middot; {formatDate(req.created_at)}
                </div>
                {req.comment && !req.tmdb_id && (
                  <div style={{
                    marginTop: '6px',
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.6)',
                    fontStyle: 'italic'
                  }}>
                    &quot;{req.comment}&quot;
                  </div>
                )}
              </div>

              {/* Actions */}
              {req.status === 'pending' && (
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={() => handleMarkAdded(req.id)}
                    disabled={actionLoading === req.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 150ms',
                      opacity: actionLoading === req.id ? 0.5 : 1
                    }}
                    title="Marquer comme ajouté"
                  >
                    <Check size={14} />
                    Ajouté
                  </button>
                  <button
                    onClick={() => handleDelete(req.id)}
                    disabled={actionLoading === req.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(220,38,38,0.2)',
                      background: 'rgba(220,38,38,0.08)',
                      color: '#f87171',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                      opacity: actionLoading === req.id ? 0.5 : 1
                    }}
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}

              {req.status === 'added' && (
                <div style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.3)',
                  fontWeight: 500,
                  flexShrink: 0
                }}>
                  Ajouté
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
