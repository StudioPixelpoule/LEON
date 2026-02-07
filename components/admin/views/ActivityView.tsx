'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { 
  RefreshCw, 
  Activity, 
  Users, 
  Clock, 
  Eye, 
  Film, 
  Filter 
} from 'lucide-react'
import styles from '@/app/admin/admin.module.css'
import { useAdminToast } from '@/components/admin/Toast/Toast'

// ============================================
// TYPES
// ============================================

interface ActiveSession {
  id: string
  userId: string | null
  userName: string
  userEmail: string | null
  title: string
  posterUrl: string | null
  year: number | null
  progress: number
  updatedAt: string
  isActive: boolean
}

interface HistoryEntry {
  id: string
  userId: string | null
  userName: string
  userEmail: string | null
  mediaId: string
  title: string
  posterUrl: string | null
  year: number | null
  watchedAt: string
  watchDuration: number | null
  completed: boolean
  progress: number
}

interface UserStats {
  userId: string
  userName: string
  userEmail: string | null
  totalWatches: number
  totalWatchTimeMinutes: number
  completedCount: number
  lastActivity: string
}

interface ActivityData {
  activeSessions: ActiveSession[]
  recentHistory: HistoryEntry[]
  stats: { totalWatches: number; uniqueViewers: number; totalWatchTimeMinutes: number }
}

