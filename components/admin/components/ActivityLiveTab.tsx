import Image from 'next/image'
import { Activity, Users, Eye, Clock, Film } from 'lucide-react'
import styles from '@/app/admin/admin.module.css'
import { formatRelativeTime } from '@/components/admin/utils/activityFormatters'
import type { ActiveSession, ActivityStats } from '@/types/admin'

// ============================================
// TYPES
// ============================================

interface ActivityLiveTabProps {
  activeSessions: ActiveSession[]
  recentSessions: ActiveSession[]
  stats: ActivityStats | undefined
}

// ============================================
// COMPONENT
// ============================================

/**
 * Onglet "En direct" : KPIs temps réel, sessions actives et sessions récentes en pause.
 */
export function ActivityLiveTab({ activeSessions, recentSessions, stats }: ActivityLiveTabProps) {
  return (
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
            <span className={styles.kpiValue}>{stats?.uniqueViewers || 0}</span>
            <span className={styles.kpiLabel}>Spectateurs (24h)</span>
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.purple}`}><Eye size={24} /></div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats?.totalWatches || 0}</span>
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
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{formatRelativeTime(session.updatedAt)}</span>
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

      {/* Sessions récentes en pause */}
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
                  <span className={styles.listMeta}>{formatRelativeTime(session.updatedAt)} • {session.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
