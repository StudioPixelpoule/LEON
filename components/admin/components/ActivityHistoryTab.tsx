import type { Dispatch, SetStateAction } from 'react'
import Image from 'next/image'
import { RefreshCw, Clock, Film, Filter } from 'lucide-react'
import styles from '@/app/admin/admin.module.css'
import { formatActivityDuration, formatWatchDate } from '@/components/admin/utils/activityFormatters'
import type { HistoryData } from '@/types/admin'

// ============================================
// TYPES
// ============================================

interface ActivityHistoryTabProps {
  historyData: HistoryData | null
  historyLoading: boolean
  selectedUser: string
  setSelectedUser: (user: string) => void
  selectedDays: number
  setSelectedDays: (days: number) => void
  currentPage: number
  setCurrentPage: Dispatch<SetStateAction<number>>
}

// ============================================
// COMPONENT
// ============================================

/**
 * Onglet "Historique" : filtres par utilisateur/période, liste des visionnages et pagination.
 */
export function ActivityHistoryTab({
  historyData,
  historyLoading,
  selectedUser,
  setSelectedUser,
  selectedDays,
  setSelectedDays,
  currentPage,
  setCurrentPage
}: ActivityHistoryTabProps) {
  return (
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
                {historyData.history.map((entry) => {
                  const watchDate = formatWatchDate(entry.watchedAt)
                  return (
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
                            <span> • {formatActivityDuration(Math.round(entry.watchDuration / 60))} regardés</span>
                          )}
                        </div>
                      </div>
                      <div className={styles.historyDate}>
                        <div>{watchDate.date}</div>
                        <div>{watchDate.time}</div>
                      </div>
                    </div>
                  )
                })}
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
      )}
    </>
  )
}
