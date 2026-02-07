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

import { useState, useEffect, useCallback, useRef, memo } from 'react'
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
  AlertCircle,
  Menu,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  CheckCircle,
  XCircle,
  Info,
  AlertTriangle
} from 'lucide-react'
import styles from './admin.module.css'

// ============================================
// SYSTÈME DE NOTIFICATIONS TOAST
// ============================================
type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  leaving?: boolean
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  
  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).substring(7)
    setToasts(prev => [...prev, { id, type, title, message }])
    
    // Auto-remove après 4s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t))
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 250)
    }, 4000)
    
    return id
  }, [])
  
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 250)
  }, [])
  
  return { toasts, addToast, removeToast }
}

const ToastIcon = ({ type }: { type: ToastType }) => {
  switch (type) {
    case 'success': return <CheckCircle size={18} />
    case 'error': return <XCircle size={18} />
    case 'warning': return <AlertTriangle size={18} />
    default: return <Info size={18} />
  }
}

const ToastContainer = memo(function ToastContainer({ 
  toasts, 
  removeToast 
}: { 
  toasts: Toast[]
  removeToast: (id: string) => void 
}) {
  if (toasts.length === 0) return null
  
  return (
    <div className={styles.toastContainer}>
      {toasts.map(toast => (
        <div 
          key={toast.id} 
          className={`${styles.toast} ${styles[toast.type]} ${toast.leaving ? styles.leaving : ''}`}
        >
          <div className={styles.toastIcon}>
            <ToastIcon type={toast.type} />
          </div>
          <div className={styles.toastContent}>
            <p className={styles.toastTitle}>{toast.title}</p>
            {toast.message && <p className={styles.toastMessage}>{toast.message}</p>}
          </div>
          <button className={styles.toastClose} onClick={() => removeToast(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
})

// Types
type AdminView = 'dashboard' | 'scan' | 'library' | 'posters' | 'credits' | 'transcode' | 'stats' | 'activity' | 'users'

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

// Context pour partager le toast entre composants
import { createContext, useContext } from 'react'
const ToastContext = createContext<{
  addToast: (type: ToastType, title: string, message?: string) => string
} | null>(null)

// Hook interne (pas d'export car Next.js n'autorise que le default export dans page.tsx)
const useAdminToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useAdminToast must be used within AdminPageV2')
  return ctx
}

export default function AdminPageV2() {
  const [view, setView] = useState<AdminView>('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [status, setStatus] = useState<SystemStatus>({
    transcodingActive: false,
    watcherActive: false,
    autoStartEnabled: false
  })
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Système de toast
  const { toasts, addToast, removeToast } = useToast()
  
  // Ref pour éviter les requêtes en double
  const isLoadingRef = useRef(false)
  const lastLoadRef = useRef(0)
  
  // Fermer le menu mobile quand on change de vue
  const handleViewChange = (newView: AdminView) => {
    setView(newView)
    setMobileMenuOpen(false)
  }

  // Charger les données avec throttling intelligent
  const loadDashboardData = useCallback(async (force = false) => {
    // Éviter les requêtes trop rapprochées (min 2s entre chaque)
    const now = Date.now()
    if (!force && (isLoadingRef.current || now - lastLoadRef.current < 2000)) {
      return
    }
    
    isLoadingRef.current = true
    lastLoadRef.current = now
    
    try {
      // Charger les stats en parallèle avec AbortController pour timeout
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      
      const [transcodeRes, statsRes, watchingRes] = await Promise.all([
        fetch('/api/transcode?quick=true', { signal: controller.signal }),
        fetch('/api/stats/dashboard', { signal: controller.signal }),
        fetch('/api/stats/watching', { signal: controller.signal })
      ])
      
      clearTimeout(timeout)

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
      if ((error as Error).name !== 'AbortError') {
        console.error('Erreur chargement dashboard:', error)
      }
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [])

  // Polling intelligent : plus rapide si transcodage actif, désactivé si pas sur le dashboard
  useEffect(() => {
    loadDashboardData(true)
    
    // 🔧 OPTIMISATION: Ne pas faire de polling si on n'est pas sur le dashboard
    if (view !== 'dashboard') {
      return
    }
    
    // Polling adaptatif : 5s si transcodage actif, 15s sinon
    const getInterval = () => status.transcodingActive ? 5000 : 15000
    
    let interval = setInterval(() => loadDashboardData(), getInterval())
    
    // Re-créer l'intervalle si le status change ou si on change de vue
    return () => clearInterval(interval)
  }, [loadDashboardData, status.transcodingActive, view])

  return (
    <ToastContext.Provider value={{ addToast }}>
    <div className={styles.container}>
      {/* Notifications Toast */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <Header />
      
      {/* Bouton menu mobile */}
      <button 
        className={styles.mobileMenuBtn}
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Menu"
      >
        <Menu size={24} />
      </button>
      
      {/* Overlay mobile */}
      {mobileMenuOpen && (
        <div 
          className={styles.mobileOverlay} 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      <div className={styles.content}>
        {/* Navigation latérale */}
        <nav className={`${styles.sidebar} ${mobileMenuOpen ? styles.open : ''}`}>
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
                onClick={() => handleViewChange('dashboard')}
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
                onClick={() => handleViewChange('scan')}
              >
                <FolderSearch className={styles.navIcon} size={18} />
                Scanner
              </button>
              <button
                className={`${styles.navItem} ${view === 'library' ? styles.active : ''}`}
                onClick={() => handleViewChange('library')}
              >
                <HardDrive className={styles.navIcon} size={18} />
                Bibliothèque
              </button>
              <button
                className={`${styles.navItem} ${view === 'posters' ? styles.active : ''}`}
                onClick={() => handleViewChange('posters')}
              >
                <ImageIcon className={styles.navIcon} size={18} />
                Affiches
                {dashboardStats && dashboardStats.postersToValidate > 0 && (
                  <span className={styles.navBadge}>{dashboardStats.postersToValidate}</span>
                )}
              </button>
              <button
                className={`${styles.navItem} ${view === 'credits' ? styles.active : ''}`}
                onClick={() => handleViewChange('credits')}
              >
                <Clock className={styles.navIcon} size={18} />
                Génériques
              </button>
            </div>

            {/* Technique */}
            <div className={styles.navGroup}>
              <p className={styles.navGroupLabel}>Performance</p>
              <button
                className={`${styles.navItem} ${view === 'transcode' ? styles.active : ''}`}
                onClick={() => handleViewChange('transcode')}
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
                onClick={() => handleViewChange('stats')}
              >
                <BarChart3 className={styles.navIcon} size={18} />
                Statistiques
              </button>
              <button
                className={`${styles.navItem} ${view === 'activity' ? styles.active : ''}`}
                onClick={() => handleViewChange('activity')}
              >
                <Activity className={styles.navIcon} size={18} />
                Activité
                {dashboardStats && dashboardStats.activeViewers > 0 && (
                  <span className={styles.navBadge}>{dashboardStats.activeViewers}</span>
                )}
              </button>
              <button
                className={`${styles.navItem} ${view === 'users' ? styles.active : ''}`}
                onClick={() => handleViewChange('users')}
              >
                <Users className={styles.navIcon} size={18} />
                Utilisateurs
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
          {view === 'library' && <LibraryView />}
          {view === 'posters' && <PostersView />}
          {view === 'credits' && <CreditsSettingsView />}
          {view === 'transcode' && <TranscodeView />}
          {view === 'stats' && <StatsView />}
          {view === 'activity' && <ActivityView />}
          {view === 'users' && <UsersView />}
        </main>
      </div>
    </div>
    </ToastContext.Provider>
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

// ============================================
// SECTION SCAN
// ============================================

function ScanView() {
  const [scanningFilms, setScanningFilms] = useState(false)
  const [scanningSeries, setScanningSeries] = useState(false)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [filmResult, setFilmResult] = useState<{ stats?: { total?: number; new?: number; updated?: number } } | null>(null)
  const [seriesResult, setSeriesResult] = useState<{ stats?: { totalSeries?: number; newSeries?: number; totalEpisodes?: number; newEpisodes?: number; enrichedEpisodes?: number } } | null>(null)
  const [cleanupResult, setCleanupResult] = useState<{ result?: { checked?: number; missing?: number; deleted?: number; details?: Array<{ title: string }> } } | null>(null)
  const [seriesScanProgress, setSeriesScanProgress] = useState<{
    currentSeries: string | null
    processedSeries: number
    totalSeries: number
  } | null>(null)
  
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
      const response = await fetch('/api/scan', { method: 'POST', credentials: 'include' })
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
    setSeriesScanProgress(null)
    
    try {
      // Lancer le scan en mode background pour éviter le timeout Cloudflare
      const response = await fetch('/api/scan-series?background=true', { method: 'POST', credentials: 'include' })
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Erreur lors du lancement du scan')
      }
      
      // Polling pour suivre la progression
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch('/api/scan-series')
          const statusData = await statusResponse.json()
          
          if (statusData.scan) {
            // Mettre à jour la progression
            setSeriesScanProgress({
              currentSeries: statusData.scan.currentSeries,
              processedSeries: statusData.scan.progress?.processedSeries || 0,
              totalSeries: statusData.scan.progress?.totalSeries || 0
            })
            
            // Si le scan est terminé
            if (!statusData.scan.isRunning) {
              clearInterval(pollInterval)
              setScanningSeries(false)
              setSeriesScanProgress(null)
              
              if (statusData.scan.error) {
                alert(`Erreur: ${statusData.scan.error}`)
              } else {
                setSeriesResult({ stats: statusData.scan.stats })
              }
            }
          }
        } catch (pollError) {
          console.error('Erreur polling:', pollError)
        }
      }, 2000) // Poll toutes les 2 secondes
      
    } catch (error) {
      console.error('Erreur scan séries:', error)
      alert('Erreur lors du scan des séries')
      setScanningSeries(false)
    }
  }

  async function handleCleanup() {
    if (!confirm('Supprimer les médias dont le fichier n\'existe plus sur le disque ?')) return
    
    setCleaningUp(true)
    setCleanupResult(null)
    try {
      const response = await fetch('/api/admin/cleanup-missing', { method: 'POST', credentials: 'include' })
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
        body: JSON.stringify({ mode: 'list-unimported' }),
        credentials: 'include'
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
      const response = await fetch(`/api/import?query=${encodeURIComponent(query)}`, { credentials: 'include' })
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
        body: JSON.stringify({ mode: 'filepath', filepath: importPath }),
        credentials: 'include'
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
        body: JSON.stringify({ mode: 'tmdb', filepath, tmdbId }),
        credentials: 'include'
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

      {/* Info automatisation */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14
      }}>
        <Eye size={24} style={{ color: '#22c55e', flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: '#22c55e', marginBottom: 6, fontSize: 15 }}>
            Surveillance automatique active
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.5 }}>
            LEON détecte automatiquement les nouveaux fichiers ajoutés au NAS et les importe avec leurs métadonnées TMDB.
            Les scans manuels ci-dessous ne sont nécessaires que pour :
          </p>
          <ul style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '8px 0 0', paddingLeft: 20 }}>
            <li>Premier import d&apos;une bibliothèque existante</li>
            <li>Réindexation complète après un problème</li>
            <li>Forcer la mise à jour des métadonnées</li>
          </ul>
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

        {/* Progression du scan en temps réel */}
        {scanningSeries && seriesScanProgress && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, opacity: 0.7 }}>
              <span>Progression</span>
              <span>{seriesScanProgress.processedSeries} / {seriesScanProgress.totalSeries}</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  background: '#22c55e', 
                  borderRadius: 2,
                  width: seriesScanProgress.totalSeries > 0 
                    ? `${(seriesScanProgress.processedSeries / seriesScanProgress.totalSeries) * 100}%` 
                    : '0%',
                  transition: 'width 0.3s ease'
                }} 
              />
            </div>
            {seriesScanProgress.currentSeries && (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6, fontStyle: 'italic' }}>
                {seriesScanProgress.currentSeries}
              </div>
            )}
          </div>
        )}

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
            {(seriesResult.stats?.enrichedEpisodes || 0) > 0 && (
              <div className={styles.statBox}>
                <div className={styles.statValue}>{seriesResult.stats?.enrichedEpisodes || 0}</div>
                <div className={styles.statLabel}>Enrichis</div>
              </div>
            )}
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
// SECTION BIBLIOTHÈQUE - Gestion des médias
// ============================================