interface HistoryData {
  history: HistoryEntry[]
  userStats: UserStats[]
  users: Array<{ id: string; name: string; email: string }>
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

type ActivityTab = 'live' | 'users' | 'history'

// ============================================
// COMPONENT
// ============================================

export function ActivityView() {
  const [activeTab, setActiveTab] = useState<ActivityTab>('live')
  const [liveData, setLiveData] = useState<ActivityData | null>(null)
  const [historyData, setHistoryData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [selectedDays, setSelectedDays] = useState<number>(30)
  const [currentPage, setCurrentPage] = useState(1)
  const [historyPreloaded, setHistoryPreloaded] = useState(false)

  // useAdminToast is imported but not used in this component
  // It's available for future use if needed

  // Charger les données live + précharger l'historique en parallèle
  useEffect(() => {
    async function loadInitialData() {
      try {
        // Charger live et historique en parallèle pour un accès instantané
        const [liveRes, historyRes] = await Promise.all([
          fetch('/api/stats/watching'),
          fetch('/api/stats/history?limit=30&days=30')
        ])
        const [liveResult, historyResult] = await Promise.all([
          liveRes.json(),
          historyRes.json()
        ])
        setLiveData(liveResult)
        setHistoryData(historyResult)
        setHistoryPreloaded(true)
      } catch (error) {
        console.error('Erreur chargement initial:', error)
      } finally {
        setLoading(false)
      }
    }
    loadInitialData()
    
    // Rafraîchir les données live toutes les 10 secondes
    const interval = setInterval(loadLiveData, 10000)
    return () => clearInterval(interval)
  }, [])

  // Recharger l'historique uniquement si les filtres changent
  useEffect(() => {
    if (historyPreloaded && (selectedUser !== 'all' || selectedDays !== 30 || currentPage !== 1)) {
      loadHistoryData()
    }
  }, [selectedUser, selectedDays, currentPage, historyPreloaded])

  async function loadLiveData() {
    try {
      const response = await fetch('/api/stats/watching')
      const result = await response.json()
      setLiveData(result)
    } catch (error) {
      console.error('Erreur chargement live:', error)
    }
  }

  async function loadHistoryData() {
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '30',
        days: selectedDays.toString(),
        ...(selectedUser !== 'all' && { userId: selectedUser })
      })
      const response = await fetch(`/api/stats/history?${params}`)
      const result = await response.json()
      setHistoryData(result)
    } catch (error) {
      console.error('Erreur chargement historique:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  function formatTime(iso: string): string {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (diff < 1) return 'À l\'instant'
    if (diff < 60) return `Il y a ${diff}min`
    const h = Math.floor(diff / 60)
    if (h < 24) return `Il y a ${h}h`
    const d = Math.floor(h / 24)
    if (d < 7) return `Il y a ${d}j`
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}min`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }

  if (loading) {
    return (
      <div className={styles.section}>
        <div className={styles.loading}>
          <RefreshCw size={32} className={styles.spin} />
          <p className={styles.loadingText}>Chargement...</p>
        </div>
      </div>
    )
  }

  const activeSessions = liveData?.activeSessions.filter(s => s.isActive) || []
  const recentSessions = liveData?.activeSessions.filter(s => !s.isActive) || []

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.sectionTitle}>Activité</h1>
          <p className={styles.sectionDesc}>Suivi en temps réel et historique des visionnages</p>
        </div>
        <button className={styles.btnIcon} onClick={() => { loadLiveData(); if (activeTab !== 'live') loadHistoryData() }}>
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Onglets */}
      <div className={styles.tabs}>
        <button 
          onClick={() => setActiveTab('live')}
          className={`${styles.tab} ${activeTab === 'live' ? styles.tabActive : ''}`}
        >
          <Activity size={16} />
          En direct
          {activeSessions.length > 0 && (
            <span className={styles.tabBadge}>{activeSessions.length}</span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`${styles.tab} ${activeTab === 'users' ? styles.tabActiveBlue : ''}`}
        >
          <Users size={16} />
          Utilisateurs
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`${styles.tab} ${activeTab === 'history' ? styles.tabActivePurple : ''}`}
        >
          <Clock size={16} />
          Historique
        </button>
      </div>

      {/* Onglet En direct */}
      {activeTab === 'live' && (
        <>
          {/* KPIs */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={`${styles.kpiIcon} ${styles.green}`}><Activity size={24} /></div>
              <div className={styles.kpiContent}>
                <span className={styles.kpiValue}>{activeSessions.length}</span>
                <span className={styles.kpiLabel}>En train de regarder</span>
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={`${styles.kpiIcon} ${styles.blue}`}><Users size={24} /></div>
              <div className={styles.kpiContent}>
                <span className={styles.kpiValue}>{liveData?.stats.uniqueViewers || 0}</span>
                <span className={styles.kpiLabel}>Spectateurs (24h)</span>
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={`${styles.kpiIcon} ${styles.purple}`}><Eye size={24} /></div>
              <div className={styles.kpiContent}>
                <span className={styles.kpiValue}>{liveData?.stats.totalWatches || 0}</span>
                <span className={styles.kpiLabel}>Visionnages (24h)</span>
              </div>
            </div>
          </div>

          {/* Sessions actives */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}><Activity size={20} /></div>
              <h3 className={styles.cardTitle}>En train de regarder ({activeSessions.length})</h3>
            </div>
            {activeSessions.length === 0 ? (
              <p className={styles.emptyText} style={{ textAlign: 'center', padding: 40 }}>Personne ne regarde en ce moment</p>
            ) : (
              <div className={styles.list}>
                {activeSessions.map((session) => (
                  <div key={session.id} className={styles.listItem} style={{ alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ position: 'relative', width: 60, height: 90, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
                      {session.posterUrl && !session.posterUrl.includes('placeholder') ? (
                        <Image src={session.posterUrl} alt={session.title} fill sizes="60px" style={{ objectFit: 'cover' }} unoptimized />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)' }}><Film size={20} /></div>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#10b981' }}>{session.userName}</span>
                          {session.userEmail && (
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>{session.userEmail}</span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{formatTime(session.updatedAt)}</span>
                      </div>
                      <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 500 }}>{session.title} {session.year && `(${session.year})`}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${session.progress}%`, height: '100%', background: '#10b981', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>{session.progress}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sessions récentes */}
          {recentSessions.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}><Clock size={20} /></div>
                <h3 className={styles.cardTitle}>Récemment en pause ({recentSessions.length})</h3>
              </div>
              <div className={styles.list}>
                {recentSessions.slice(0, 5).map((session) => (
                  <div key={session.id} className={styles.listItem} style={{ opacity: 0.7 }}>
                    <div style={{ position: 'relative', width: 40, height: 60, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
                      {session.posterUrl && !session.posterUrl.includes('placeholder') ? (
                        <Image src={session.posterUrl} alt={session.title} fill sizes="40px" style={{ objectFit: 'cover' }} unoptimized />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)' }}><Film size={16} /></div>
                      )}
                    </div>
                    <div className={styles.listContent}>
                      <span className={styles.listTitle}>{session.userName} • {session.title}</span>
                      <span className={styles.listMeta}>{formatTime(session.updatedAt)} • {session.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Onglet Utilisateurs */}
      {activeTab === 'users' && (
        <>
          {historyLoading ? (
            <div className={styles.loading} style={{ padding: 60 }}>
              <RefreshCw size={24} className={styles.spin} />
              <p className={styles.loadingText}>Chargement des statistiques...</p>
            </div>
          ) : (
            <>
              {/* Stats globales */}
              <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                  <div className={`${styles.kpiIcon} ${styles.blue}`}><Users size={24} /></div>
                  <div className={styles.kpiContent}>
                    <span className={styles.kpiValue}>{historyData?.userStats.length || 0}</span>
                    <span className={styles.kpiLabel}>Utilisateurs actifs</span>
                  </div>
                </div>
                <div className={styles.kpiCard}>
                  <div className={`${styles.kpiIcon} ${styles.purple}`}><Eye size={24} /></div>
                  <div className={styles.kpiContent}>
                    <span className={styles.kpiValue}>{historyData?.pagination.total || 0}</span>
                    <span className={styles.kpiLabel}>Visionnages ({selectedDays}j)</span>
                  </div>
                </div>
                <div className={styles.kpiCard}>
                  <div className={`${styles.kpiIcon} ${styles.green}`}><Clock size={24} /></div>
                  <div className={styles.kpiContent}>
                    <span className={styles.kpiValue}>
                      {formatDuration(historyData?.userStats.reduce((acc, u) => acc + u.totalWatchTimeMinutes, 0) || 0)}
                    </span>
                    <span className={styles.kpiLabel}>Temps total</span>
                  </div>
                </div>
              </div>

              {/* Liste des utilisateurs */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIcon}><Users size={20} /></div>
                  <h3 className={styles.cardTitle}>Activité par utilisateur</h3>
                </div>
                {(!historyData?.userStats || historyData.userStats.length === 0) ? (
                  <p className={styles.emptyText} style={{ textAlign: 'center', padding: 40 }}>Aucune activité sur cette période</p>
                ) : (
                  <div className={styles.list}>
                    {historyData.userStats.map((user, index) => (
                      <div key={user.userId} className={styles.userCard}>
                        <div 
                          className={styles.userAvatar}
                          style={{ background: `hsl(${(index * 60) % 360}, 70%, 50%)` }}
                        >
                          {user.userName.charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.userInfo}>
                          <div className={styles.userName}>
                            <span>{user.userName}</span>
                            {user.userEmail && <span className={styles.userEmail}>{user.userEmail}</span>}
                          </div>
                          <div className={styles.userStats}>
                            <span><strong style={{ color: '#3b82f6' }}>{user.totalWatches}</strong> visionnages</span>
                            <span><strong style={{ color: '#10b981' }}>{user.completedCount}</strong> terminés</span>
                            <span><strong style={{ color: '#a855f7' }}>{formatDuration(user.totalWatchTimeMinutes)}</strong> regardés</span>
                          </div>
                        </div>
                        <div className={styles.userLastActivity}>
                          Dernière activité<br />
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{formatTime(user.lastActivity)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Onglet Historique */}
      {activeTab === 'history' && (
        <>
          {/* Filtres */}
          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <Filter size={16} className={styles.filterIcon} />
              <select 
                value={selectedUser}
                onChange={(e) => { setSelectedUser(e.target.value); setCurrentPage(1) }}
                className={styles.filterSelect}
              >
                <option value="all">Tous les utilisateurs</option>
                {historyData?.users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <Clock size={16} className={styles.filterIcon} />
              <select 
                value={selectedDays}
                onChange={(e) => { setSelectedDays(Number(e.target.value)); setCurrentPage(1) }}
                className={styles.filterSelect}
              >
                <option value={7}>7 derniers jours</option>
                <option value={30}>30 derniers jours</option>
                <option value={90}>90 derniers jours</option>
                <option value={365}>Cette année</option>
              </select>
            </div>
          </div>

          {historyLoading ? (
            <div className={styles.loading} style={{ padding: 60 }}>
              <RefreshCw size={24} className={styles.spin} />
              <p className={styles.loadingText}>Chargement de l&apos;historique...</p>
            </div>
          ) : (
            <>
              {/* Liste de l'historique */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIcon}><Clock size={20} /></div>
                  <h3 className={styles.cardTitle}>
                    Historique des visionnages 
                    <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                      ({historyData?.pagination.total || 0} entrées)
                    </span>
                  </h3>
                </div>
                {(!historyData?.history || historyData.history.length === 0) ? (
                  <p className={styles.emptyText} style={{ textAlign: 'center', padding: 40 }}>Aucun visionnage sur cette période</p>
                ) : (
                  <>
                    <div>
                      {historyData.history.map((entry) => (
                        <div key={entry.id} className={styles.historyEntry}>
                          <div className={styles.historyPoster}>
                            {entry.posterUrl && !entry.posterUrl.includes('placeholder') ? (
                              <Image src={entry.posterUrl} alt={entry.title} fill sizes="45px" style={{ objectFit: 'cover' }} unoptimized />
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)' }}><Film size={16} /></div>
                            )}
                          </div>
                          <div className={styles.historyContent}>
                            <div className={styles.historyTitle}>
                              <span>
                                {entry.title} {entry.year && <span className={styles.historyYear}>({entry.year})</span>}
                              </span>
                              {entry.completed && <span className={styles.historyBadge}>Terminé</span>}
                            </div>
                            <div className={styles.historyMeta}>
                              <span className={styles.historyUser}>{entry.userName}</span>
                              {entry.watchDuration && (
                                <span> • {formatDuration(Math.round(entry.watchDuration / 60))} regardés</span>
                              )}
                            </div>
                          </div>
                          <div className={styles.historyDate}>
                            <div>
                              {new Date(entry.watchedAt).toLocaleDateString('fr-FR', { 
                                day: 'numeric', 
                                month: 'short',
                                year: new Date(entry.watchedAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                              })}
                            </div>
                            <div>
                              {new Date(entry.watchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {historyData.pagination.totalPages > 1 && (
                      <div className={styles.pagination}>
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className={styles.paginationBtn}
                        >
                          Précédent
                        </button>
                        <span className={styles.paginationInfo}>
                          Page {currentPage} / {historyData.pagination.totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(historyData.pagination.totalPages, p + 1))}
                          disabled={currentPage === historyData.pagination.totalPages}
                          className={styles.paginationBtn}
                        >
                          Suivant
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
