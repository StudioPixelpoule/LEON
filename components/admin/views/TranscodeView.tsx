'use client'

import { useState } from 'react'
import { 
  RefreshCw, 
  Search, 
  Play, 
  Pause, 
  Square, 
  Eye,
  Check,
  Trash2
} from 'lucide-react'
import { useAdminToast } from '@/components/admin/Toast/Toast'
import { useTranscodeQueue } from '@/components/admin/hooks/useTranscodeQueue'
import { useTranscodeActions } from '@/components/admin/hooks/useTranscodeActions'
import { TranscodeStatsCard, ActiveJobsDisplay } from '@/components/admin/components/TranscodeStats'
import { TranscodeQueueList } from '@/components/admin/components/TranscodeQueueList'
import { formatDate } from '@/components/admin/utils/formatters'
import type { TranscodeJob } from '@/components/admin/hooks/useTranscodeQueue'
import styles from '@/app/admin/admin.module.css'

export function TranscodeView() {
  const { addToast } = useAdminToast()
  const [showTranscoded, setShowTranscoded] = useState(false)

  // Données et polling
  const {
    stats,
    queue,
    transcoded,
    watcher,
    loading,
    isModifying,
    setQueue,
    setIsModifying,
    modifyTimeoutRef,
    loadStats,
  } = useTranscodeQueue()

  // Actions
  const {
    actionLoading,
    performAction,
    deleteTranscoded,
    moveJobToTop,
    removeFromQueue,
    cleanupDuplicates,
    moveJobToPosition,
    moveJobBy,
  } = useTranscodeActions({
    queue,
    setQueue,
    setIsModifying,
    modifyTimeoutRef,
    loadStats,
    isModifying,
  })

  // Gestion du drag-and-drop reorder (callback depuis TranscodeQueueList)
  async function handleReorder(newQueue: TranscodeJob[]) {
    setIsModifying(true)
    if (modifyTimeoutRef.current) clearTimeout(modifyTimeoutRef.current)

    setQueue(newQueue)

    const newOrder = newQueue.map(j => j.id)
    try {
      await fetch('/api/admin/transcode-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', jobIds: newOrder }),
        credentials: 'include'
      })
      addToast('success', 'Ordre modifié')
    } catch (error) {
      console.error('[TRANSCODE] Erreur reorder:', error)
      addToast('error', 'Erreur', 'Réorganisation échouée')
      await loadStats(true)
    }

    modifyTimeoutRef.current = setTimeout(() => {
      setIsModifying(false)
      loadStats(true)
    }, 2000)
  }

  // ── Loading ──

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

  // ── Rendu principal ──

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.sectionTitle}>Pré-transcodage</h1>
          <p className={styles.sectionDesc}>
            Transcoder les films à l&apos;avance pour un seek instantané
          </p>
        </div>
      </div>

      {/* Status */}
      <div className={styles.systemStatus}>
        <div className={styles.statusItem}>
          <span className={`${styles.statusDot} ${stats?.isRunning && !stats?.isPaused ? styles.active : ''}`} />
          <span>Transcodage: {stats?.isRunning ? (stats?.isPaused ? 'Pause' : 'Actif') : 'Arrêté'}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={`${styles.statusDot} ${watcher?.isWatching ? styles.active : ''}`} />
          <span>Watcher: {watcher?.isWatching ? 'Actif' : 'Inactif'}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={`${styles.statusDot} ${stats?.autoStartEnabled ? styles.active : ''}`} />
          <span>Auto-reprise: {stats?.autoStartEnabled ? 'Oui' : 'Non'}</span>
        </div>
      </div>

      {/* Info watcher */}
      {watcher?.isWatching && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.08)',
          borderLeft: '3px solid #22c55e',
          padding: '10px 14px',
          marginBottom: 16,
          fontSize: 13,
          color: 'rgba(255,255,255,0.7)'
        }}>
          <strong style={{ color: '#22c55e' }}>File Watcher actif</strong> — Les nouveaux fichiers sont automatiquement détectés et ajoutés à la queue de transcodage.
        </div>
      )}

      {/* Stats */}
      <TranscodeStatsCard stats={stats} transcodedCount={transcoded.length} />

      {/* Jobs en cours */}
      {stats && <ActiveJobsDisplay stats={stats} />}

      {/* Actions */}
      <div className={styles.card}>
        <div className={styles.actions}>
          {!stats?.isRunning ? (
            <>
              <button className={styles.btnSecondary} onClick={() => performAction('scan')} disabled={actionLoading !== null}>
                {actionLoading === 'scan' ? <RefreshCw size={16} className={styles.spin} /> : <Search size={16} />}
                Scanner
              </button>
              <button className={styles.btnPrimary} onClick={() => performAction('start')} disabled={actionLoading !== null || !stats?.pendingFiles}>
                {actionLoading === 'start' ? <RefreshCw size={16} className={styles.spin} /> : <Play size={16} />}
                Démarrer
              </button>
            </>
          ) : (
            <>
              {stats?.isPaused ? (
                <button className={styles.btnPrimary} onClick={() => performAction('resume')} disabled={actionLoading !== null}>
                  {actionLoading === 'resume' ? <RefreshCw size={16} className={styles.spin} /> : <Play size={16} />}
                  Reprendre
                </button>
              ) : (
                <button className={styles.btnSecondary} onClick={() => performAction('pause')} disabled={actionLoading !== null}>
                  {actionLoading === 'pause' ? <RefreshCw size={16} className={styles.spin} /> : <Pause size={16} />}
                  Pause
                </button>
              )}
              <button className={styles.btnDanger} onClick={() => confirm('Arrêter ?') && performAction('stop')} disabled={actionLoading !== null}>
                {actionLoading === 'stop' ? <RefreshCw size={16} className={styles.spin} /> : <Square size={16} />}
                Arrêter
              </button>
            </>
          )}
          <button 
            className={styles.btnSecondary} 
            onClick={() => performAction(watcher?.isWatching ? 'stop-watcher' : 'start-watcher')}
            disabled={actionLoading !== null}
          >
            <Eye size={16} />
            {watcher?.isWatching ? 'Désactiver watcher' : 'Activer watcher'}
          </button>
        </div>
      </div>

      {/* Queue */}
      <TranscodeQueueList
        queue={queue}
        isModifying={isModifying}
        onMoveToTop={moveJobToTop}
        onRemove={removeFromQueue}
        onCleanupDuplicates={cleanupDuplicates}
        onMoveToPosition={moveJobToPosition}
        onMoveBy={moveJobBy}
        onReorder={handleReorder}
      />

      {/* Transcodés */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}><Check size={20} /></div>
          <h3 className={styles.cardTitle}>Transcodés ({transcoded.length})</h3>
          <button className={`${styles.btnSecondary} ${styles.btnSmall}`} onClick={() => setShowTranscoded(!showTranscoded)}>
            {showTranscoded ? 'Masquer' : 'Afficher'}
          </button>
        </div>
        {showTranscoded && transcoded.length > 0 && (
          <div className={styles.list} style={{ maxHeight: 400, overflowY: 'auto' }}>
            {transcoded.map((film) => (
              <div key={film.folder} className={styles.listItem}>
                <div className={styles.listContent}>
                  <span className={styles.listTitle}>{film.name}</span>
                  <span className={styles.listMeta}>
                    {film.segmentCount} seg • {formatDate(film.transcodedAt)}
                    <span style={{ marginLeft: 8 }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: (film.audioCount || 1) > 1 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)', color: (film.audioCount || 1) > 1 ? '#22c55e' : 'rgba(255,255,255,0.5)', marginRight: 4 }}>
                        🔊 {film.audioCount || 1}
                      </span>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: (film.subtitleCount || 0) > 0 ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.1)', color: (film.subtitleCount || 0) > 0 ? '#3b82f6' : 'rgba(255,255,255,0.5)' }}>
                        📝 {film.subtitleCount || 0}
                      </span>
                    </span>
                  </span>
                </div>
                <button onClick={() => deleteTranscoded(film.folder, film.name)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 8 }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        {transcoded.length === 0 && <p className={styles.emptyText}>Aucun film transcodé</p>}
      </div>
    </div>
  )
}
