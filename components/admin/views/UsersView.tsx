'use client'

import { useState, useEffect } from 'react'
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
  Check 
} from 'lucide-react'
import { useToast } from '@/components/admin/Toast/Toast'
import styles from '@/app/admin/admin.module.css'

interface UserData {
  id: string
  email: string
  display_name: string | null
  created_at: string
  last_sign_in_at: string | null
  email_confirmed: boolean
  in_progress_count: number
  completed_count: number
  total_watch_time_minutes: number
  in_progress_items: Array<{
    media_id: string
    title: string
    poster_url: string | null
    media_type: 'movie' | 'episode'
    position: number
    duration: number | null
    progress_percent: number
    updated_at: string
    season_number?: number
    episode_number?: number
    series_title?: string
  }>
}

export function UsersView() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [deletingItem, setDeletingItem] = useState<string | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    try {
      setLoading(true)
      const response = await fetch('/api/users?includeInProgress=true')
      const data = await response.json()
      if (data.success) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error)
      addToast('error', 'Erreur', 'Chargement des utilisateurs échoué')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeletePosition(userId: string, mediaId: string, title: string) {
    if (!confirm(`Supprimer "${title}" de la liste "En cours" de cet utilisateur ?`)) return

    setDeletingItem(mediaId)
    try {
      const response = await fetch(`/api/users?userId=${userId}&mediaId=${mediaId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // Mettre à jour l'état local
        setUsers(prev => prev.map(user => {
          if (user.id === userId) {
            return {
              ...user,
              in_progress_items: user.in_progress_items.filter(item => item.media_id !== mediaId),
              in_progress_count: user.in_progress_count - 1
            }
          }
          return user
        }))
        addToast('success', 'Supprimé', `"${title}" retiré de la liste`)
      } else {
        addToast('error', 'Erreur', 'Suppression échouée')
      }
    } catch (error) {
      console.error('Erreur suppression:', error)
      addToast('error', 'Erreur', 'Suppression échouée')
    } finally {
      setDeletingItem(null)
    }
  }

  function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h${mins}min` : `${hours}h`
  }

  function formatPosition(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return "Aujourd'hui"
    if (days === 1) return "Hier"
    if (days < 7) return `Il y a ${days} jours`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
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
        <button onClick={loadUsers} className={styles.refreshBtn}>
          <RefreshCw size={16} />
        </button>
      </div>

      {users.length === 0 ? (
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
                        <span>{formatDuration(user.total_watch_time_minutes)} regardé</span>
                      </>
                    )}
                  </div>
                </div>
                <div className={styles.userLastActivity}>
                  {user.last_sign_in_at && (
                    <span className={styles.lastActivityBadge}>
                      Dernière connexion: {formatDate(user.last_sign_in_at)}
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
                            {formatDate(item.updated_at)}
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
