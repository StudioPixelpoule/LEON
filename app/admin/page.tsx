/**
 * LEON Admin v2 - Interface d'administration repensée
 * Architecture: Dashboard central + sections détaillées
 * 
 * Principes:
 * - Vue d'ensemble en un coup d'œil
 * - Actions rapides accessibles
 * - Sections détaillées au besoin
 * - Design épuré et fonctionnel
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Header from '@/components/Header/Header'
import { 
  LayoutDashboard, 
  FolderSearch, 
  Image as ImageIcon, 
  Film, 
  BarChart3, 
  Users,
  Search, 
  RefreshCw, 
  Trash2, 
  Check, 
  X, 
  Play, 
  Pause, 
  Square, 
  Eye,
  HardDrive,
  Clock,
  Activity,
  ChevronRight,
  Edit3,
  Filter,
  RotateCcw,
  Tv,
  Upload,
  FileVideo,
  AlertCircle
} from 'lucide-react'
import styles from './admin.module.css'

// Types
type AdminView = 'dashboard' | 'scan' | 'posters' | 'transcode' | 'stats' | 'activity'

interface SystemStatus {
  transcodingActive: boolean
  watcherActive: boolean
  autoStartEnabled: boolean
}

interface DashboardStats {
  films: number
  series: number
  transcoded: number
  transcodedPercent: number
  postersToValidate: number
  storageGB: number
  queueSize: number
  activeViewers: number
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function AdminPageV2() {
  const [view, setView] = useState<AdminView>('dashboard')
  const [status, setStatus] = useState<SystemStatus>({
    transcodingActive: false,
    watcherActive: false,
    autoStartEnabled: false
  })
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Charger les données initiales
  useEffect(() => {
    loadDashboardData()
    const interval = setInterval(loadDashboardData, 10000)
    return () => clearInterval(interval)
  }, [])

  async function loadDashboardData() {
    try {
      // Charger les stats en parallèle
      const [transcodeRes, statsRes, watchingRes] = await Promise.all([
        fetch('/api/transcode?quick=true'),
        fetch('/api/stats/dashboard'),
        fetch('/api/stats/watching')
      ])

      const transcodeData = await transcodeRes.json()
      const statsData = await statsRes.json()
      const watchingData = await watchingRes.json()

      // Status système
      setStatus({
        transcodingActive: transcodeData.stats?.isRunning && !transcodeData.stats?.isPaused,
        watcherActive: transcodeData.watcher?.isWatching || false,
        autoStartEnabled: transcodeData.stats?.autoStartEnabled || false
      })

      // Stats dashboard
      setDashboardStats({
        films: statsData.library?.totalMovies || 0,
        series: statsData.library?.totalSeries || 0,
        transcoded: transcodeData.stats?.completedFiles || 0,
        transcodedPercent: statsData.library?.totalMovies > 0 
          ? Math.round((transcodeData.stats?.completedFiles || 0) / statsData.library.totalMovies * 100)
          : 0,
        postersToValidate: statsData.posters?.withoutPosters || 0,
        storageGB: statsData.storage?.mediaSizeGB || 0,
        queueSize: transcodeData.stats?.pendingFiles || 0,
        activeViewers: watchingData.activeSessions?.filter((s: { isActive: boolean }) => s.isActive).length || 0
      })
    } catch (error) {
      console.error('Erreur chargement dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <Header />
      
      <div className={styles.content}>
        {/* Navigation latérale */}
        <nav className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h1 className={styles.logo}>LEON</h1>
            <p className={styles.logoSub}>Administration</p>
          </div>
          
          <div className={styles.nav}>
            {/* Vue d'ensemble */}
            <div className={styles.navGroup}>
              <p className={styles.navGroupLabel}>Vue d&apos;ensemble</p>
              <button
                className={`${styles.navItem} ${view === 'dashboard' ? styles.active : ''}`}
                onClick={() => setView('dashboard')}
              >
                <LayoutDashboard className={styles.navIcon} size={18} />
                Dashboard
              </button>
            </div>

            {/* Médiathèque */}
            <div className={styles.navGroup}>
              <p className={styles.navGroupLabel}>Médiathèque</p>
              <button
                className={`${styles.navItem} ${view === 'scan' ? styles.active : ''}`}
                onClick={() => setView('scan')}
              >
                <FolderSearch className={styles.navIcon} size={18} />
                Scanner
              </button>
              <button
                className={`${styles.navItem} ${view === 'posters' ? styles.active : ''}`}
                onClick={() => setView('posters')}
              >
                <ImageIcon className={styles.navIcon} size={18} />
                Affiches
                {dashboardStats && dashboardStats.postersToValidate > 0 && (
                  <span className={styles.navBadge}>{dashboardStats.postersToValidate}</span>
                )}
              </button>
            </div>

            {/* Technique */}
            <div className={styles.navGroup}>
              <p className={styles.navGroupLabel}>Performance</p>
              <button
                className={`${styles.navItem} ${view === 'transcode' ? styles.active : ''}`}
                onClick={() => setView('transcode')}
              >
                <Film className={styles.navIcon} size={18} />
                Transcodage
                {dashboardStats && dashboardStats.queueSize > 0 && (
                  <span className={styles.navBadge}>{dashboardStats.queueSize}</span>
                )}
              </button>
            </div>

            {/* Activité */}
            <div className={styles.navGroup}>
              <p className={styles.navGroupLabel}>Activité</p>
              <button
                className={`${styles.navItem} ${view === 'stats' ? styles.active : ''}`}
                onClick={() => setView('stats')}
              >
                <BarChart3 className={styles.navIcon} size={18} />
                Statistiques
              </button>
              <button
                className={`${styles.navItem} ${view === 'activity' ? styles.active : ''}`}
                onClick={() => setView('activity')}
              >
                <Activity className={styles.navIcon} size={18} />
                Activité
                {dashboardStats && dashboardStats.activeViewers > 0 && (
                  <span className={styles.navBadge}>{dashboardStats.activeViewers}</span>
                )}
              </button>
            </div>
          </div>
        </nav>

        {/* Contenu principal */}
        <main className={styles.main}>
          {view === 'dashboard' && (
            <DashboardView 
              status={status} 
              stats={dashboardStats} 
              loading={loading}
              onNavigate={setView}
              onRefresh={loadDashboardData}
            />
          )}
          {view === 'scan' && <ScanView />}
          {view === 'posters' && <PostersView />}
          {view === 'transcode' && <TranscodeView />}
          {view === 'stats' && <StatsView />}
          {view === 'activity' && <ActivityView />}
        </main>
      </div>
    </div>
  )
}

