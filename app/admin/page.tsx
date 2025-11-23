/**
 * Page d'administration LEON - Version 2
 * Design épuré et organisé par sections
 */

'use client'

import { useState } from 'react'
import Header from '@/components/Header/Header'
import { FolderSearch, Image, HardDrive, BarChart3, Search, RefreshCw, Trash2 } from 'lucide-react'
import styles from './admin.module.css'

// Sections de la page admin
type AdminSection = 'scan' | 'cache' | 'validation' | 'stats'

export default function AdminPageV2() {
  const [activeSection, setActiveSection] = useState<AdminSection>('scan')

  return (
    <div className={styles.container}>
      <Header />
      
      <div className={styles.content}>
        {/* Navigation latérale */}
        <nav className={styles.sidebar}>
          <h1 className={styles.title}>Administration</h1>
          
          <div className={styles.nav}>
            <button
              className={`${styles.navItem} ${activeSection === 'scan' ? styles.active : ''}`}
              onClick={() => setActiveSection('scan')}
            >
              <FolderSearch className={styles.icon} size={20} strokeWidth={1.5} />
              Scanner les films
            </button>
            
            <button
              className={`${styles.navItem} ${activeSection === 'validation' ? styles.active : ''}`}
              onClick={() => setActiveSection('validation')}
            >
              <Image className={styles.icon} size={20} strokeWidth={1.5} />
              Validation posters
            </button>
            
            <button
              className={`${styles.navItem} ${activeSection === 'cache' ? styles.active : ''}`}
              onClick={() => setActiveSection('cache')}
            >
              <HardDrive className={styles.icon} size={20} strokeWidth={1.5} />
              Gestion du cache
            </button>
            
            <button
              className={`${styles.navItem} ${activeSection === 'stats' ? styles.active : ''}`}
              onClick={() => setActiveSection('stats')}
            >
              <BarChart3 className={styles.icon} size={20} strokeWidth={1.5} />
              Statistiques
            </button>
          </div>
        </nav>

        {/* Contenu principal */}
        <main className={styles.main}>
          {activeSection === 'scan' && <ScanSection />}
          {activeSection === 'validation' && <ValidationSection />}
          {activeSection === 'cache' && <CacheSection />}
          {activeSection === 'stats' && <StatsSection />}
        </main>
      </div>
    </div>
  )
}

/**
 * Section: Scanner les films
 */
function ScanSection() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function handleScan() {
    try {
      setScanning(true)
      setResult(null)
      
      const response = await fetch('/api/scan', {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error('Erreur scan')
      }
      
      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors du scan')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Scanner les films</h2>
      <p className={styles.sectionDesc}>
        Analyse le dossier <code>/films</code> pour détecter les nouveaux films
      </p>

      <div className={styles.actions}>
        <button
          className={styles.primaryButton}
          onClick={handleScan}
          disabled={scanning}
        >
          {scanning ? (
            <>
              <RefreshCw size={16} className={styles.spinning} />
              Scan en cours...
            </>
          ) : (
            <>
              <Search size={16} />
              Lancer le scan
            </>
          )}
        </button>
      </div>

      {result && (
        <div className={styles.resultCard}>
          <h3>Scan terminé</h3>
          <div className={styles.stats}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{result.stats?.total || 0}</span>
              <span className={styles.statLabel}>Fichiers analysés</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{result.stats?.new || 0}</span>
              <span className={styles.statLabel}>Nouveaux films</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{result.stats?.updated || 0}</span>
              <span className={styles.statLabel}>Mis à jour</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{result.stats?.skipped || 0}</span>
              <span className={styles.statLabel}>Ignorés</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Section: Validation des posters
 */
function ValidationSection() {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Validation des posters</h2>
      <p className={styles.sectionDesc}>
        Valider ou rechercher des affiches alternatives pour les films
      </p>
      
      {/* TODO: Réutiliser le composant MediaValidator existant avec un meilleur design */}
      <div className={styles.placeholder}>
        <p>Section en cours de migration...</p>
        <p>Cette fonctionnalité sera disponible prochainement</p>
      </div>
    </div>
  )
}

/**
 * Section: Gestion du cache
 */
function CacheSection() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)

  async function loadStats() {
    try {
      setLoading(true)
      const response = await fetch('/api/cache/stats')
      const data = await response.json()
      setStats(data.stats)
    } catch (error) {
      console.error('Erreur chargement stats:', error)
    } finally {
      setLoading(false)
    }
  }

  async function clearCache() {
    if (!confirm('Vider le cache ? Cette action est irréversible.')) {
      return
    }

    try {
      setClearing(true)
      const response = await fetch('/api/cache/clear', {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        alert(`✅ Cache vidé : ${data.deleted.files} segments supprimés (${data.deleted.sizeGB}GB)`)
        loadStats() // Recharger les stats
      }
    } catch (error) {
      console.error('Erreur vidage cache:', error)
      alert('❌ Erreur lors du vidage du cache')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Gestion du cache HLS</h2>
      <p className={styles.sectionDesc}>
        Cache des segments vidéo transcodés pour un démarrage plus rapide
      </p>

      <div className={styles.actions}>
        <button
          className={styles.secondaryButton}
          onClick={loadStats}
          disabled={loading}
        >
          {loading ? (
            <>
              <RefreshCw size={16} className={styles.spinning} />
              Chargement...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              Rafraîchir
            </>
          )}
        </button>
        
        <button
          className={styles.dangerButton}
          onClick={clearCache}
          disabled={clearing}
        >
          {clearing ? (
            <>
              <RefreshCw size={16} className={styles.spinning} />
              Suppression...
            </>
          ) : (
            <>
              <Trash2 size={16} />
              Vider le cache
            </>
          )}
        </button>
      </div>

      {stats && (
        <div className={styles.resultCard}>
          <h3>Statistiques du cache</h3>
          <div className={styles.stats}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{stats.totalSizeGB}</span>
              <span className={styles.statLabel}>GB utilisés</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{stats.totalFiles}</span>
              <span className={styles.statLabel}>Segments en cache</span>
            </div>
          </div>

          {stats.oldestFile && (
            <div className={styles.cacheInfo}>
              <p><strong>Segment le plus ancien :</strong> {new Date(stats.oldestFile).toLocaleDateString('fr-FR')}</p>
              <p><strong>Segment le plus récent :</strong> {new Date(stats.newestFile).toLocaleDateString('fr-FR')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Section: Statistiques globales
 */
function StatsSection() {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Statistiques globales</h2>
      <p className={styles.sectionDesc}>
        Vue d'ensemble de la bibliothèque LEON
      </p>
      
      <div className={styles.placeholder}>
        <p>Section à venir...</p>
        <p>Films totaux, espace disque, films les plus regardés, etc.</p>
      </div>
    </div>
  )
}

