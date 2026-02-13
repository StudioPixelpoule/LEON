'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import {
  Users,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  Play,
  Film,
  Clock,
  Trash2,
  Check,
  X
} from 'lucide-react'
import { useAdminToast } from '@/components/admin/Toast/Toast'
import { useUsers } from '@/components/admin/hooks/useUsers'
import { formatActivityDuration, formatPosition, formatUserDate } from '@/components/admin/utils/activityFormatters'
import styles from '@/app/admin/admin.module.css'

// Debounce pour le bouton refresh
const REFRESH_DEBOUNCE_MS = 1000

export function UsersView() {
  const {
    users, loading, error,
    expandedUser, setExpandedUser,
    deletingItem, refresh, deletePosition
  } = useUsers()
  const { addToast } = useAdminToast()

  // Confirmation inline : stocke le mediaId en attente de confirmation
  const [confirmDelete, setConfirmDelete] = useState<{ userId: string; mediaId: string; title: string } | null>(null)
  const lastRefreshRef = useRef(0)

  const handleRefresh = useCallback(() => {
    const now = Date.now()
    if (now - lastRefreshRef.current < REFRESH_DEBOUNCE_MS) return
    lastRefreshRef.current = now
    refresh()
  }, [refresh])

  async function handleDeletePosition(userId: string, mediaId: string, title: string) {
    // Afficher la confirmation inline
    setConfirmDelete({ userId, mediaId, title })
  }

  async function confirmDeletePosition() {
    if (!confirmDelete) return
    const { userId, mediaId, title } = confirmDelete
    setConfirmDelete(null)

    const success = await deletePosition(userId, mediaId, title)
    if (success) {
      addToast('success', 'Supprimé', `"${title}" retiré de la liste`)
    } else {
      addToast('error', 'Erreur', 'Suppression échouée — annulée')
    }
  }

  if (loading) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionIcon}><Users size={20} /></div>
          <h2 className={styles.sectionTitle}>Utilisateurs</h2>
        </div>
        <div className={styles.loading}>
          <RefreshCw className={styles.spin} size={24} />
          <span>Chargement des utilisateurs...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionIcon}><Users size={20} /></div>
        <h2 className={styles.sectionTitle}>Utilisateurs ({users.length})</h2>
        <button onClick={handleRefresh} className={styles.refreshBtn}>
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px', marginBottom: 16,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 8, color: '#ef4444', fontSize: 14
        }}>
          <AlertCircle size={16} />
          <span>Erreur : {error}</span>
          <button
            onClick={handleRefresh}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: '#ef4444', cursor: 'pointer', textDecoration: 'underline'
            }}
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Confirmation inline */}
      {confirmDelete && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', marginBottom: 16,
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 8, fontSize: 14
        }}>
          <AlertCircle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.9)' }}>
            Supprimer &quot;{confirmDelete.title}&quot; de la liste &quot;En cours&quot; ?
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              onClick={confirmDeletePosition}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 6,
                color: '#ef4444', cursor: 'pointer', fontSize: 13
              }}
            >
              <Trash2 size={14} /> Supprimer
            </button>
            <button
              onClick={() => setConfirmDelete(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 13
              }}
            >
              <X size={14} /> Annuler
            </button>
          </div>
        </div>
      )}

      {users.length === 0 && !error ? (
        <div className={styles.emptyState}>
          <Users size={48} />
          <p>Aucun utilisateur inscrit</p>
        </div>
      ) : (
        <div className={styles.usersList}>
          {users.map(user => (
            <div key={user.id} className={styles.userCard}>
              {/* Header utilisateur */}
              <div
                className={styles.userHeader}
                onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
              >
                <div className={styles.userAvatar}>
                  {(user.display_name || user.email).charAt(0).toUpperCase()}
                </div>
                <div className={styles.userInfo}>
                  <div className={styles.userName}>
                    {user.display_name || user.email.split('@')[0]}
                    {!user.email_confirmed && (
                      <span className={styles.unverifiedBadge} title="Email non vérifié">
                        <AlertCircle size={14} />
                      </span>
                    )}
                  </div>
                  <div className={styles.userEmail}>{user.email}</div>
                  <div className={styles.userMeta}>
                    <span>Inscrit le {new Date(user.created_at).toLocaleDateString('fr-FR')}</span>
                    {user.in_progress_count > 0 && (
                      <>
                        <span>•</span>
                        <span>{user.in_progress_count} en cours</span>
                      </>
                    )}
                    {user.total_watch_time_minutes > 0 && (
                      <>
                        <span>•</span>
                        <span>{formatActivityDuration(user.total_watch_time_minutes)} regardé</span>
                      </>
                    )}
                  </div>
                </div>
                <div className={styles.userLastActivity}>
                  {user.last_sign_in_at && (
                    <span className={styles.lastActivityBadge}>
                      Dernière connexion: {formatUserDate(user.last_sign_in_at)}
                    </span>
                  )}
                  <ChevronRight
                    size={20}
                    className={`${styles.chevron} ${expandedUser === user.id ? styles.expanded : ''}`}
                  />
                </div>
              </div>

              {/* Contenu déplié : médias en cours */}
              {expandedUser === user.id && user.in_progress_items.length > 0 && (
                <div className={styles.userContent}>
                  <h4 className={styles.inProgressTitle}>
                    <Play size={14} />
                    En cours de visionnage
                  </h4>
                  <div className={styles.inProgressList}>
                    {user.in_progress_items.map(item => (
                      <div key={item.media_id} className={styles.inProgressItem}>
                        <div className={styles.inProgressPoster}>
                          {item.poster_url ? (
                            <Image
                              src={item.poster_url}
                              alt={item.title}
                              width={60}
                              height={90}
                              style={{ objectFit: 'cover', borderRadius: 4 }}
                              unoptimized
                            />
                          ) : (
                            <div className={styles.posterPlaceholder}>
                              <Film size={20} />
                            </div>
                          )}
                          <div
                            className={styles.progressOverlay}
                            style={{ height: `${100 - item.progress_percent}%` }}
                          />
                        </div>
                        <div className={styles.inProgressInfo}>
                          <div className={styles.inProgressTitle2}>
                            {item.media_type === 'episode' && item.series_title
                              ? item.series_title
                              : item.title}
                          </div>
                          {item.media_type === 'episode' && (
                            <div className={styles.episodeInfo}>
                              S{item.season_number}E{item.episode_number} · {item.title}
                            </div>
                          )}
                          <div className={styles.progressInfo}>
                            <div className={styles.progressBar2}>
                              <div
                                className={styles.progressFill2}
                                style={{ width: `${item.progress_percent}%` }}
                              />
                            </div>
                            <span className={styles.progressText}>
                              {item.progress_percent}% · {formatPosition(item.position)}
                              {item.duration && ` / ${formatPosition(item.duration)}`}
                            </span>
                          </div>
                          <div className={styles.lastWatched}>
                            <Clock size={12} />
                            {formatUserDate(item.updated_at)}
                          </div>
                        </div>
                        <button
                          className={styles.deleteBtn}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeletePosition(user.id, item.media_id, item.title)
                          }}
                          disabled={deletingItem === item.media_id}
                          title="Supprimer de la liste"
                        >
                          {deletingItem === item.media_id ? (
                            <RefreshCw size={16} className={styles.spin} />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {expandedUser === user.id && user.in_progress_items.length === 0 && (
                <div className={styles.userContent}>
                  <div className={styles.noInProgress}>
                    <Check size={16} />
                    Aucun visionnage en cours
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
