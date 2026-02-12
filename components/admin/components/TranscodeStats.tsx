'use client'

import { BarChart3, Film } from 'lucide-react'
import { formatTime } from '@/components/admin/utils/formatters'
import type { TranscodeStats as TranscodeStatsType, TranscodedFile } from '@/components/admin/hooks/useTranscodeQueue'
import styles from '@/app/admin/admin.module.css'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TranscodeStatsProps {
  stats: TranscodeStatsType | null
  transcodedCount: number
}

interface ActiveJobsDisplayProps {
  stats: TranscodeStatsType
}

// ─── Composants ──────────────────────────────────────────────────────────────

/**
 * Affiche les jobs de transcodage en cours (multi-transcodage).
 */
export function ActiveJobsDisplay({ stats }: ActiveJobsDisplayProps) {
  // Support multi-transcodage
  if (stats.activeJobs && stats.activeJobs.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
          🔄 {stats.activeCount || stats.activeJobs.length}/{stats.maxConcurrent || 2} transcodes actifs
        </div>
        {stats.activeJobs.map((job) => (
          <div key={job.id} className={styles.currentJob}>
            <div className={styles.jobHeader}>
              <Film size={20} className={styles.jobIcon} />
              <div>
                <p className={styles.jobTitle}>{job.filename}</p>
                <p className={styles.jobMeta}>
                  {job.speed && `${job.speed.toFixed(1)}x`}
                  {job.currentTime && job.estimatedDuration && (
                    <> • {formatTime(job.currentTime)} / {formatTime(job.estimatedDuration)}</>
                  )}
                </p>
              </div>
            </div>
            <div className={styles.jobProgress}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${job.progress}%` }} />
              </div>
              <span className={styles.jobPercent}>{Math.round(job.progress)}%</span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Fallback pour ancien format (1 seul job)
  if (stats.currentJob && !stats.activeJobs) {
    return (
      <div className={styles.currentJob}>
        <div className={styles.jobHeader}>
          <Film size={20} className={styles.jobIcon} />
          <div>
            <p className={styles.jobTitle}>{stats.currentJob.filename}</p>
            <p className={styles.jobMeta}>
              {stats.currentJob.speed && `${stats.currentJob.speed.toFixed(1)}x`}
              {stats.currentJob.currentTime && stats.currentJob.estimatedDuration && (
                <> • {formatTime(stats.currentJob.currentTime)} / {formatTime(stats.currentJob.estimatedDuration)}</>
              )}
            </p>
          </div>
        </div>
        <div className={styles.jobProgress}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${stats.currentJob.progress}%` }} />
          </div>
          <span className={styles.jobPercent}>{Math.round(stats.currentJob.progress)}%</span>
        </div>
      </div>
    )
  }

  return null
}

/**
 * Affiche les statistiques de progression globale du transcodage.
 */
export function TranscodeStatsCard({ stats, transcodedCount }: TranscodeStatsProps) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}><BarChart3 size={20} /></div>
        <h3 className={styles.cardTitle}>Progression globale</h3>
        <span className={styles.cardBadge}>{stats?.diskUsage || 'N/A'}</span>
      </div>
      <div className={styles.statsGrid}>
        <div className={styles.statBox}>
          <div className={styles.statValue}>{transcodedCount || stats?.completedFiles || 0}</div>
          <div className={styles.statLabel}>Transcodés</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statValue}>{stats?.pendingFiles || 0}</div>
          <div className={styles.statLabel}>En attente</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statValue}>{stats?.failedFiles || 0}</div>
          <div className={styles.statLabel}>Échecs</div>
        </div>
      </div>
      {stats && stats.totalFiles > 0 && (
        <div className={styles.progressContainer}>
          <div className={styles.progressLabel}>
            <span>{stats.completedFiles} / {stats.totalFiles} films</span>
            <span>{Math.round((stats.completedFiles / stats.totalFiles) * 100)}%</span>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${(stats.completedFiles / stats.totalFiles) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
