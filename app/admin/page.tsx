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

import { useState, useEffect, useCallback, useRef } from 'react'
import Header from '@/components/Header/Header'
import { 
  LayoutDashboard, 
  FolderSearch, 
  Image as ImageIcon, 
  Film, 
  BarChart3, 
  Users,
  Clock,
  Activity,
  HardDrive,
  Menu
} from 'lucide-react'
import styles from './admin.module.css'

// Types partagés
import type { AdminView, SystemStatus, DashboardStats } from '@/types/admin'

// Système de toast
import { useToast, ToastContainer, ToastContext } from '@/components/admin/Toast/Toast'

// Vues admin
import { DashboardView } from '@/components/admin/views/DashboardView'
import { ScanView } from '@/components/admin/views/ScanView'
import { LibraryView } from '@/components/admin/views/LibraryView'
import { PostersView } from '@/components/admin/views/PostersView'
import { CreditsSettingsView } from '@/components/admin/views/CreditsSettingsView'
import { TranscodeView } from '@/components/admin/views/TranscodeView'
import { StatsView } from '@/components/admin/views/StatsView'
import { ActivityView } from '@/components/admin/views/ActivityView'
import { UsersView } from '@/components/admin/views/UsersView'

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
        console.error('[ADMIN] Erreur chargement dashboard:', error)
      }
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [])

  // Polling intelligent : plus rapide si transcodage actif, désactivé si pas sur le dashboard
  useEffect(() => {
    loadDashboardData(true)
    
    // Ne pas faire de polling si on n'est pas sur le dashboard
    if (view !== 'dashboard') {
      return
    }
    
    // Polling adaptatif : 5s si transcodage actif, 15s sinon
    const getInterval = () => status.transcodingActive ? 5000 : 15000
    
    const interval = setInterval(() => loadDashboardData(), getInterval())
    
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