interface MediaItem {
  id: string
  title: string
  year?: number
  poster_url?: string
  filepath?: string
  type: 'movie' | 'series'
  episode_count?: number
  tmdb_id?: number
  overview?: string
}

interface DeletePreview {
  media: MediaItem | null
  episodes?: number
  favorites: number
  playbackPositions: number
  hasTranscoded: boolean
  hasSourceFiles: boolean
  sourceFilesCount: number
  filepath?: string
}

type ModalMode = 'view' | 'edit'

function LibraryView() {
  const [searchQuery, setSearchQuery] = useState('')
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'series'>('all')
  const [results, setResults] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null)
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteSourceFiles, setDeleteSourceFiles] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('view')
  const [saving, setSaving] = useState(false)
  
  // Champs d'édition
  const [editTitle, setEditTitle] = useState('')
  const [editYear, setEditYear] = useState('')
  const [editTmdbId, setEditTmdbId] = useState('')
  const [editPosterUrl, setEditPosterUrl] = useState('')
  
  const { addToast } = useAdminToast()

  // Recherche avec debounce
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    if (searchQuery.length < 2) {
      setResults([])
      return
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchMedia()
    }, 300)
    
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, mediaType])

  async function searchMedia() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ q: searchQuery })
      if (mediaType !== 'all') params.set('type', mediaType)
      
      const response = await fetch(`/api/admin/library-search?${params}`)
      const data = await response.json()
      
      if (data.success && data.results) {
        const items: MediaItem[] = []
        
        if (data.results.movies) {
          items.push(...data.results.movies.map((m: any) => ({
            id: m.id,
            title: m.title,
            year: m.year,
            poster_url: m.poster_url,
            filepath: m.pcloud_fileid,
            type: 'movie' as const
          })))
        }
        
        if (data.results.series) {
          items.push(...data.results.series.map((s: any) => ({
            id: s.id,
            title: s.title,
            year: s.year,
            poster_url: s.poster_url,
            type: 'series' as const,
            episode_count: s.episode_count
          })))
        }
        
        setResults(items)
      }
    } catch (error) {
      console.error('Erreur recherche:', error)
      addToast('error', 'Erreur', 'Recherche échouée')
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectMedia(media: MediaItem) {
    setSelectedMedia(media)
    setDeletePreview(null)
    setModalMode('view')
    setDeleteSourceFiles(false)
    
    // Charger les infos complètes et la prévisualisation
    try {
      const [previewRes, infoRes] = await Promise.all([
        fetch(`/api/admin/delete-media?id=${media.id}&type=${media.type}`),
        fetch(`/api/admin/update-media-info?id=${media.id}&type=${media.type}`)
      ])
      
      const previewData = await previewRes.json()
      const infoData = await infoRes.json()
      
      if (previewData.success) {
        setDeletePreview(previewData.preview)
      }
      
      if (infoData.success && infoData.media) {
        // Mettre à jour les infos complètes
        setSelectedMedia(prev => prev ? {
          ...prev,
          tmdb_id: infoData.media.tmdb_id,
          overview: infoData.media.overview
        } : null)
        
        // Initialiser les champs d'édition
        setEditTitle(infoData.media.title || '')
        setEditYear(infoData.media.year?.toString() || '')
        setEditTmdbId(infoData.media.tmdb_id?.toString() || '')
        setEditPosterUrl(infoData.media.poster_url || '')
      }
    } catch (error) {
      console.error('Erreur chargement infos:', error)
    }
  }

  async function handleDelete() {
    if (!selectedMedia) return
    
    let confirmMsg = selectedMedia.type === 'series'
      ? `Supprimer la série "${selectedMedia.title}" et tous ses épisodes ?`
      : `Supprimer le film "${selectedMedia.title}" ?`
    
    confirmMsg += '\n\nCette action supprimera :'
    confirmMsg += selectedMedia.type === 'series' 
      ? `\n- La série et ses ${deletePreview?.episodes || 0} épisodes`
      : '\n- Le film de la base'
    if (deletePreview?.favorites) confirmMsg += `\n- ${deletePreview.favorites} favoris`
    if (deletePreview?.playbackPositions) confirmMsg += `\n- ${deletePreview.playbackPositions} positions de lecture`
    if (deletePreview?.hasTranscoded) confirmMsg += '\n- Les fichiers transcodés'
    
    if (deleteSourceFiles && deletePreview?.hasSourceFiles) {
      confirmMsg += `\n\n⚠️ ATTENTION: ${deletePreview.sourceFilesCount} FICHIER(S) SOURCE SERONT SUPPRIMÉS DU NAS !`
      confirmMsg += '\nCette action est IRRÉVERSIBLE !'
    }
    
    if (!confirm(confirmMsg)) return
    
    // Double confirmation pour la suppression des fichiers sources
    if (deleteSourceFiles && deletePreview?.hasSourceFiles) {
      if (!confirm('DERNIÈRE CONFIRMATION\n\nVoulez-vous vraiment supprimer les fichiers sources du NAS ?\n\nCette action ne peut pas être annulée.')) {
        return
      }
    }
    
    setDeleting(true)
    try {
      const params = new URLSearchParams({
        id: selectedMedia.id,
        type: selectedMedia.type
      })
      if (deleteSourceFiles) params.set('deleteSource', 'true')
      
      const response = await fetch(`/api/admin/delete-media?${params}`, { method: 'DELETE' })
      const data = await response.json()
      
      if (data.success) {
        addToast('success', 'Supprimé', data.message)
        setResults(prev => prev.filter(r => r.id !== selectedMedia.id))
        closeModal()
      } else {
        addToast('error', 'Erreur', data.error || 'Suppression échouée')
      }
    } catch (error) {
      console.error('Erreur suppression:', error)
      addToast('error', 'Erreur', 'Suppression échouée')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSaveEdit() {
    if (!selectedMedia) return
    
    setSaving(true)
    try {
      const payload: any = {
        id: selectedMedia.id,
        type: selectedMedia.type
      }
      
      if (editTitle !== selectedMedia.title) payload.title = editTitle
      if (editYear !== (selectedMedia.year?.toString() || '')) {
        payload.year = editYear ? parseInt(editYear, 10) : null
      }
      if (editTmdbId !== (selectedMedia.tmdb_id?.toString() || '')) {
        payload.tmdb_id = editTmdbId ? parseInt(editTmdbId, 10) : null
      }
      if (editPosterUrl !== (selectedMedia.poster_url || '')) {
        payload.poster_url = editPosterUrl || null
      }
      
      const response = await fetch('/api/admin/update-media-info', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      const data = await response.json()
      
      if (data.success) {
        addToast('success', 'Sauvegardé', data.message)
        
        // Mettre à jour la liste et le média sélectionné
        const updatedMedia = { ...selectedMedia, ...data.media }
        setSelectedMedia(updatedMedia)
        setResults(prev => prev.map(r => r.id === selectedMedia.id ? updatedMedia : r))
        setModalMode('view')
      } else {
        addToast('error', 'Erreur', data.error || 'Sauvegarde échouée')
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      addToast('error', 'Erreur', 'Sauvegarde échouée')
    } finally {
      setSaving(false)
    }
  }

  async function handleRefreshFromTmdb() {
    if (!selectedMedia || !editTmdbId) return
    
    setSaving(true)
    try {
      const response = await fetch('/api/admin/update-media-info', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedMedia.id,
          type: selectedMedia.type,
          tmdb_id: parseInt(editTmdbId, 10),
          refreshFromTmdb: true
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        addToast('success', 'Mis à jour', 'Métadonnées TMDB importées')
        
        const updatedMedia = { ...selectedMedia, ...data.media }
        setSelectedMedia(updatedMedia)
        setEditTitle(data.media.title || '')
        setEditYear(data.media.year?.toString() || '')
        setEditPosterUrl(data.media.poster_url || '')
        setResults(prev => prev.map(r => r.id === selectedMedia.id ? updatedMedia : r))
      } else {
        addToast('error', 'Erreur', data.error || 'Import TMDB échoué')
      }
    } catch (error) {
      console.error('Erreur TMDB:', error)
      addToast('error', 'Erreur', 'Import TMDB échoué')
    } finally {
      setSaving(false)
    }
  }

  function closeModal() {
    setSelectedMedia(null)
    setDeletePreview(null)
    setModalMode('view')
    setDeleteSourceFiles(false)
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <HardDrive size={24} />
          Gestion de la bibliothèque
        </h2>
        <p className={styles.sectionSubtitle}>
          Rechercher, modifier ou supprimer les médias
        </p>
      </div>

      {/* Barre de recherche */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Rechercher un média</h3>
        </div>
        
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search 
              size={18} 
              style={{ 
                position: 'absolute', 
                left: 12, 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: 'rgba(255,255,255,0.4)' 
              }} 
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Titre du film ou de la série..."
              className={styles.input}
              style={{ paddingLeft: 40 }}
            />
          </div>
          
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as 'all' | 'movie' | 'series')}
            className={styles.input}
            style={{ width: 'auto', minWidth: 140 }}
          >
            <option value="all">Tous</option>
            <option value="movie">Films</option>
            <option value="series">Séries</option>
          </select>
        </div>

        {/* Résultats */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <RefreshCw size={24} className={styles.spin} style={{ color: 'rgba(255,255,255,0.4)' }} />
          </div>
        ) : results.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map(media => (
              <div
                key={`${media.type}-${media.id}`}
                onClick={() => handleSelectMedia(media)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                <div style={{ width: 40, height: 60, borderRadius: 4, overflow: 'hidden', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
                  {media.poster_url && !media.poster_url.includes('placeholder') ? (
                    <Image src={media.poster_url} alt={media.title} width={40} height={60} style={{ objectFit: 'cover' }} unoptimized />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.2)' }}>
                      {media.type === 'series' ? <Tv size={16} /> : <Film size={16} />}
                    </div>
                  )}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {media.title}
                    {media.year && <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>({media.year})</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    {media.type === 'series' ? `${media.episode_count || '?'} épisodes` : 'Film'}
                  </div>
                </div>
                
                <span style={{
                  padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                  background: media.type === 'series' ? 'rgba(147, 51, 234, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                  color: media.type === 'series' ? 'rgb(192, 132, 252)' : 'rgb(147, 197, 253)'
                }}>
                  {media.type === 'series' ? 'Série' : 'Film'}
                </span>
                
                <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
              </div>
            ))}
          </div>
        ) : searchQuery.length >= 2 ? (
          <p style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>
            Aucun résultat pour &quot;{searchQuery}&quot;
          </p>
        ) : (
          <p style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>
            Entrez au moins 2 caractères pour rechercher
          </p>
        )}
      </div>

      {/* Modal de détails/édition/suppression */}
      {selectedMedia && (
        <div className={styles.modal} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <button className={styles.modalClose} onClick={closeModal}><X size={20} /></button>
            
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button
                onClick={() => setModalMode('view')}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: modalMode === 'view' ? 'white' : 'rgba(255,255,255,0.1)',
                  color: modalMode === 'view' ? 'black' : 'white',
                  fontWeight: 500, fontSize: 13
                }}
              >
                <Eye size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Détails
              </button>
              <button
                onClick={() => setModalMode('edit')}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: modalMode === 'edit' ? 'white' : 'rgba(255,255,255,0.1)',
                  color: modalMode === 'edit' ? 'black' : 'white',
                  fontWeight: 500, fontSize: 13
                }}
              >
                <Edit3 size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Modifier
              </button>
            </div>

            {modalMode === 'view' ? (
              <>
                {/* Vue détails */}
                <h3 style={{ margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedMedia.type === 'series' ? <Tv size={20} /> : <Film size={20} />}
                  {selectedMedia.title}
                </h3>
                
                <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                  <div style={{ width: 100, height: 150, borderRadius: 8, overflow: 'hidden', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
                    {selectedMedia.poster_url && !selectedMedia.poster_url.includes('placeholder') ? (
                      <Image src={selectedMedia.poster_url} alt={selectedMedia.title} width={100} height={150} style={{ objectFit: 'cover' }} unoptimized />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.2)' }}>
                        {selectedMedia.type === 'series' ? <Tv size={32} /> : <Film size={32} />}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ fontSize: 13 }}>
                    <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.7)' }}>
                      <strong>Type :</strong> {selectedMedia.type === 'series' ? 'Série TV' : 'Film'}
                    </p>
                    {selectedMedia.year && (
                      <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.7)' }}><strong>Année :</strong> {selectedMedia.year}</p>
                    )}
                    {selectedMedia.tmdb_id && (
                      <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.7)' }}><strong>TMDB ID :</strong> {selectedMedia.tmdb_id}</p>
                    )}
                    {selectedMedia.type === 'series' && deletePreview?.episodes !== undefined && (
                      <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.7)' }}><strong>Épisodes :</strong> {deletePreview.episodes}</p>
                    )}
                  </div>
                </div>
                
                {/* Zone de suppression */}
                {deletePreview && (
                  <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: 16 }}>
                    <h4 style={{ margin: '0 0 12px', color: 'rgb(252, 165, 165)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertCircle size={16} /> Suppression
                    </h4>
                    <ul style={{ margin: '0 0 12px', paddingLeft: 20, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                      <li>{selectedMedia.type === 'series' ? `La série et ses ${deletePreview.episodes || 0} épisodes` : 'Le film'}</li>
                      {deletePreview.favorites > 0 && <li>{deletePreview.favorites} favoris</li>}
                      {deletePreview.playbackPositions > 0 && <li>{deletePreview.playbackPositions} positions de lecture</li>}
                      {deletePreview.hasTranscoded && <li>Fichiers transcodés</li>}
                    </ul>
                    
                    {deletePreview.hasSourceFiles && (
                      <label style={{ 
                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                        background: deleteSourceFiles ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0,0,0,0.2)',
                        borderRadius: 6, cursor: 'pointer', marginTop: 12,
                        border: deleteSourceFiles ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid transparent'
                      }}>
                        <input
                          type="checkbox"
                          checked={deleteSourceFiles}
                          onChange={(e) => setDeleteSourceFiles(e.target.checked)}
                          style={{ width: 18, height: 18 }}
                        />
                        <div>
                          <span style={{ color: deleteSourceFiles ? '#ef4444' : 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: 13 }}>
                            Supprimer aussi {deletePreview.sourceFilesCount} fichier(s) source du NAS
                          </span>
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                            ⚠️ Action irréversible !
                          </p>
                        </div>
                      </label>
                    )}
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button className={styles.btnSecondary} onClick={closeModal}>Fermer</button>
                  <button className={styles.btnDanger} onClick={handleDelete} disabled={deleting}>
                    {deleting ? <><RefreshCw size={16} className={styles.spin} /> Suppression...</> : <><Trash2 size={16} /> Supprimer</>}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Mode édition */}
                <h3 style={{ margin: '0 0 20px' }}>Modifier les métadonnées</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Titre</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className={styles.input}
                      placeholder="Titre du média"
                    />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Année</label>
                      <input
                        type="number"
                        value={editYear}
                        onChange={(e) => setEditYear(e.target.value)}
                        className={styles.input}
                        placeholder="2024"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>TMDB ID</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="number"
                          value={editTmdbId}
                          onChange={(e) => setEditTmdbId(e.target.value)}
                          className={styles.input}
                          placeholder="12345"
                          style={{ flex: 1 }}
                        />
                        <button
                          onClick={handleRefreshFromTmdb}
                          disabled={!editTmdbId || saving}
                          className={styles.btnIcon}
                          title="Importer depuis TMDB"
                          style={{ width: 40, height: 40 }}
                        >
                          <RotateCcw size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>URL de l&apos;affiche</label>
                    <input
                      type="url"
                      value={editPosterUrl}
                      onChange={(e) => setEditPosterUrl(e.target.value)}
                      className={styles.input}
                      placeholder="https://image.tmdb.org/..."
                    />
                  </div>
                  
                  {editPosterUrl && (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div style={{ width: 100, height: 150, borderRadius: 8, overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
                        <Image src={editPosterUrl} alt="Aperçu" width={100} height={150} style={{ objectFit: 'cover' }} unoptimized />
                      </div>
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                  <button className={styles.btnSecondary} onClick={() => setModalMode('view')}>Annuler</button>
                  <button className={styles.btnPrimary} onClick={handleSaveEdit} disabled={saving}>
                    {saving ? <><RefreshCw size={16} className={styles.spin} /> Enregistrement...</> : <><Check size={16} /> Enregistrer</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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
  const { addToast } = useAdminToast()
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

  async function loadMovies(forceRefresh = false) {
    try {
      // Ajouter nocache=true pour forcer le rafraîchissement après mise à jour
      const url = forceRefresh ? '/api/media/grouped?type=movie&nocache=true' : '/api/media/grouped?type=movie'
      const response = await fetch(url)
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

  async function loadSeries(forceRefresh = false) {
    try {
      // 🔧 FIX: Ajouter nocache=true pour forcer le rafraîchissement après mise à jour
      const url = forceRefresh ? '/api/series/list?nocache=true' : '/api/series/list'
      const response = await fetch(url)
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
      const response = await fetch(`/api/admin/search-tmdb?query=${encodeURIComponent(query || '')}&type=${type}`, {
        credentials: 'include' // Envoyer les cookies d'auth
      })
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
      const endpoint = type === 'movie' 
        ? '/api/admin/update-media-info' 
        : '/api/admin/update-series-metadata'
      const body = type === 'movie' 
        ? { id: selectedMovie?.id, type: 'movie', tmdb_id: tmdbId, refreshFromTmdb: true }
        : { seriesId: selectedSeries?.id, tmdbId }
      
      const response = await fetch(endpoint, {
        method: type === 'movie' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include'
      })
      
      if (response.ok) {
        // 🔧 FIX: Recharger AVANT de fermer le modal pour garantir la mise à jour
        if (type === 'movie') await loadMovies(true) // Forcer le rafraîchissement du cache
        else await loadSeries(true)
        
        // Fermer le modal APRÈS le rechargement
        closeModal()
        
        // Utiliser le toast au lieu de alert (plus moderne)
        addToast('success', 'Affiche mise à jour', 'Les métadonnées ont été synchronisées avec TMDB')
      } else {
        const data = await response.json()
        addToast('error', 'Erreur de mise à jour', data.error || 'Erreur inconnue')
      }
    } catch (error) {
      console.error('Erreur mise à jour:', error)
      addToast('error', 'Erreur réseau', 'Impossible de communiquer avec le serveur')
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
  activeJobs?: Array<{
    id: string
    filename: string
    progress: number
    speed?: number
    currentTime?: number
    estimatedDuration?: number
  }>
  activeCount?: number
  maxConcurrent?: number
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
  fileSize?: number
  filepath?: string
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
  const { addToast } = useAdminToast()
  const [stats, setStats] = useState<TranscodeStats | null>(null)
  const [queue, setQueue] = useState<TranscodeJob[]>([])
  const [transcoded, setTranscoded] = useState<TranscodedFile[]>([])
  const [watcher, setWatcher] = useState<{ isWatching: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showTranscoded, setShowTranscoded] = useState(false)
  
  // État pour bloquer le polling pendant les modifications
  const [isModifying, setIsModifying] = useState(false)
  const isLoadingRef = useRef(false)
  const modifyTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Drag and drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  
  // Modal déplacement vers position
  const [moveModal, setMoveModal] = useState<{ jobId: string; filename: string; currentIndex: number } | null>(null)
  const [targetPosition, setTargetPosition] = useState('')
  const queueListRef = useRef<HTMLDivElement>(null)

  // Polling avec blocage pendant modifications
  useEffect(() => {
    loadStats(true)
    const getInterval = () => stats?.isRunning && !stats?.isPaused ? 4000 : 10000
    const interval = setInterval(() => {
      if (!isModifying) loadStats(true)
    }, getInterval())
    return () => clearInterval(interval)
  }, [stats?.isRunning, stats?.isPaused, isModifying])

  const loadStats = useCallback(async (quick: boolean = true) => {
    if (isLoadingRef.current || isModifying) return
    isLoadingRef.current = true
    
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
      isLoadingRef.current = false
    }
  }, [isModifying])

  async function performAction(action: string) {
    setActionLoading(action)
    try {
      await fetch('/api/transcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        credentials: 'include'
      })
      
      const messages: Record<string, { title: string; type: ToastType }> = {
        'start': { title: 'Transcodage démarré', type: 'success' },
        'pause': { title: 'Transcodage en pause', type: 'info' },
        'resume': { title: 'Transcodage repris', type: 'success' },
        'stop': { title: 'Transcodage arrêté', type: 'warning' },
        'scan': { title: 'Scan terminé', type: 'success' },
        'start-watcher': { title: 'Watcher activé', type: 'success' },
        'stop-watcher': { title: 'Watcher désactivé', type: 'info' }
      }
      
      const msg = messages[action]
      if (msg) addToast(msg.type, msg.title)
      
      await loadStats(true)
    } catch (error) {
      console.error(`Erreur action ${action}:`, error)
      addToast('error', 'Erreur', `Action "${action}" échouée`)
    } finally {
      setActionLoading(null)
    }
  }

  async function deleteTranscoded(folder: string, name: string) {
    if (!confirm(`Supprimer "${name}" ?`)) return
    try {
      await fetch(`/api/transcode?folder=${encodeURIComponent(folder)}`, { method: 'DELETE', credentials: 'include' })
      addToast('success', 'Supprimé', name)
      await loadStats(false)
    } catch (error) {
      console.error('Erreur suppression:', error)
      addToast('error', 'Erreur suppression')
    }
  }

  // Gestion optimiste de la queue
  async function moveJobToTop(jobId: string) {
    // Bloquer le polling
    setIsModifying(true)
    if (modifyTimeoutRef.current) clearTimeout(modifyTimeoutRef.current)
    
    // Mise à jour optimiste immédiate
    const jobIndex = queue.findIndex(j => j.id === jobId)
    if (jobIndex > 0) {
      const newQueue = [...queue]
      const [job] = newQueue.splice(jobIndex, 1)
      newQueue.unshift(job)
      setQueue(newQueue)
    }
    
    try {
      await fetch('/api/admin/transcode-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move-to-top', jobId }),
        credentials: 'include'
      })
      addToast('success', 'Placé en priorité')
    } catch (error) {
      console.error('Erreur move-to-top:', error)
      addToast('error', 'Erreur', 'Déplacement échoué')
      await loadStats(true) // Resync en cas d'erreur
    }
    
    // Débloquer le polling après 2s
    modifyTimeoutRef.current = setTimeout(() => {
      setIsModifying(false)
      loadStats(true)
    }, 2000)
  }
  
  async function removeFromQueue(jobId: string, filename: string) {
    if (!confirm(`Retirer "${filename}" de la file ?`)) return
    
    // Bloquer le polling
    setIsModifying(true)
    if (modifyTimeoutRef.current) clearTimeout(modifyTimeoutRef.current)
    
    // Mise à jour optimiste immédiate
    setQueue(prev => prev.filter(j => j.id !== jobId))
    
    try {
      await fetch('/api/admin/transcode-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', jobId }),
        credentials: 'include'
      })
      addToast('info', 'Retiré de la file')
    } catch (error) {
      console.error('Erreur remove:', error)
      addToast('error', 'Erreur', 'Suppression échouée')
      await loadStats(true) // Resync en cas d'erreur
    }
    
    // Débloquer le polling après 2s
    modifyTimeoutRef.current = setTimeout(() => {
      setIsModifying(false)
      loadStats(true)
    }, 2000)
  }

  // Nettoyage des doublons
  async function cleanupDuplicates() {
    setIsModifying(true)
    try {
      const response = await fetch('/api/admin/transcode-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-duplicates' }),
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success) {
        addToast('success', 'Nettoyage terminé', data.message)
        await loadStats(true)
      } else {
        addToast('error', 'Erreur', 'Nettoyage échoué')
      }
    } catch (error) {
      console.error('Erreur nettoyage:', error)
      addToast('error', 'Erreur', 'Nettoyage échoué')
    } finally {
      setIsModifying(false)
    }
  }

  // Déplacer un job à une position spécifique
  async function moveJobToPosition(jobId: string, newPosition: number) {
    const currentIndex = queue.findIndex(j => j.id === jobId)
    if (currentIndex === -1) return
    
    // Valider la position (1-indexed pour l'utilisateur)
    const targetIndex = Math.max(0, Math.min(newPosition - 1, queue.length - 1))
    if (targetIndex === currentIndex) return
    
    setIsModifying(true)
    if (modifyTimeoutRef.current) clearTimeout(modifyTimeoutRef.current)
    
    // Mise à jour optimiste
    const newQueue = [...queue]
    const [job] = newQueue.splice(currentIndex, 1)
    newQueue.splice(targetIndex, 0, job)
    setQueue(newQueue)
    
    // Envoyer au serveur
    const newOrder = newQueue.map(j => j.id)
    try {
      await fetch('/api/admin/transcode-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', jobIds: newOrder }),
        credentials: 'include'
      })
      addToast('success', 'Position modifiée', `Déplacé en position ${targetIndex + 1}`)
    } catch (error) {
      console.error('Erreur déplacement:', error)
      addToast('error', 'Erreur', 'Déplacement échoué')
      await loadStats(true)
    }
    
    setMoveModal(null)
    setTargetPosition('')
    
    modifyTimeoutRef.current = setTimeout(() => {
      setIsModifying(false)
      loadStats(true)
    }, 2000)
  }
  
  // Monter/descendre d'une position
  async function moveJobBy(jobId: string, delta: number) {
    const currentIndex = queue.findIndex(j => j.id === jobId)
    if (currentIndex === -1) return
    const newPosition = currentIndex + 1 + delta // 1-indexed
    if (newPosition < 1 || newPosition > queue.length) return
    await moveJobToPosition(jobId, newPosition)
  }

  // Drag and Drop handlers avec auto-scroll
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
    const target = e.target as HTMLElement
    target.style.opacity = '0.5'
  }

  function handleDragEnd(e: React.DragEvent) {
    const target = e.target as HTMLElement
    target.style.opacity = '1'
    setDraggedIndex(null)
    setDragOverIndex(null)
    // Arrêter l'auto-scroll
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current)
      scrollIntervalRef.current = null
    }
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIndex !== index) {
      setDragOverIndex(index)
    }
    
    // Auto-scroll vers le haut ou le bas
    const container = queueListRef.current
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const scrollZone = 60 // pixels depuis le bord pour déclencher le scroll
    const scrollSpeed = 8
    
    // Arrêter le scroll précédent
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current)
      scrollIntervalRef.current = null
    }
    
    if (e.clientY < rect.top + scrollZone && container.scrollTop > 0) {
      // Scroll vers le haut
      scrollIntervalRef.current = setInterval(() => {
        container.scrollTop -= scrollSpeed
      }, 16)
    } else if (e.clientY > rect.bottom - scrollZone && container.scrollTop < container.scrollHeight - container.clientHeight) {
      // Scroll vers le bas
      scrollIntervalRef.current = setInterval(() => {
        container.scrollTop += scrollSpeed
      }, 16)
    }
  }

  function handleDragLeave() {
    setDragOverIndex(null)
  }

  async function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    // Bloquer le polling
    setIsModifying(true)
    if (modifyTimeoutRef.current) clearTimeout(modifyTimeoutRef.current)

    // Mise à jour optimiste immédiate
    const newQueue = [...queue]
    const [draggedItem] = newQueue.splice(draggedIndex, 1)
    newQueue.splice(dropIndex, 0, draggedItem)
    setQueue(newQueue)

    // Envoyer le nouvel ordre au serveur
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
      console.error('Erreur reorder:', error)
      addToast('error', 'Erreur', 'Réorganisation échouée')
      await loadStats(true) // Resync en cas d'erreur
    }

    setDraggedIndex(null)
    setDragOverIndex(null)

    // Débloquer le polling après 2s
    modifyTimeoutRef.current = setTimeout(() => {
      setIsModifying(false)
      loadStats(true)
    }, 2000)
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

      {/* Jobs en cours (support multi-transcodage) */}
      {stats?.activeJobs && stats.activeJobs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
            🔄 {stats.activeCount || stats.activeJobs.length}/{stats.maxConcurrent || 2} transcodes actifs
          </div>
          {stats.activeJobs.map((job, index) => (
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
      )}
      {/* Fallback pour ancien format (1 seul job) */}
      {stats?.currentJob && !stats?.activeJobs && (
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

      {/* Queue - Design Pro Simplifié */}
      <div className={styles.queueContainer}>
        <div className={styles.queueHeader}>
          <div className={styles.queueHeaderLeft}>
            <div className={styles.queueIcon}>
              <Clock size={20} />
            </div>
            <div>
              <h3 className={styles.queueTitle}>File d&apos;attente</h3>
              <p className={styles.queueSubtitle}>
                {queue.length} fichier{queue.length > 1 ? 's' : ''} en attente
                {isModifying && <span style={{ marginLeft: 8, color: '#fbbf24' }}>• Modification...</span>}
              </p>
            </div>
          </div>
          <div className={styles.queueHeaderActions}>
            <button
              className={styles.btnCleanup}
              onClick={cleanupDuplicates}
              disabled={isModifying || queue.length === 0}
              title="Nettoyer les doublons"
            >
              <RefreshCw size={14} />
              Nettoyer doublons
            </button>
          </div>
        </div>
        
        {queue.length > 0 ? (
          <>
            <div className={styles.queueList} ref={queueListRef}>
              {queue.slice(0, 50).map((job, i) => (
                <div 
                  key={job.id} 
                  className={`${styles.queueItem} ${isModifying ? styles.queueItemModifying : ''} ${draggedIndex === i ? styles.queueItemDragging : ''} ${dragOverIndex === i ? styles.queueItemDragOver : ''}`}
                  draggable={!isModifying}
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, i)}
                >
                  <div className={styles.queueItemDragHandle} title="Glisser pour réorganiser">
                    <span>⋮⋮</span>
                  </div>
                  
                  {/* Position cliquable pour ouvrir le modal */}
                  <button 
                    className={styles.queueItemPositionBtn}
                    onClick={() => {
                      setMoveModal({ jobId: job.id, filename: job.filename, currentIndex: i })
                      setTargetPosition((i + 1).toString())
                    }}
                    title="Cliquer pour déplacer à une position spécifique"
                    disabled={isModifying}
                  >
                    {i + 1}
                  </button>
                  
                  <div className={styles.queueItemContent}>
                    <div className={styles.queueItemTitle}>{job.filename}</div>
                    <div className={styles.queueItemMeta}>
                      {job.fileSize && (
                        <span>
                          <HardDrive size={12} />
                          {(job.fileSize / (1024 * 1024 * 1024)).toFixed(1)} Go
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className={styles.queueItemActions}>
                    {/* Monter d'une position */}
                    {i > 0 && (
                      <button 
                        className={`${styles.queueActionBtn} ${styles.secondary}`}
                        onClick={() => moveJobBy(job.id, -1)} 
                        title="Monter d'une position"
                        disabled={isModifying}
                      >
                        <ChevronUp size={16} />
                      </button>
                    )}
                    {/* Descendre d'une position */}
                    {i < queue.length - 1 && (
                      <button 
                        className={`${styles.queueActionBtn} ${styles.secondary}`}
                        onClick={() => moveJobBy(job.id, 1)} 
                        title="Descendre d'une position"
                        disabled={isModifying}
                      >
                        <ChevronDown size={16} />
                      </button>
                    )}
                    {/* Passer en priorité (premier) */}
                    {i > 0 && (
                      <button 
                        className={`${styles.queueActionBtn} ${styles.primary}`}
                        onClick={() => moveJobToTop(job.id)} 
                        title="Passer en priorité (position 1)"
                        disabled={isModifying}
                      >
                        <ChevronsUp size={16} />
                      </button>
                    )}
                    {/* Supprimer */}
                    <button 
                      className={`${styles.queueActionBtn} ${styles.danger}`}
                      onClick={() => removeFromQueue(job.id, job.filename)} 
                      title="Retirer de la file"
                      disabled={isModifying}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  <span className={`${styles.queueItemStatus} ${job.status === 'failed' ? styles.failed : styles.pending}`}>
                    {job.status === 'pending' ? 'Attente' : 'Échec'}
                  </span>
                </div>
              ))}
            </div>
            
            {queue.length > 50 && (
              <div className={styles.queueFooter}>
                <span>Affichage des 50 premiers sur {queue.length}</span>
              </div>
            )}
          </>
        ) : (
          <div className={styles.queueEmpty}>
            <div className={styles.queueEmptyIcon}>
              <Check size={32} />
            </div>
            <p className={styles.queueEmptyTitle}>File d&apos;attente vide</p>
            <p className={styles.queueEmptyText}>
              Tous les fichiers ont été transcodés ou aucun nouveau fichier détecté
            </p>
          </div>
        )}
      </div>
      
      {/* Modal de déplacement vers position */}
      {moveModal && (
        <div className={styles.modalOverlay} onClick={() => setMoveModal(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Déplacer vers une position</h3>
              <button className={styles.modalClose} onClick={() => setMoveModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalFilename}>{moveModal.filename}</p>
              <p className={styles.modalCurrentPos}>
                Position actuelle : <strong>{moveModal.currentIndex + 1}</strong> / {queue.length}
              </p>
              
              <div className={styles.positionInputGroup}>
                <label htmlFor="targetPosition">Nouvelle position :</label>
                <input
                  id="targetPosition"
                  type="number"
                  min="1"
                  max={queue.length}
                  value={targetPosition}
                  onChange={(e) => setTargetPosition(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const pos = parseInt(targetPosition)
                      if (pos >= 1 && pos <= queue.length) {
                        moveJobToPosition(moveModal.jobId, pos)
                      }
                    }
                  }}
                  autoFocus
                  className={styles.positionInput}
                />
                <span className={styles.positionMax}>/ {queue.length}</span>
              </div>
              
              {/* Raccourcis rapides */}
              <div className={styles.quickPositions}>
                <button 
                  className={styles.quickPosBtn}
                  onClick={() => moveJobToPosition(moveModal.jobId, 1)}
                  disabled={moveModal.currentIndex === 0}
                >
                  <ChevronsUp size={14} /> Premier
                </button>
                <button 
                  className={styles.quickPosBtn}
                  onClick={() => moveJobToPosition(moveModal.jobId, Math.ceil(queue.length / 2))}
                >
                  Milieu
                </button>
                <button 
                  className={styles.quickPosBtn}
                  onClick={() => moveJobToPosition(moveModal.jobId, queue.length)}
                  disabled={moveModal.currentIndex === queue.length - 1}
                >
                  Dernier <ChevronsDown size={14} />
                </button>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button 
                className={styles.btnSecondary}
                onClick={() => setMoveModal(null)}
              >
                Annuler
              </button>
              <button 
                className={styles.btnPrimary}
                onClick={() => {
                  const pos = parseInt(targetPosition)
                  if (pos >= 1 && pos <= queue.length) {
                    moveJobToPosition(moveModal.jobId, pos)
                  }
                }}
                disabled={!targetPosition || parseInt(targetPosition) < 1 || parseInt(targetPosition) > queue.length}
              >
                Déplacer
              </button>
            </div>
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
// SECTION GÉNÉRIQUES (CREDITS SETTINGS)
// ============================================

interface SeriesWithSeasons {
  show_name: string
  poster_url?: string
  seasons: number[]
  totalEpisodes: number
}

interface CreditsSetting {
  id: string
  show_name: string
  season_number: number | null
  credits_duration: number
  timing_source: 'manual' | 'auto' | 'chapters'
  updated_at: string
}

function CreditsSettingsView() {
  const [series, setSeries] = useState<SeriesWithSeasons[]>([])
  const [settings, setSettings] = useState<CreditsSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'configured' | 'unconfigured'>('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set())
  const [editingValue, setEditingValue] = useState<{ showName: string; season: number | null; value: string } | null>(null)
  
  const { addToast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Charger les séries et les settings en parallèle
      const [seriesRes, settingsRes] = await Promise.all([
        fetch('/api/series/list'),
        fetch('/api/admin/credits-settings')
      ])
      
      const seriesData = await seriesRes.json()
      const settingsData = await settingsRes.json()
      
      if (seriesData.success) {
        // Transformer les données pour avoir show_name unique avec les saisons
        const seriesMap = new Map<string, SeriesWithSeasons>()
        
        for (const s of seriesData.series || []) {
          if (!seriesMap.has(s.title)) {
            seriesMap.set(s.title, {
              show_name: s.title,
              poster_url: s.poster_url,
              seasons: s.seasons?.map((season: { season: number }) => season.season) || [],
              totalEpisodes: s.totalEpisodes || 0
            })
          }
        }
        
        setSeries(Array.from(seriesMap.values()).sort((a, b) => a.show_name.localeCompare(b.show_name)))
      }
      
      if (settingsData.success) {
        setSettings(settingsData.settings || [])
      }
    } catch (error) {
      console.error('Erreur chargement données génériques:', error)
      addToast('error', 'Erreur', 'Impossible de charger les données')
    } finally {
      setLoading(false)
    }
  }

  // Obtenir la durée configurée pour une série/saison
  function getConfiguredDuration(showName: string, seasonNumber: number | null): CreditsSetting | undefined {
    return settings.find(s => s.show_name === showName && s.season_number === seasonNumber)
  }

  // Vérifier si une série a au moins un setting
  function hasAnySetting(showName: string): boolean {
    return settings.some(s => s.show_name === showName)
  }

  // Sauvegarder un setting
  async function saveSetting(showName: string, seasonNumber: number | null, duration: number) {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/credits-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          show_name: showName,
          season_number: seasonNumber,
          credits_duration: duration,
          timing_source: 'manual'
        }),
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        // Mettre à jour le state local
        setSettings(prev => {
          const existing = prev.findIndex(s => s.show_name === showName && s.season_number === seasonNumber)
          if (existing >= 0) {
            const updated = [...prev]
            updated[existing] = data.setting
            return updated
          }
          return [...prev, data.setting]
        })
        addToast('success', 'Enregistré', `${showName} ${seasonNumber ? `S${seasonNumber}` : '(défaut)'}: ${duration}s`)
      } else {
        addToast('error', 'Erreur', 'Impossible de sauvegarder')
      }
    } catch (error) {
      addToast('error', 'Erreur', 'Erreur de connexion')
    } finally {
      setSaving(false)
      setEditingValue(null)
    }
  }

  // Supprimer un setting
  async function deleteSetting(showName: string, seasonNumber: number | null) {
    if (!confirm(`Supprimer le paramètre pour ${showName} ${seasonNumber ? `S${seasonNumber}` : '(défaut)'} ?`)) return
    
    try {
      const params = new URLSearchParams({ show_name: showName })
      if (seasonNumber !== null) params.append('season_number', seasonNumber.toString())
      
      const response = await fetch(`/api/admin/credits-settings?${params.toString()}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (response.ok) {
        setSettings(prev => prev.filter(s => !(s.show_name === showName && s.season_number === seasonNumber)))
        addToast('success', 'Supprimé', `Paramètre supprimé`)
      }
    } catch (error) {
      addToast('error', 'Erreur', 'Impossible de supprimer')
    }
  }

  // Formater les secondes en MM:SS
  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Parser MM:SS en secondes
  function parseDuration(value: string): number | null {
    // Accepter "90" ou "1:30" ou "01:30"
    if (/^\d+$/.test(value)) {
      return parseInt(value)
    }
    const match = value.match(/^(\d+):(\d{2})$/)
    if (match) {
      return parseInt(match[1]) * 60 + parseInt(match[2])
    }
    return null
  }

  // Filtrer les séries
  const filteredSeries = series.filter(s => {
    if (searchFilter && !s.show_name.toLowerCase().includes(searchFilter.toLowerCase())) return false
    if (filter === 'configured' && !hasAnySetting(s.show_name)) return false
    if (filter === 'unconfigured' && hasAnySetting(s.show_name)) return false
    return true
  })

  // Compter les séries configurées
  const configuredCount = series.filter(s => hasAnySetting(s.show_name)).length
  const unconfiguredCount = series.length - configuredCount

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
          <h2 className={styles.sectionTitle}>Paramètres des génériques</h2>
          <p className={styles.sectionSubtitle}>
            Définir la durée du générique par série (avec override par saison si nécessaire)
          </p>
        </div>
        <button className={styles.btnIcon} onClick={loadData}>
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Filtres */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <button
            className={`${styles.filterBtn} ${filter === 'unconfigured' ? styles.active : ''}`}
            onClick={() => setFilter('unconfigured')}
          >
            À configurer ({unconfiguredCount})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'configured' ? styles.active : ''}`}
            onClick={() => setFilter('configured')}
          >
            Configurés ({configuredCount})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => setFilter('all')}
          >
            Tous ({series.length})
          </button>
        </div>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Rechercher une série..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Liste des séries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredSeries.map(s => {
          const isExpanded = expandedSeries.has(s.show_name)
          const defaultSetting = getConfiguredDuration(s.show_name, null)
          const hasConfig = hasAnySetting(s.show_name)
          
          return (
            <div key={s.show_name} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, overflow: 'hidden' }}>
              {/* Ligne principale */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12, 
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onClick={() => setExpandedSeries(prev => {
                  const next = new Set(prev)
                  if (next.has(s.show_name)) next.delete(s.show_name)
                  else next.add(s.show_name)
                  return next
                })}
              >
                {/* Poster miniature */}
                <div style={{ width: 40, height: 60, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.05)' }}>
                  {s.poster_url ? (
                    <img src={s.poster_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                      <Tv size={16} />
                    </div>
                  )}
                </div>

                {/* Infos */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.show_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    {s.seasons.length} saison{s.seasons.length > 1 ? 's' : ''} · {s.totalEpisodes} épisodes
                  </div>
                </div>

                {/* Durée par défaut */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingValue?.showName === s.show_name && editingValue?.season === null ? (
                    <input
                      type="text"
                      autoFocus
                      defaultValue={defaultSetting ? formatDuration(defaultSetting.credits_duration) : ''}
                      placeholder="1:30"
                      style={{ 
                        width: 60, 
                        padding: '4px 8px', 
                        background: 'rgba(255,255,255,0.1)', 
                        border: '1px solid rgba(255,255,255,0.2)', 
                        borderRadius: 4, 
                        color: 'white',
                        textAlign: 'center'
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const duration = parseDuration((e.target as HTMLInputElement).value)
                          if (duration !== null && duration >= 0) {
                            saveSetting(s.show_name, null, duration)
                          } else {
                            addToast('error', 'Format invalide', 'Utilisez "90" ou "1:30"')
                          }
                        } else if (e.key === 'Escape') {
                          setEditingValue(null)
                        }
                      }}
                      onBlur={() => setEditingValue(null)}
                    />
                  ) : (
                    <div 
                      style={{ 
                        padding: '4px 12px', 
                        background: hasConfig ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)', 
                        borderRadius: 4,
                        color: hasConfig ? '#22c55e' : 'rgba(255,255,255,0.5)',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        minWidth: 50,
                        textAlign: 'center'
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingValue({ showName: s.show_name, season: null, value: '' })
                      }}
                    >
                      {defaultSetting ? formatDuration(defaultSetting.credits_duration) : '—'}
                    </div>
                  )}
                  
                  {defaultSetting && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSetting(s.show_name, null) }}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 4 }}
                    >
                      <X size={14} />
                    </button>
                  )}
                  
                  <ChevronRight 
                    size={16} 
                    style={{ 
                      color: 'rgba(255,255,255,0.3)', 
                      transform: isExpanded ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.2s'
                    }} 
                  />
                </div>
              </div>

              {/* Saisons (expanded) */}
              {isExpanded && s.seasons.length > 0 && (
                <div style={{ padding: '0 16px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Override par saison
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {s.seasons.sort((a, b) => a - b).map(season => {
                      const seasonSetting = getConfiguredDuration(s.show_name, season)
                      const isEditing = editingValue?.showName === s.show_name && editingValue?.season === season
                      
                      return (
                        <div key={season} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', width: 24 }}>S{season}</span>
                          {isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              defaultValue={seasonSetting ? formatDuration(seasonSetting.credits_duration) : ''}
                              placeholder="1:30"
                              style={{ 
                                width: 50, 
                                padding: '2px 6px', 
                                background: 'rgba(255,255,255,0.1)', 
                                border: '1px solid rgba(255,255,255,0.2)', 
                                borderRadius: 4, 
                                color: 'white',
                                textAlign: 'center',
                                fontSize: 12
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const duration = parseDuration((e.target as HTMLInputElement).value)
                                  if (duration !== null && duration >= 0) {
                                    saveSetting(s.show_name, season, duration)
                                  } else {
                                    addToast('error', 'Format invalide', 'Utilisez "90" ou "1:30"')
                                  }
                                } else if (e.key === 'Escape') {
                                  setEditingValue(null)
                                }
                              }}
                              onBlur={() => setEditingValue(null)}
                            />
                          ) : (
                            <div 
                              style={{ 
                                padding: '2px 8px', 
                                background: seasonSetting ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', 
                                borderRadius: 4,
                                color: seasonSetting ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                                fontSize: 12,
                                cursor: 'pointer',
                                minWidth: 40,
                                textAlign: 'center'
                              }}
                              onClick={() => setEditingValue({ showName: s.show_name, season, value: '' })}
                            >
                              {seasonSetting ? formatDuration(seasonSetting.credits_duration) : '—'}
                            </div>
                          )}
                          {seasonSetting && (
                            <button
                              onClick={() => deleteSetting(s.show_name, season)}
                              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 2 }}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filteredSeries.length === 0 && (
          <p className={styles.emptyText}>Aucune série trouvée</p>
        )}
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

// ============================================
// UTILISATEURS
// ============================================

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

function UsersView() {
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