// ============================================
// DASHBOARD
// ============================================

interface DashboardViewProps {
  status: SystemStatus
  stats: DashboardStats | null
  loading: boolean
  onNavigate: (view: AdminView) => void
  onRefresh: () => void
}

function DashboardView({ status, stats, loading, onNavigate, onRefresh }: DashboardViewProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Actions rapides
  async function quickScan() {
    setActionLoading('scan')
    try {
      await Promise.all([
        fetch('/api/scan', { method: 'POST' }),
        fetch('/api/scan-series', { method: 'POST' })
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
        body: JSON.stringify({ action })
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

// ============================================
// SECTION SCAN
// ============================================

function ScanView() {
  const [scanningFilms, setScanningFilms] = useState(false)
  const [scanningSeries, setScanningSeries] = useState(false)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [filmResult, setFilmResult] = useState<{ stats?: { total?: number; new?: number; updated?: number } } | null>(null)
  const [seriesResult, setSeriesResult] = useState<{ stats?: { totalSeries?: number; newSeries?: number; totalEpisodes?: number; newEpisodes?: number } } | null>(null)
  const [cleanupResult, setCleanupResult] = useState<{ result?: { checked?: number; missing?: number; deleted?: number; details?: Array<{ title: string }> } } | null>(null)
  
  // Import
  const [showImport, setShowImport] = useState(false)
  const [importPath, setImportPath] = useState('')
  const [importQuery, setImportQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const [searchingTMDB, setSearchingTMDB] = useState(false)
  const [tmdbResults, setTmdbResults] = useState<Array<{
    id: number
    title: string
    year: number | null
    poster_url: string | null
    overview: string
    vote_average: number
  }>>([])
  const [importResult, setImportResult] = useState<{ success: boolean; message?: string; error?: string; film?: any } | null>(null)
  const [unimportedFiles, setUnimportedFiles] = useState<Array<{ filename: string; filepath: string; cleanName: string; year: number | null }>>([])
  const [loadingUnimported, setLoadingUnimported] = useState(false)

  async function handleScanFilms() {
    setScanningFilms(true)
    setFilmResult(null)
    try {
      const response = await fetch('/api/scan', { method: 'POST' })
      const data = await response.json()
      setFilmResult(data)
    } catch (error) {
      console.error('Erreur scan films:', error)
      alert('Erreur lors du scan des films')
    } finally {
      setScanningFilms(false)
    }
  }

  async function handleScanSeries() {
    setScanningSeries(true)
    setSeriesResult(null)
    try {
      const response = await fetch('/api/scan-series', { method: 'POST' })
      const data = await response.json()
      setSeriesResult(data)
    } catch (error) {
      console.error('Erreur scan séries:', error)
      alert('Erreur lors du scan des séries')
    } finally {
      setScanningSeries(false)
    }
  }

  async function handleCleanup() {
    if (!confirm('Supprimer les médias dont le fichier n\'existe plus sur le disque ?')) return
    
    setCleaningUp(true)
    setCleanupResult(null)
    try {
      const response = await fetch('/api/admin/cleanup-missing', { method: 'POST' })
      const data = await response.json()
      setCleanupResult(data)
    } catch (error) {
      console.error('Erreur nettoyage:', error)
      alert('Erreur lors du nettoyage')
    } finally {
      setCleaningUp(false)
    }
  }

  // Import functions
  async function loadUnimportedFiles() {
    setLoadingUnimported(true)
    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'list-unimported' })
      })
      const data = await response.json()
      if (data.files) {
        setUnimportedFiles(data.files)
      }
    } catch (error) {
      console.error('Erreur chargement fichiers:', error)
    } finally {
      setLoadingUnimported(false)
    }
  }

  async function searchTMDB(query: string) {
    if (!query.trim()) return
    setSearchingTMDB(true)
    setTmdbResults([])
    try {
      const response = await fetch(`/api/import?query=${encodeURIComponent(query)}`)
      const data = await response.json()
      if (data.results) {
        setTmdbResults(data.results)
      }
    } catch (error) {
      console.error('Erreur recherche TMDB:', error)
    } finally {
      setSearchingTMDB(false)
    }
  }

  async function handleImportByPath() {
    if (!importPath.trim()) return
    setImporting(true)
    setImportResult(null)
    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'filepath', filepath: importPath })
      })
      const data = await response.json()
      setImportResult(data)
      if (data.success) {
        setImportPath('')
        loadUnimportedFiles()
      }
    } catch (error) {
      setImportResult({ success: false, error: 'Erreur lors de l\'import' })
    } finally {
      setImporting(false)
    }
  }

  async function handleImportWithTMDB(filepath: string, tmdbId: number) {
    setImporting(true)
    setImportResult(null)
    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'tmdb', filepath, tmdbId })
      })
      const data = await response.json()
      setImportResult(data)
      if (data.success) {
        setTmdbResults([])
        setImportQuery('')
        setImportPath('')
        loadUnimportedFiles()
      }
    } catch (error) {
      setImportResult({ success: false, error: 'Erreur lors de l\'import' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.sectionTitle}>Scanner les médias</h1>
          <p className={styles.sectionDesc}>
            Analyser les dossiers pour détecter les nouveaux films et séries TV
          </p>
        </div>
      </div>

      {/* Scanner Films */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}>
            <Film size={20} />
          </div>
          <h3 className={styles.cardTitle}>Films</h3>
          <span className={styles.cardBadge}>/media/films</span>
        </div>
        
        <div className={styles.actions}>
          <button
            className={styles.btnPrimary}
            onClick={handleScanFilms}
            disabled={scanningFilms}
          >
            {scanningFilms ? (
              <><RefreshCw size={16} className={styles.spin} /> Scan en cours...</>
            ) : (
              <><Search size={16} /> Scanner les films</>
            )}
          </button>
        </div>

        {filmResult && (
          <div className={styles.statsGrid} style={{ marginTop: 20 }}>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{filmResult.stats?.total || 0}</div>
              <div className={styles.statLabel}>Analysés</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{filmResult.stats?.new || 0}</div>
              <div className={styles.statLabel}>Nouveaux</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{filmResult.stats?.updated || 0}</div>
              <div className={styles.statLabel}>Mis à jour</div>
            </div>
          </div>
        )}
      </div>

      {/* Scanner Séries */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}>
            <Tv size={20} />
          </div>
          <h3 className={styles.cardTitle}>Séries TV</h3>
          <span className={styles.cardBadge}>/media/series</span>
        </div>
        
        <div className={styles.actions}>
          <button
            className={styles.btnPrimary}
            onClick={handleScanSeries}
            disabled={scanningSeries}
          >
            {scanningSeries ? (
              <><RefreshCw size={16} className={styles.spin} /> Scan en cours...</>
            ) : (
              <><Search size={16} /> Scanner les séries</>
            )}
          </button>
        </div>

        {seriesResult && (
          <div className={styles.statsGrid} style={{ marginTop: 20 }}>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{seriesResult.stats?.totalSeries || 0}</div>
              <div className={styles.statLabel}>Séries</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{seriesResult.stats?.newSeries || 0}</div>
              <div className={styles.statLabel}>Nouvelles</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{seriesResult.stats?.totalEpisodes || 0}</div>
              <div className={styles.statLabel}>Épisodes</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{seriesResult.stats?.newEpisodes || 0}</div>
              <div className={styles.statLabel}>Nouveaux ép.</div>
            </div>
          </div>
        )}
      </div>

      {/* Nettoyage */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}>
            <Trash2 size={20} />
          </div>
          <h3 className={styles.cardTitle}>Nettoyage</h3>
        </div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px' }}>
          Supprimer de la base les médias dont le fichier n&apos;existe plus
        </p>
        
        <div className={styles.actions}>
          <button
            className={styles.btnDanger}
            onClick={handleCleanup}
            disabled={cleaningUp}
          >
            {cleaningUp ? (
              <><RefreshCw size={16} className={styles.spin} /> Nettoyage...</>
            ) : (
              <><Trash2 size={16} /> Nettoyer les fichiers manquants</>
            )}
          </button>
        </div>

        {cleanupResult && (
          <div className={styles.statsGrid} style={{ marginTop: 20 }}>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{cleanupResult.result?.checked || 0}</div>
              <div className={styles.statLabel}>Vérifiés</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{cleanupResult.result?.missing || 0}</div>
              <div className={styles.statLabel}>Manquants</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{cleanupResult.result?.deleted || 0}</div>
              <div className={styles.statLabel}>Supprimés</div>
            </div>
          </div>
        )}
      </div>

      {/* Import manuel */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}>
            <Upload size={20} />
          </div>
          <h3 className={styles.cardTitle}>Import manuel</h3>
          <button 
            className={styles.btnSecondary}
            onClick={() => {
              setShowImport(!showImport)
              if (!showImport) loadUnimportedFiles()
            }}
            style={{ marginLeft: 'auto' }}
          >
            {showImport ? 'Fermer' : 'Ouvrir'}
          </button>
        </div>
        
        {showImport && (
          <div style={{ marginTop: 16 }}>
            {/* Message résultat */}
            {importResult && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 8,
                marginBottom: 16,
                background: importResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${importResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                {importResult.success ? (
                  <Check size={18} style={{ color: '#10b981' }} />
                ) : (
                  <AlertCircle size={18} style={{ color: '#ef4444' }} />
                )}
                <span style={{ fontSize: 14 }}>
                  {importResult.success 
                    ? `✅ ${importResult.film?.title} importé avec succès`
                    : importResult.error
                  }
                </span>
              </div>
            )}

            {/* Import par chemin */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                Chemin du fichier (relatif ou absolu)
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={importPath}
                  onChange={(e) => setImportPath(e.target.value)}
                  placeholder="/leon/media/films/MonFilm.mkv"
                  className={styles.input}
                  style={{ flex: 1 }}
                />
                <button
                  className={styles.btnPrimary}
                  onClick={handleImportByPath}
                  disabled={importing || !importPath.trim()}
                >
                  {importing ? <RefreshCw size={16} className={styles.spin} /> : <Upload size={16} />}
                  Importer
                </button>
              </div>
            </div>

            {/* Recherche TMDB pour association manuelle */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                Rechercher sur TMDB (pour forcer une correspondance)
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={importQuery}
                  onChange={(e) => setImportQuery(e.target.value)}
                  placeholder="Nom du film..."
                  className={styles.input}
                  style={{ flex: 1 }}
                  onKeyDown={(e) => e.key === 'Enter' && searchTMDB(importQuery)}
                />
                <button
                  className={styles.btnSecondary}
                  onClick={() => searchTMDB(importQuery)}
                  disabled={searchingTMDB || !importQuery.trim()}
                >
                  {searchingTMDB ? <RefreshCw size={16} className={styles.spin} /> : <Search size={16} />}
                  Rechercher
                </button>
              </div>
            </div>

            {/* Résultats TMDB */}
            {tmdbResults.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
                  Sélectionnez un film puis cliquez sur &quot;Associer&quot; :
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {tmdbResults.map((movie) => (
                    <div 
                      key={movie.id}
                      style={{
                        display: 'flex',
                        gap: 12,
                        padding: 12,
                        background: '#1a1a1a',
                        borderRadius: 8,
                        alignItems: 'center'
                      }}
                    >
                      {movie.poster_url ? (
                        <Image 
                          src={movie.poster_url} 
                          alt={movie.title}
                          width={40}
                          height={60}
                          style={{ borderRadius: 4, objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: 40, height: 60, background: '#2a2a2a', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Film size={16} style={{ opacity: 0.3 }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 500, fontSize: 14 }}>{movie.title}</p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                          {movie.year || 'Date inconnue'} • ⭐ {movie.vote_average?.toFixed(1)}
                        </p>
                      </div>
                      <button
                        className={styles.btnPrimary}
                        onClick={() => {
                          if (importPath.trim()) {
                            handleImportWithTMDB(importPath, movie.id)
                          } else {
                            alert('Entrez d\'abord le chemin du fichier')
                          }
                        }}
                        disabled={importing || !importPath.trim()}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        Associer
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fichiers non importés */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                  Fichiers non importés ({unimportedFiles.length})
                </p>
                <button
                  className={styles.btnSecondary}
                  onClick={loadUnimportedFiles}
                  disabled={loadingUnimported}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  {loadingUnimported ? <RefreshCw size={14} className={styles.spin} /> : <RefreshCw size={14} />}
                  Rafraîchir
                </button>
              </div>
              
              {unimportedFiles.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {unimportedFiles.map((file, idx) => (
                    <div 
                      key={idx}
                      style={{
                        display: 'flex',
                        gap: 12,
                        padding: '10px 12px',
                        background: '#141414',
                        borderRadius: 6,
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                      onClick={() => setImportPath(file.filepath)}
                    >
                      <FileVideo size={16} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {file.cleanName}
                          {file.year && <span style={{ color: 'rgba(255,255,255,0.5)' }}> ({file.year})</span>}
                        </p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {file.filename}
                        </p>
                      </div>
                      <button
                        className={styles.btnSecondary}
                        onClick={(e) => {
                          e.stopPropagation()
                          setImportPath(file.filepath)
                          handleImportByPath()
                        }}
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        Import auto
                      </button>
                    </div>
                  ))}
                </div>
              ) : loadingUnimported ? (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 20 }}>
                  Chargement...
                </p>
              ) : (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 20 }}>
                  ✅ Tous les fichiers sont importés
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// SECTION AFFICHES (simplifiée - réutilise la logique existante)
// ============================================

interface MediaToValidate {
  id: string
  title: string
  year?: number
  poster_url?: string
  tmdb_id?: number
  file_path: string
}

interface SeriesData {
  id: string
  title: string
  poster_url?: string
  tmdb_id?: number
  first_air_date?: string
  seasons?: { season: number; episodeCount: number }[]
}

interface TMDBResult {
  id: number
  title: string
  name?: string
  release_date: string
  first_air_date?: string
  poster_path: string
  overview: string
  vote_average: number
}

type MediaTab = 'films' | 'series'
type PosterFilter = 'all' | 'to-validate'

function PostersView() {
  const [mediaTab, setMediaTab] = useState<MediaTab>('films')
  const [posterFilter, setPosterFilter] = useState<PosterFilter>('to-validate')
  const [searchFilter, setSearchFilter] = useState('')
  const [loading, setLoading] = useState(true)
  
  // Films
  const [allMovies, setAllMovies] = useState<MediaToValidate[]>([])
  const [filteredMovies, setFilteredMovies] = useState<MediaToValidate[]>([])
  
  // Séries
  const [allSeries, setAllSeries] = useState<SeriesData[]>([])
  const [filteredSeries, setFilteredSeries] = useState<SeriesData[]>([])
  
  // Modal
  const [selectedMovie, setSelectedMovie] = useState<MediaToValidate | null>(null)
  const [selectedSeries, setSelectedSeries] = useState<SeriesData | null>(null)
  const [suggestions, setSuggestions] = useState<TMDBResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadMovies()
    loadSeries()
  }, [])

  // Filtrage films
  useEffect(() => {
    let movies = allMovies
    if (posterFilter === 'to-validate') {
      movies = movies.filter(m => !m.poster_url || m.poster_url.includes('placeholder') || !m.tmdb_id)
    }
    if (searchFilter.trim()) {
      movies = movies.filter(m => m.title.toLowerCase().includes(searchFilter.toLowerCase()))
    }
    setFilteredMovies(movies)
  }, [searchFilter, allMovies, posterFilter])

  // Filtrage séries
  useEffect(() => {
    let series = allSeries
    if (posterFilter === 'to-validate') {
      series = series.filter(s => !s.poster_url || s.poster_url.includes('placeholder') || !s.tmdb_id)
    }
    if (searchFilter.trim()) {
      series = series.filter(s => s.title.toLowerCase().includes(searchFilter.toLowerCase()))
    }
    setFilteredSeries(series)
  }, [searchFilter, allSeries, posterFilter])

  async function loadMovies() {
    try {
      const response = await fetch('/api/media/grouped?type=movie')
      const data = await response.json()
      if (data.success) {
        setAllMovies(data.media.sort((a: MediaToValidate, b: MediaToValidate) => a.title.localeCompare(b.title)))
      }
    } catch (error) {
      console.error('Erreur chargement films:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadSeries() {
    try {
      const response = await fetch('/api/series/list')
      const data = await response.json()
      if (data.success) {
        setAllSeries((data.series || []).sort((a: SeriesData, b: SeriesData) => a.title.localeCompare(b.title)))
      }
    } catch (error) {
      console.error('Erreur chargement séries:', error)
    }
  }

  async function searchTMDB(type: 'movie' | 'tv' = 'movie') {
    setSearching(true)
    try {
      const query = searchQuery || (type === 'movie' ? selectedMovie?.title : selectedSeries?.title)
      const response = await fetch(`/api/admin/search-tmdb?query=${encodeURIComponent(query || '')}&type=${type}`)
      const data = await response.json()
      if (data.results) {
        setSuggestions(data.results.slice(0, 8))
      }
    } catch (error) {
      console.error('Erreur recherche TMDB:', error)
    } finally {
      setSearching(false)
    }
  }

  async function updatePoster(tmdbId: number, type: 'movie' | 'series') {
    setSaving(true)
    try {
      const endpoint = type === 'movie' ? '/api/admin/update-metadata' : '/api/admin/update-series-metadata'
      const body = type === 'movie' 
        ? { mediaId: selectedMovie?.id, tmdbId }
        : { seriesId: selectedSeries?.id, tmdbId }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      if (response.ok) {
        closeModal()
        if (type === 'movie') await loadMovies()
        else await loadSeries()
        alert('✅ Affiche mise à jour !')
      } else {
        const data = await response.json()
        alert(`Erreur: ${data.error || 'Erreur inconnue'}`)
      }
    } catch (error) {
      console.error('Erreur mise à jour:', error)
      alert('Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  function closeModal() {
    setSelectedMovie(null)
    setSelectedSeries(null)
    setSuggestions([])
    setSearchQuery('')
  }

  const toValidateMovies = allMovies.filter(m => !m.poster_url || m.poster_url.includes('placeholder') || !m.tmdb_id).length
  const toValidateSeries = allSeries.filter(s => !s.poster_url || s.poster_url.includes('placeholder') || !s.tmdb_id).length

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

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.sectionTitle}>Gestion des affiches</h1>
          <p className={styles.sectionDesc}>
            Valider ou modifier les affiches de vos médias
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${mediaTab === 'films' ? styles.active : ''}`}
          onClick={() => setMediaTab('films')}
        >
          <Film size={16} />
          Films ({allMovies.length})
          {toValidateMovies > 0 && <span className={styles.tabBadge}>{toValidateMovies}</span>}
        </button>
        <button
          className={`${styles.tab} ${mediaTab === 'series' ? styles.active : ''}`}
          onClick={() => setMediaTab('series')}
        >
          <Tv size={16} />
          Séries ({allSeries.length})
          {toValidateSeries > 0 && <span className={styles.tabBadge}>{toValidateSeries}</span>}
        </button>
      </div>

      {/* Filtres */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <button
            className={`${styles.filterBtn} ${posterFilter === 'to-validate' ? styles.active : ''}`}
            onClick={() => setPosterFilter('to-validate')}
          >
            <X size={14} />
            À valider ({mediaTab === 'films' ? toValidateMovies : toValidateSeries})
          </button>
          <button
            className={`${styles.filterBtn} ${posterFilter === 'all' ? styles.active : ''}`}
            onClick={() => setPosterFilter('all')}
          >
            <Filter size={14} />
            Tous
          </button>
        </div>
        
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder={mediaTab === 'films' ? "Rechercher un film..." : "Rechercher une série..."}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className={styles.searchInput}
          />
          {searchFilter && (
            <button onClick={() => setSearchFilter('')} className={styles.searchClear}>
              <X size={14} />
            </button>
          )}
        </div>
        
        <span className={styles.filterCount}>
          {mediaTab === 'films' ? `${filteredMovies.length} film${filteredMovies.length > 1 ? 's' : ''}` : `${filteredSeries.length} série${filteredSeries.length > 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Message si rien à valider */}
      {posterFilter === 'to-validate' && (
        (mediaTab === 'films' && filteredMovies.length === 0) ||
        (mediaTab === 'series' && filteredSeries.length === 0)
      ) && (
        <div className={styles.success}>
          <Check size={48} color="#10b981" />
          <h3 className={styles.successTitle}>
            {mediaTab === 'films' ? 'Tous les films sont validés !' : 'Toutes les séries sont validées !'}
          </h3>
          <p className={styles.successText}>
            Aucune affiche n&apos;a besoin de validation.
          </p>
        </div>
      )}

      {/* Grille films */}
      {mediaTab === 'films' && filteredMovies.length > 0 && (
        <div className={styles.mediaGrid}>
          {filteredMovies.map((movie) => {
            const needsValidation = !movie.poster_url || movie.poster_url.includes('placeholder') || !movie.tmdb_id
            return (
              <div 
                key={movie.id}
                className={styles.mediaCard}
                onClick={() => {
                  setSelectedMovie(movie)
                  setSearchQuery(movie.title)
                }}
              >
                <div className={styles.mediaPoster}>
                  {movie.poster_url && !movie.poster_url.includes('placeholder') ? (
                    <Image src={movie.poster_url} alt={movie.title} fill sizes="180px" style={{ objectFit: 'cover' }} unoptimized />
                  ) : (
                    <div className={styles.mediaNoPoster}>
                      <ImageIcon size={32} />
                    </div>
                  )}
                  {needsValidation && <div className={styles.mediaValidationBadge}>À valider</div>}
                </div>
                <div className={styles.mediaInfo}>
                  <h4 className={styles.mediaTitle}>{movie.title}</h4>
                  {movie.year && <p className={styles.mediaYear}>{movie.year}</p>}
                </div>
                <div className={styles.mediaOverlay}>
                  <Edit3 size={24} />
                  <span>{needsValidation ? 'Valider' : 'Modifier'}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Grille séries */}
      {mediaTab === 'series' && filteredSeries.length > 0 && (
        <div className={styles.mediaGrid}>
          {filteredSeries.map((series) => {
            const needsValidation = !series.poster_url || series.poster_url.includes('placeholder') || !series.tmdb_id
            return (
              <div 
                key={series.id}
                className={styles.mediaCard}
                onClick={() => {
                  setSelectedSeries(series)
                  setSearchQuery(series.title)
                }}
              >
                <div className={styles.mediaPoster}>
                  {series.poster_url && !series.poster_url.includes('placeholder') ? (
                    <Image src={series.poster_url} alt={series.title} fill sizes="180px" style={{ objectFit: 'cover' }} unoptimized />
                  ) : (
                    <div className={styles.mediaNoPoster}>
                      <ImageIcon size={32} />
                    </div>
                  )}
                  {needsValidation && <div className={styles.mediaValidationBadge}>À valider</div>}
                </div>
                <div className={styles.mediaInfo}>
                  <h4 className={styles.mediaTitle}>{series.title}</h4>
                  {series.first_air_date && <p className={styles.mediaYear}>{new Date(series.first_air_date).getFullYear()}</p>}
                </div>
                <div className={styles.mediaOverlay}>
                  <Edit3 size={24} />
                  <span>{needsValidation ? 'Valider' : 'Modifier'}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal film */}
      {selectedMovie && (
        <div className={styles.modal} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={closeModal}>
              <X size={20} />
            </button>

            <div className={styles.modalGrid}>
              <div>
                <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Affiche actuelle</h3>
                <div style={{ borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                  {selectedMovie.poster_url && !selectedMovie.poster_url.includes('placeholder') ? (
                    <Image src={selectedMovie.poster_url} alt={selectedMovie.title} width={280} height={420} unoptimized style={{ width: '100%', height: 'auto' }} />
                  ) : (
                    <div style={{ aspectRatio: '2/3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                      <ImageIcon size={48} />
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 16, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>{selectedMovie.title}</h4>
                  {selectedMovie.year && <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{selectedMovie.year}</p>}
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Rechercher sur TMDB</h3>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <input
                    type="text"
                    placeholder="Titre du film..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchTMDB('movie')}
                    className={styles.searchInput}
                    style={{ flex: 1 }}
                  />
                  <button 
                    className={styles.btnPrimary}
                    onClick={() => searchTMDB('movie')}
                    disabled={searching || !searchQuery}
                  >
                    {searching ? <RefreshCw size={16} className={styles.spin} /> : <Search size={16} />}
                    Rechercher
                  </button>
                </div>

                {suggestions.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, maxHeight: 400, overflowY: 'auto' }}>
                    {suggestions.map((result) => (
                      <div 
                        key={result.id}
                        onClick={() => updatePoster(result.id, 'movie')}
                        style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8, transition: 'all 0.2s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      >
                        {result.poster_path ? (
                          <Image src={`https://image.tmdb.org/t/p/w300${result.poster_path}`} alt={result.title} width={120} height={180} unoptimized style={{ width: '100%', height: 'auto', borderRadius: 4 }} />
                        ) : (
                          <div style={{ aspectRatio: '2/3', background: 'rgba(255,255,255,0.05)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={24} color="rgba(255,255,255,0.3)" />
                          </div>
                        )}
                        <p style={{ margin: '8px 0 4px', fontSize: 12, fontWeight: 500 }}>{result.title}</p>
                        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{new Date(result.release_date).getFullYear()}</p>
                      </div>
                    ))}
                  </div>
                )}

                {suggestions.length === 0 && !searching && (
                  <div className={styles.empty}>
                    <Search size={32} />
                    <p className={styles.emptyText}>Recherchez le film pour voir les suggestions</p>
                  </div>
                )}
              </div>
            </div>

            {saving && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, borderRadius: 16 }}>
                <RefreshCw size={32} className={styles.spin} />
                <p style={{ margin: 0 }}>Validation en cours...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal série */}
      {selectedSeries && (
        <div className={styles.modal} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={closeModal}>
              <X size={20} />
            </button>

            <div className={styles.modalGrid}>
              <div>
                <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Affiche actuelle</h3>
                <div style={{ borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                  {selectedSeries.poster_url && !selectedSeries.poster_url.includes('placeholder') ? (
                    <Image src={selectedSeries.poster_url} alt={selectedSeries.title} width={280} height={420} unoptimized style={{ width: '100%', height: 'auto' }} />
                  ) : (
                    <div style={{ aspectRatio: '2/3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                      <ImageIcon size={48} />
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 16, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>{selectedSeries.title}</h4>
                  {selectedSeries.first_air_date && <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{new Date(selectedSeries.first_air_date).getFullYear()}</p>}
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Rechercher sur TMDB</h3>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <input
                    type="text"
                    placeholder="Titre de la série..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchTMDB('tv')}
                    className={styles.searchInput}
                    style={{ flex: 1 }}
                  />
                  <button 
                    className={styles.btnPrimary}
                    onClick={() => searchTMDB('tv')}
                    disabled={searching || !searchQuery}
                  >
                    {searching ? <RefreshCw size={16} className={styles.spin} /> : <Search size={16} />}
                    Rechercher
                  </button>
                </div>

                {suggestions.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, maxHeight: 400, overflowY: 'auto' }}>
                    {suggestions.map((result) => (
                      <div 
                        key={result.id}
                        onClick={() => updatePoster(result.id, 'series')}
                        style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8, transition: 'all 0.2s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      >
                        {result.poster_path ? (
                          <Image src={`https://image.tmdb.org/t/p/w300${result.poster_path}`} alt={result.name || result.title} width={120} height={180} unoptimized style={{ width: '100%', height: 'auto', borderRadius: 4 }} />
                        ) : (
                          <div style={{ aspectRatio: '2/3', background: 'rgba(255,255,255,0.05)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={24} color="rgba(255,255,255,0.3)" />
                          </div>
                        )}
                        <p style={{ margin: '8px 0 4px', fontSize: 12, fontWeight: 500 }}>{result.name || result.title}</p>
                        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{result.first_air_date ? new Date(result.first_air_date).getFullYear() : 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                )}

                {suggestions.length === 0 && !searching && (
                  <div className={styles.empty}>
                    <Search size={32} />
                    <p className={styles.emptyText}>Recherchez la série pour voir les suggestions</p>
                  </div>
                )}
              </div>
            </div>

            {saving && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, borderRadius: 16 }}>
                <RefreshCw size={32} className={styles.spin} />
                <p style={{ margin: 0 }}>Validation en cours...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// SECTION TRANSCODAGE
// ============================================

interface TranscodeStats {
  totalFiles: number
  completedFiles: number
  pendingFiles: number
  failedFiles: number
  currentJob?: {
    id: string
    filename: string
    progress: number
    speed?: number
    currentTime?: number
    estimatedDuration?: number
    mtime?: string
  }
  isRunning: boolean
  isPaused: boolean
  estimatedTimeRemaining?: number
  autoStartEnabled?: boolean
  watcherActive?: boolean
  diskUsage?: string
}

interface TranscodeJob {
  id: string
  filename: string
  status: 'pending' | 'transcoding' | 'completed' | 'failed' | 'cancelled'
  progress: number
  error?: string
  mtime?: string
  priority?: number
}

interface TranscodedFile {
  name: string
  folder: string
  transcodedAt: string
  segmentCount: number
  audioCount?: number
  subtitleCount?: number
}

function TranscodeView() {
  const [stats, setStats] = useState<TranscodeStats | null>(null)
  const [queue, setQueue] = useState<TranscodeJob[]>([])
  const [transcoded, setTranscoded] = useState<TranscodedFile[]>([])
  const [watcher, setWatcher] = useState<{ isWatching: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showTranscoded, setShowTranscoded] = useState(false)

  useEffect(() => {
    loadStats(true) // Mode rapide au démarrage
    const interval = setInterval(() => loadStats(true), 5000) // Polling toutes les 5s
    return () => clearInterval(interval)
  }, [])

  async function loadStats(quick: boolean = true) {
    try {
      const response = await fetch(`/api/transcode${quick ? '?quick=true' : ''}`)
      const data = await response.json()
      setStats(data.stats)
      setQueue(data.queue || [])
      setWatcher(data.watcher || null)
      if (data.transcoded) setTranscoded(data.transcoded)
    } catch (error) {
      console.error('Erreur chargement stats:', error)
    } finally {
      setLoading(false)
    }
  }

  async function performAction(action: string) {
    setActionLoading(action)
    try {
      await fetch('/api/transcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      await loadStats(true) // Mode rapide après action
    } catch (error) {
      console.error(`Erreur action ${action}:`, error)
    } finally {
      setActionLoading(null)
    }
  }

  async function deleteTranscoded(folder: string, name: string) {
    if (!confirm(`Supprimer "${name}" ?`)) return
    try {
      await fetch(`/api/transcode?folder=${encodeURIComponent(folder)}`, { method: 'DELETE' })
      await loadStats(false)
    } catch (error) {
      console.error('Erreur suppression:', error)
    }
  }

  function formatTime(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return '--:--'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return h > 0 ? `${h}h ${m}min` : `${m}min`
  }

  function formatDate(iso: string | undefined): string {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
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

      {/* Stats */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}><BarChart3 size={20} /></div>
          <h3 className={styles.cardTitle}>Progression globale</h3>
          <span className={styles.cardBadge}>{stats?.diskUsage || 'N/A'}</span>
        </div>
        <div className={styles.statsGrid}>
          <div className={styles.statBox}>
            <div className={styles.statValue}>{transcoded.length || stats?.completedFiles || 0}</div>
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

      {/* Job en cours */}
      {stats?.currentJob && (
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
      )}

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
      {queue.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}><Clock size={20} /></div>
            <h3 className={styles.cardTitle}>En attente ({queue.length})</h3>
          </div>
          <div className={styles.list}>
            {queue.slice(0, 10).map((job, i) => (
              <div key={job.id} className={styles.listItem}>
                <span className={styles.listIndex}>{i + 1}</span>
                <div className={styles.listContent}>
                  <span className={styles.listTitle}>{job.filename}</span>
                  {job.mtime && <span className={styles.listMeta}>Ajouté le {formatDate(job.mtime)}</span>}
                </div>
                <span className={`${styles.listBadge} ${job.status === 'failed' ? styles.error : styles.pending}`}>
                  {job.status === 'pending' ? 'Attente' : 'Retry'}
                </span>
              </div>
            ))}
            {queue.length > 10 && <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>...et {queue.length - 10} autres</p>}
          </div>
        </div>
      )}

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

// ============================================
// SECTION STATISTIQUES
// ============================================

interface DashboardStatsData {
  library: { totalMovies: number; totalSeries: number; totalDurationMinutes: number; averageDurationMinutes: number }
  posters: { withPosters: number; withoutPosters: number; validationRate: number }
  storage: { mediaSizeGB: number; transcodedSizeGB: number }
  transcoding: { completed: number; pending: number }
  genres: Array<{ name: string; count: number }>
  years: Array<{ year: number; count: number }>
  activity: { recentlyAdded: Array<{ id: string; title: string; poster_url: string | null; created_at: string }>; inProgress: Array<{ id: string; title: string; poster_url: string | null; progress: number }> }
}

function StatsView() {
  const [stats, setStats] = useState<DashboardStatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const response = await fetch('/api/stats/dashboard')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Erreur chargement stats:', error)
    } finally {
      setLoading(false)
    }
  }

  function formatDuration(min: number): string {
    if (min < 60) return `${min}min`
    const h = Math.floor(min / 60)
    if (h < 24) return `${h}h`
    const d = Math.floor(h / 24)
    return `${d}j ${h % 24}h`
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

  if (!stats) {
    return (
      <div className={styles.section}>
        <div className={styles.error}>
          <p className={styles.errorText}>Impossible de charger les statistiques</p>
          <button className={styles.btnSecondary} onClick={loadStats}><RefreshCw size={16} /> Réessayer</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.sectionTitle}>Statistiques</h1>
          <p className={styles.sectionDesc}>Vue d&apos;ensemble de votre bibliothèque</p>
        </div>
        <button className={styles.btnIcon} onClick={loadStats}><RefreshCw size={18} /></button>
      </div>

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.green}`}><Film size={24} /></div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats.library.totalMovies}</span>
            <span className={styles.kpiLabel}>Films</span>
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.blue}`}><Clock size={24} /></div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{formatDuration(stats.library.totalDurationMinutes)}</span>
            <span className={styles.kpiLabel}>Durée totale</span>
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.purple}`}><HardDrive size={24} /></div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats.storage.mediaSizeGB} GB</span>
            <span className={styles.kpiLabel}>Stockage</span>
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.orange}`}><Check size={24} /></div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats.posters.validationRate}%</span>
            <span className={styles.kpiLabel}>Affiches OK</span>
          </div>
        </div>
      </div>

      {/* Genres */}
      {stats.genres.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}><BarChart3 size={20} /></div>
            <h3 className={styles.cardTitle}>Top Genres</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats.genres.slice(0, 8).map((genre) => {
              const max = stats.genres[0]?.count || 1
              return (
                <div key={genre.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 100, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{genre.name}</span>
                  <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(genre.count / max) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 32, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textAlign: 'right' }}>{genre.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Récemment ajoutés */}
      {stats.activity.recentlyAdded.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}><Clock size={20} /></div>
            <h3 className={styles.cardTitle}>Récemment ajoutés</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
            {stats.activity.recentlyAdded.slice(0, 6).map((movie) => (
              <div key={movie.id} style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '2/3', borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.05)', marginBottom: 8 }}>
                  {movie.poster_url && !movie.poster_url.includes('placeholder') ? (
                    <Image src={movie.poster_url} alt={movie.title} fill sizes="120px" style={{ objectFit: 'cover' }} unoptimized />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)' }}><Film size={24} /></div>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{movie.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// SECTION ACTIVITÉ (En direct + Historique)
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

function ActivityView() {
  const [activeTab, setActiveTab] = useState<ActivityTab>('live')
  const [liveData, setLiveData] = useState<ActivityData | null>(null)
  const [historyData, setHistoryData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [selectedDays, setSelectedDays] = useState<number>(30)
  const [currentPage, setCurrentPage] = useState(1)
  const [historyPreloaded, setHistoryPreloaded] = useState(false)

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
