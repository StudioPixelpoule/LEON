'use client'

import { useState, useRef, useCallback } from 'react'
import {
  RefreshCw,
  Activity,
  Users,
  Clock,
  Eye,
  AlertCircle
} from 'lucide-react'
import styles from '@/app/admin/admin.module.css'
import { useActivityLive } from '@/components/admin/hooks/useActivityLive'
import { useActivityHistory } from '@/components/admin/hooks/useActivityHistory'
import { ActivityLiveTab } from '@/components/admin/components/ActivityLiveTab'
import { ActivityHistoryTab } from '@/components/admin/components/ActivityHistoryTab'
import { formatRelativeTime, formatActivityDuration } from '@/components/admin/utils/activityFormatters'

// ============================================
// TYPES
// ============================================

type ActivityTab = 'live' | 'users' | 'history'

// Debounce pour le bouton refresh (éviter double-clic)
const REFRESH_DEBOUNCE_MS = 1000

// ============================================
// COMPONENT
// ============================================

export function ActivityView() {
  const [activeTab, setActiveTab] = useState<ActivityTab>('live')
  const lastRefreshRef = useRef(0)

  const {
    liveData, activeSessions, recentSessions,
    loading: liveLoading, error: liveError, refresh: refreshLive
  } = useActivityLive()

  const {
    historyData, loading: historyInitialLoading, historyLoading,
    error: historyError,
    selectedUser, setSelectedUser, selectedDays, setSelectedDays,
    currentPage, setCurrentPage, refresh: refreshHistory
  } = useActivityHistory()

  // Refresh avec debounce
  const handleRefresh = useCallback(() => {
    const now = Date.now()
    if (now - lastRefreshRef.current < REFRESH_DEBOUNCE_MS) return
    lastRefreshRef.current = now

    refreshLive()
    if (activeTab !== 'live') refreshHistory()
  }, [refreshLive, refreshHistory, activeTab])

  // Erreur globale (combinaison des erreurs des deux hooks)
  const globalError = liveError || historyError

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.sectionTitle}>Activité</h1>
          <p className={styles.sectionDesc}>Suivi en temps réel et historique des visionnages</p>
        </div>
        <button className={styles.btnIcon} onClick={handleRefresh}>
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Message d'erreur global */}
      {globalError && (
        <div className={styles.errorBanner} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px', marginBottom: 16,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 8, color: '#ef4444', fontSize: 14
        }}>
          <AlertCircle size={16} />
          <span>Erreur de chargement : {globalError}</span>
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

      {/* Onglet En direct — chargement indépendant */}
      {activeTab === 'live' && (
        <>
          {liveLoading ? (
            <div className={styles.loading} style={{ padding: 60 }}>
              <RefreshCw size={24} className={styles.spin} />
              <p className={styles.loadingText}>Chargement en direct...</p>
            </div>
          ) : (
            <ActivityLiveTab
              activeSessions={activeSessions}
              recentSessions={recentSessions}
              stats={liveData?.stats}
            />
          )}
        </>
      )}

      {/* Onglet Utilisateurs — chargement indépendant */}
      {activeTab === 'users' && (
        <>
          {historyInitialLoading ? (
            <div className={styles.loading} style={{ padding: 60 }}>
              <RefreshCw size={24} className={styles.spin} />
              <p className={styles.loadingText}>Chargement des statistiques...</p>
            </div>
          ) : historyLoading ? (
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
                      {formatActivityDuration(historyData?.userStats.reduce((acc, u) => acc + u.totalWatchTimeMinutes, 0) || 0)}
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
                            <span><strong style={{ color: '#a855f7' }}>{formatActivityDuration(user.totalWatchTimeMinutes)}</strong> regardés</span>
                          </div>
                        </div>
                        <div className={styles.userLastActivity}>
                          Dernière activité<br />
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{formatRelativeTime(user.lastActivity)}</span>
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
        <ActivityHistoryTab
          historyData={historyData}
          historyLoading={historyLoading}
          selectedUser={selectedUser}
          setSelectedUser={setSelectedUser}
          selectedDays={selectedDays}
          setSelectedDays={setSelectedDays}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
        />
      )}
    </div>
  )
}
