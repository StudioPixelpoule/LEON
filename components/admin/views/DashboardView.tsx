'use client'

import { useState } from 'react'
import {
  RefreshCw,
  Film,
  Tv,
  Check,
  HardDrive,
  Search,
  Play,
  Pause,
  Image as ImageIcon,
  Activity,
  ChevronRight
} from 'lucide-react'
import type { AdminView, SystemStatus, DashboardStats } from '@/types/admin'
import styles from '@/app/admin/admin.module.css'

interface DashboardViewProps {
  status: SystemStatus
  stats: DashboardStats | null
  loading: boolean
  onNavigate: (view: AdminView) => void
  onRefresh: () => void
}

export function DashboardView({ status, stats, loading, onNavigate, onRefresh }: DashboardViewProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Actions rapides
  async function quickScan() {
    setActionLoading('scan')
    try {
      // Lancer les scans en mode background pour éviter les timeouts Cloudflare
      await Promise.all([
        fetch('/api/scan', { method: 'POST' }),
        fetch('/api/scan-series?background=true', { method: 'POST' })
      ])
      onRefresh()
    } catch (error) {
      console.error('Erreur scan:', error)
    } finally {
      setActionLoading(null)
    }
  }

  async function toggleTranscoding() {
    setActionLoading('transcode')
    try {
      const action = status.transcodingActive ? 'stop' : 'start'
      await fetch('/api/transcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        credentials: 'include'
      })
      onRefresh()
    } catch (error) {
      console.error('Erreur transcodage:', error)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loading}>
          <RefreshCw size={32} className={styles.spin} />
          <p className={styles.loadingText}>Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.dashboardHeader}>
        <h1 className={styles.dashboardTitle}>Tableau de bord</h1>
        <p className={styles.dashboardSubtitle}>
          Vue d&apos;ensemble de votre médiathèque LEON
        </p>
        <div className={styles.versionBadge}>
          <span className={styles.versionCommit}>
            {process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) || 'dev'}
          </span>
          <span className={styles.versionDate}>
            {process.env.NEXT_PUBLIC_BUILD_DATE 
              ? new Date(process.env.NEXT_PUBLIC_BUILD_DATE).toLocaleDateString('fr-FR', { 
                  day: '2-digit', 
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'local'}
          </span>
        </div>
      </div>

      {/* Statut système */}
      <div className={styles.systemStatus}>
        <div className={styles.statusItem}>
          <span className={`${styles.statusDot} ${status.transcodingActive ? styles.active : ''}`} />
          <span>Transcodage {status.transcodingActive ? 'actif' : 'arrêté'}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={`${styles.statusDot} ${status.watcherActive ? styles.active : ''}`} />
          <span>Watcher {status.watcherActive ? 'actif' : 'inactif'}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={`${styles.statusDot} ${status.autoStartEnabled ? styles.active : ''}`} />
          <span>Auto-reprise {status.autoStartEnabled ? 'activée' : 'désactivée'}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.green}`}>
            <Film size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats?.films || 0}</span>
            <span className={styles.kpiLabel}>Films</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.blue}`}>
            <Tv size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats?.series || 0}</span>
            <span className={styles.kpiLabel}>Séries</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.purple}`}>
            <Check size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats?.transcodedPercent || 0}%</span>
            <span className={styles.kpiLabel}>Transcodés</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.orange}`}>
            <HardDrive size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats?.storageGB || 0} GB</span>
            <span className={styles.kpiLabel}>Stockage</span>
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div className={styles.quickActions}>
        <button 
          className={styles.quickAction}
          onClick={quickScan}
          disabled={actionLoading !== null}
        >
          <div className={styles.quickActionIcon}>
            {actionLoading === 'scan' ? (
              <RefreshCw size={20} className={styles.spin} />
            ) : (
              <Search size={20} />
            )}
          </div>
          <div className={styles.quickActionContent}>
            <p className={styles.quickActionTitle}>Scanner les médias</p>
            <p className={styles.quickActionDesc}>Détecter les nouveaux films et séries</p>
          </div>
          <ChevronRight size={20} className={styles.quickActionArrow} />
        </button>

        <button 
          className={styles.quickAction}
          onClick={toggleTranscoding}
          disabled={actionLoading !== null}
        >
          <div className={styles.quickActionIcon}>
            {actionLoading === 'transcode' ? (
              <RefreshCw size={20} className={styles.spin} />
            ) : status.transcodingActive ? (
              <Pause size={20} />
            ) : (
              <Play size={20} />
            )}
          </div>
          <div className={styles.quickActionContent}>
            <p className={styles.quickActionTitle}>
              {status.transcodingActive ? 'Arrêter le transcodage' : 'Lancer le transcodage'}
            </p>
            <p className={styles.quickActionDesc}>
              {stats?.queueSize || 0} films en attente
            </p>
          </div>
          <ChevronRight size={20} className={styles.quickActionArrow} />
        </button>

        <button 
          className={styles.quickAction}
          onClick={() => onNavigate('posters')}
        >
          <div className={styles.quickActionIcon}>
            <ImageIcon size={20} />
          </div>
          <div className={styles.quickActionContent}>
            <p className={styles.quickActionTitle}>Valider les affiches</p>
            <p className={styles.quickActionDesc}>
              {stats?.postersToValidate || 0} affiches à valider
            </p>
          </div>
          <ChevronRight size={20} className={styles.quickActionArrow} />
        </button>

        <button 
          className={styles.quickAction}
          onClick={() => onNavigate('activity')}
        >
          <div className={styles.quickActionIcon}>
            <Activity size={20} />
          </div>
          <div className={styles.quickActionContent}>
            <p className={styles.quickActionTitle}>Activité</p>
            <p className={styles.quickActionDesc}>
              {stats?.activeViewers || 0} spectateur{(stats?.activeViewers || 0) > 1 ? 's' : ''} actif{(stats?.activeViewers || 0) > 1 ? 's' : ''}
            </p>
          </div>
          <ChevronRight size={20} className={styles.quickActionArrow} />
        </button>
      </div>

      {/* Info transcodage si en cours */}
      {status.transcodingActive && stats && stats.queueSize > 0 && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>
              <Activity size={20} />
            </div>
            <h3 className={styles.cardTitle}>Transcodage en cours</h3>
            <span className={styles.cardBadge}>{stats.queueSize} en attente</span>
          </div>
          <div className={styles.progressContainer}>
            <div className={styles.progressLabel}>
              <span>{stats.transcoded} / {stats.films} films</span>
              <span>{stats.transcodedPercent}%</span>
            </div>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${stats.transcodedPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
