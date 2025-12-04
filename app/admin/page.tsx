/**
 * Page d'administration LEON - Version 2
 * Design épuré et organisé par sections
 */

'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Header from '@/components/Header/Header'
import { FolderSearch, Image as ImageIcon, HardDrive, BarChart3, Search, RefreshCw, Trash2, Check, X, ChevronLeft, ChevronRight, RotateCcw, Edit3, Filter, Film, Play, Pause, Square, Eye } from 'lucide-react'
import styles from './admin.module.css'

// Sections de la page admin
type AdminSection = 'scan' | 'cache' | 'posters' | 'transcode' | 'stats'

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
              className={`${styles.navItem} ${activeSection === 'posters' ? styles.active : ''}`}
              onClick={() => setActiveSection('posters')}
            >
              <ImageIcon className={styles.icon} size={20} strokeWidth={1.5} />
              Gestion des affiches
            </button>
            
            <button
              className={`${styles.navItem} ${activeSection === 'cache' ? styles.active : ''}`}
              onClick={() => setActiveSection('cache')}
            >
              <HardDrive className={styles.icon} size={20} strokeWidth={1.5} />
              Gestion du cache
            </button>
            
            <button
              className={`${styles.navItem} ${activeSection === 'transcode' ? styles.active : ''}`}
              onClick={() => setActiveSection('transcode')}
            >
              <Film className={styles.icon} size={20} strokeWidth={1.5} />
              Pré-transcodage
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
          {activeSection === 'posters' && <PostersSection />}
          {activeSection === 'cache' && <CacheSection />}
          {activeSection === 'transcode' && <TranscodeSection />}
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
 * Section: Gestion des affiches
 * Version unifiée avec filtre pour tous les films ou seulement ceux à valider
 */
interface MediaToValidate {
  id: string
  title: string
  year?: number
  poster_url?: string
  tmdb_id?: number
  file_path: string
}

interface TMDBResult {
  id: number
  title: string
  release_date: string
  poster_path: string
  overview: string
  vote_average: number
}

type PosterFilter = 'all' | 'to-validate'

function PostersSection() {
  const [allMovies, setAllMovies] = useState<MediaToValidate[]>([])
  const [filteredMovies, setFilteredMovies] = useState<MediaToValidate[]>([])
  const [loading, setLoading] = useState(true)
  const [posterFilter, setPosterFilter] = useState<PosterFilter>('to-validate')
  const [searchFilter, setSearchFilter] = useState('')
  const [selectedMovie, setSelectedMovie] = useState<MediaToValidate | null>(null)
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<TMDBResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadAllMovies()
  }, [])

  useEffect(() => {
    // Filtrer en fonction du filtre poster (tous ou à valider)
    let movies = allMovies
    
    if (posterFilter === 'to-validate') {
      movies = allMovies.filter((m: MediaToValidate) => 
        !m.poster_url || 
        m.poster_url.includes('placeholder') ||
        !m.tmdb_id
      )
    }
    
    // Puis filtrer par recherche
    if (searchFilter.trim() === '') {
      setFilteredMovies(movies)
    } else {
      const filtered = movies.filter(m => 
        m.title.toLowerCase().includes(searchFilter.toLowerCase())
      )
      setFilteredMovies(filtered)
    }
  }, [searchFilter, allMovies, posterFilter])

  async function loadAllMovies() {
    try {
      setLoading(true)
      const response = await fetch('/api/media/grouped?type=movie')
      const data = await response.json()
      
      if (data.success) {
        const sorted = data.media.sort((a: MediaToValidate, b: MediaToValidate) => 
          a.title.localeCompare(b.title)
        )
        setAllMovies(sorted)
      }
    } catch (error) {
      console.error('Erreur chargement films:', error)
    } finally {
      setLoading(false)
    }
  }

  async function searchTMDB() {
    if (!selectedMovie) return
    
    setSearching(true)
    try {
      const query = searchQuery || selectedMovie.title
      const response = await fetch(`/api/admin/search-tmdb?query=${encodeURIComponent(query)}`)
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

  async function updatePoster(tmdbId: number) {
    if (!selectedMovie) return
    
    setSaving(true)
    try {
      const response = await fetch('/api/admin/update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: selectedMovie.id,
          tmdbId: tmdbId
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        // Fermer le modal et rafraîchir la liste
        setSelectedMovie(null)
        setSuggestions([])
        setSearchQuery('')
        await loadAllMovies()
        
        // Notification de succès
        alert('✅ Affiche mise à jour avec succès !')
      } else {
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
    setSuggestions([])
    setSearchQuery('')
  }

  if (loading) {
    return (
      <div className={styles.section}>
        <div className={styles.loadingState}>
          <RefreshCw size={32} className={styles.spinning} />
          <p>Chargement des films...</p>
        </div>
      </div>
    )
  }

  const toValidateCount = allMovies.filter(m => 
    !m.poster_url || m.poster_url.includes('placeholder') || !m.tmdb_id
  ).length

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Gestion des affiches</h2>
      <p className={styles.sectionDesc}>
        Valider ou modifier les affiches de vos films
      </p>

      {/* Filtres et barre de recherche */}
      <div className={styles.filterBar}>
        <div className={styles.posterFilters}>
          <button
            className={`${styles.filterButton} ${posterFilter === 'to-validate' ? styles.active : ''}`}
            onClick={() => setPosterFilter('to-validate')}
          >
            <X size={16} />
            À valider ({toValidateCount})
          </button>
          <button
            className={`${styles.filterButton} ${posterFilter === 'all' ? styles.active : ''}`}
            onClick={() => setPosterFilter('all')}
          >
            <Filter size={16} />
            Tous les films ({allMovies.length})
          </button>
        </div>
        
        <div className={styles.searchBar}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Rechercher un film..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className={styles.searchInput}
          />
          {searchFilter && (
            <button 
              onClick={() => setSearchFilter('')}
              className={styles.clearButton}
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        <div className={styles.resultCount}>
          {filteredMovies.length} film{filteredMovies.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Message si aucun film à valider */}
      {posterFilter === 'to-validate' && filteredMovies.length === 0 && (
        <div className={styles.successState}>
          <Check size={64} style={{ color: '#10b981' }} />
          <h3>Tous les films sont validés ! 🎉</h3>
          <p>Aucun film n&apos;a besoin de validation de poster.</p>
        </div>
      )}

      {/* Grille de films */}
      {filteredMovies.length > 0 && (
        <div className={styles.moviesGrid}>
          {filteredMovies.map((movie) => {
            const needsValidation = !movie.poster_url || movie.poster_url.includes('placeholder') || !movie.tmdb_id
            
            return (
              <div 
                key={movie.id}
                className={styles.movieCard}
                onClick={() => {
                  setSelectedMovie(movie)
                  setSearchQuery(movie.title)
                }}
              >
                <div className={styles.movieCardPoster}>
                  {movie.poster_url && !movie.poster_url.includes('placeholder') ? (
                    <Image
                      src={movie.poster_url}
                      alt={movie.title}
                      fill
                      sizes="200px"
                      style={{ objectFit: 'cover' }}
                      unoptimized
                    />
                  ) : (
                    <div className={styles.noPoster}>
                      <ImageIcon size={32} />
                    </div>
                  )}
                  {needsValidation && (
                    <div className={styles.validationBadge}>
                      <X size={16} />
                      À valider
                    </div>
                  )}
                </div>
                <div className={styles.movieCardInfo}>
                  <h4 className={styles.movieCardTitle}>{movie.title}</h4>
                  {movie.year && <p className={styles.movieCardYear}>{movie.year}</p>}
                </div>
                <div className={styles.editOverlay}>
                  <Edit3 size={24} />
                  <span>{needsValidation ? 'Valider l\'affiche' : 'Modifier l\'affiche'}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de validation */}
      {selectedMovie && (
        <div className={styles.modal} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={closeModal}>
              <X size={24} />
            </button>

            <div className={styles.modalLayout}>
              {/* Colonne gauche : Affiche actuelle */}
              <div className={styles.currentPoster}>
                <h3>Affiche actuelle</h3>
                <div className={styles.posterPreview}>
                  {selectedMovie.poster_url && !selectedMovie.poster_url.includes('placeholder') ? (
                    <Image
                      src={selectedMovie.poster_url}
                      alt={selectedMovie.title}
                      width={300}
                      height={450}
                      unoptimized
                      style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
                    />
                  ) : (
                    <div className={styles.noPosterLarge}>
                      <ImageIcon size={64} />
                      <p>Aucune affiche</p>
                    </div>
                  )}
                </div>
                <div className={styles.movieDetails}>
                  <h4>{selectedMovie.title}</h4>
                  {selectedMovie.year && <p>{selectedMovie.year}</p>}
                  <p className={styles.filePath}>{selectedMovie.file_path?.split('/').pop() || 'Fichier inconnu'}</p>
                </div>
              </div>

              {/* Colonne droite : Recherche TMDB */}
              <div className={styles.posterSearch}>
                <h3>Rechercher sur TMDB</h3>
                
                <div className={styles.searchBar}>
                  <input
                    type="text"
                    placeholder="Titre du film..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchTMDB()}
                    className={styles.searchInput}
                  />
                  <button 
                    onClick={searchTMDB}
                    disabled={searching || !searchQuery}
                    className={styles.searchButton}
                  >
                    {searching ? <RefreshCw size={16} className={styles.spinning} /> : <Search size={16} />}
                    Rechercher
                  </button>
                </div>

                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className={styles.suggestionGrid}>
                    {suggestions.map((movie) => (
                      <div 
                        key={movie.id}
                        className={styles.suggestionCard}
                        onClick={() => updatePoster(movie.id)}
                      >
                        {movie.poster_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                            alt={movie.title}
                            width={150}
                            height={225}
                            unoptimized
                            style={{ width: '100%', height: 'auto', borderRadius: '4px' }}
                          />
                        ) : (
                          <div className={styles.noPosterSmall}>
                            <X size={24} />
                          </div>
                        )}
                        <div className={styles.suggestionInfo}>
                          <p className={styles.suggestionTitle}>{movie.title}</p>
                          <p className={styles.suggestionYear}>{new Date(movie.release_date).getFullYear()}</p>
                          {movie.vote_average > 0 && (
                            <p className={styles.suggestionRating}>⭐ {movie.vote_average.toFixed(1)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {suggestions.length === 0 && !searching && (
                  <div className={styles.emptyState}>
                    <Search size={48} opacity={0.3} />
                    <p>Recherchez le film pour voir les suggestions TMDB</p>
                  </div>
                )}
              </div>
            </div>

            {/* Indicateur de sauvegarde */}
            {saving && (
              <div className={styles.savingOverlay}>
                <RefreshCw size={32} className={styles.spinning} />
                <p>Validation en cours...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Section: Pré-transcodage des films
 * Permet de transcoder les films à l'avance pour un seek instantané
 */
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

// Type pour les films transcodés
interface TranscodedFile {
  name: string
  folder: string
  transcodedAt: string
  segmentCount: number
  totalSize: number
}

function TranscodeSection() {
  const [stats, setStats] = useState<TranscodeStats | null>(null)
  const [queue, setQueue] = useState<TranscodeJob[]>([])
  const [transcoded, setTranscoded] = useState<TranscodedFile[]>([])
  const [watcher, setWatcher] = useState<{ isWatching: boolean; watchedDirs: number; knownFiles: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showTranscoded, setShowTranscoded] = useState(false)

  // Charger les stats au montage et toutes les 3 secondes
  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 3000)
    return () => clearInterval(interval)
  }, [])

  async function loadStats() {
    try {
      const response = await fetch('/api/transcode')
      const data = await response.json()
      setStats(data.stats)
      setQueue(data.queue || [])
      setWatcher(data.watcher || null)
      setTranscoded(data.transcoded || [])
    } catch (error) {
      console.error('Erreur chargement stats transcodage:', error)
    } finally {
      setLoading(false)
    }
  }

  async function performAction(action: string, extra?: Record<string, unknown>) {
    setActionLoading(action)
    try {
      const response = await fetch('/api/transcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra })
      })
      const data = await response.json()
      
      if (data.success) {
        await loadStats()
      } else {
        alert(`Erreur: ${data.error || 'Erreur inconnue'}`)
      }
    } catch (error) {
      console.error(`Erreur action ${action}:`, error)
      alert('Erreur lors de l\'action')
    } finally {
      setActionLoading(null)
    }
  }

  async function deleteTranscoded(folder: string, name: string) {
    if (!confirm(`Supprimer le film transcodé "${name}" ?\nCela libérera de l'espace disque mais le film devra être re-transcodé.`)) {
      return
    }
    
    try {
      const response = await fetch(`/api/transcode?folder=${encodeURIComponent(folder)}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.success) {
        await loadStats()
      } else {
        alert(`Erreur: ${data.error || 'Erreur suppression'}`)
      }
    } catch (error) {
      console.error('Erreur suppression:', error)
      alert('Erreur lors de la suppression')
    }
  }

  function formatTime(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return '--:--'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}min`
    }
    return `${minutes}min`
  }

  function formatTimeRemaining(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return 'Calcul en cours...'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `~${days} jour${days > 1 ? 's' : ''}`
    }
    if (hours > 0) {
      return `~${hours}h ${minutes}min`
    }
    return `~${minutes}min`
  }

  function formatDate(isoString: string | undefined): string {
    if (!isoString) return ''
    try {
      return new Date(isoString).toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return ''
    }
  }

  function formatSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
  }

  if (loading) {
    return (
      <div className={styles.section}>
        <div className={styles.loadingState}>
          <RefreshCw size={32} className={styles.spinning} />
          <p>Chargement...</p>
        </div>
      </div>
    )
  }

  const progressPercent = stats?.currentJob?.progress || 0

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Pré-transcodage des films</h2>
      <p className={styles.sectionDesc}>
        Transcoder les films à l&apos;avance pour un <strong>seek instantané</strong> sur toute la timeline.
        Les derniers films ajoutés sont toujours transcodés en premier.
      </p>

      {/* Statut du système */}
      <div className={styles.statusBar}>
        <div className={styles.statusItem}>
          <span className={`${styles.statusDot} ${stats?.isRunning && !stats?.isPaused ? styles.active : ''}`} />
          <span>Transcodage: {stats?.isRunning ? (stats?.isPaused ? 'En pause' : 'Actif') : 'Arrêté'}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={`${styles.statusDot} ${watcher?.isWatching ? styles.active : ''}`} />
          <span>Watcher: {watcher?.isWatching ? 'Actif' : 'Inactif'}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={`${styles.statusDot} ${stats?.autoStartEnabled ? styles.active : ''}`} />
          <span>Auto-reprise: {stats?.autoStartEnabled ? 'Activée' : 'Désactivée'}</span>
        </div>
      </div>

      {/* Statistiques globales */}
      <div className={styles.resultCard}>
        <h3>Progression globale</h3>
        <div className={styles.stats}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats?.completedFiles || 0}</span>
            <span className={styles.statLabel}>Films transcodés</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats?.pendingFiles || 0}</span>
            <span className={styles.statLabel}>En attente</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats?.failedFiles || 0}</span>
            <span className={styles.statLabel}>Échecs</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats?.diskUsage || 'N/A'}</span>
            <span className={styles.statLabel}>Espace utilisé</span>
          </div>
        </div>

        {/* Barre de progression globale */}
        {stats && stats.totalFiles > 0 && (
          <div className={styles.globalProgress}>
            <div className={styles.progressLabel}>
              <span>{stats.completedFiles} / {stats.totalFiles} films</span>
              <span>{Math.round((stats.completedFiles / stats.totalFiles) * 100)}%</span>
            </div>
            <div className={styles.progressBarContainer}>
              <div 
                className={styles.progressBarFill}
                style={{ width: `${(stats.completedFiles / stats.totalFiles) * 100}%` }}
              />
            </div>
            {stats.estimatedTimeRemaining && (
              <p className={styles.timeRemaining}>
                Temps restant estimé : {formatTimeRemaining(stats.estimatedTimeRemaining)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Film en cours de transcodage */}
      {stats?.currentJob && (
        <div className={styles.resultCard}>
          <h3>En cours de transcodage</h3>
          <div className={styles.currentJob}>
            <div className={styles.jobInfo}>
              <Film size={24} />
              <div>
                <p className={styles.jobTitle}>{stats.currentJob.filename}</p>
                <p className={styles.jobMeta}>
                  {stats.currentJob.speed && `${stats.currentJob.speed.toFixed(1)}x`}
                  {stats.currentJob.currentTime && stats.currentJob.estimatedDuration && (
                    <> • {formatTime(stats.currentJob.currentTime)} / {formatTime(stats.currentJob.estimatedDuration)}</>
                  )}
                  {stats.currentJob.mtime && (
                    <> • Ajouté le {formatDate(stats.currentJob.mtime)}</>
                  )}
                </p>
              </div>
            </div>
            <div className={styles.jobProgress}>
              <div className={styles.progressBarContainer}>
                <div 
                  className={styles.progressBarFill}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className={styles.progressPercent}>{Math.round(progressPercent)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        {!stats?.isRunning ? (
          <>
            <button
              className={styles.primaryButton}
              onClick={() => performAction('scan')}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'scan' ? (
                <><RefreshCw size={16} className={styles.spinning} /> Scan...</>
              ) : (
                <><Search size={16} /> Scanner les films</>
              )}
            </button>
            
            <button
              className={styles.primaryButton}
              onClick={() => performAction('start')}
              disabled={actionLoading !== null || (stats?.pendingFiles || 0) === 0}
            >
              {actionLoading === 'start' ? (
                <><RefreshCw size={16} className={styles.spinning} /> Démarrage...</>
              ) : (
                <><Play size={16} /> Démarrer le transcodage</>
              )}
            </button>
          </>
        ) : (
          <>
            {stats?.isPaused ? (
              <button
                className={styles.primaryButton}
                onClick={() => performAction('resume')}
                disabled={actionLoading !== null}
              >
                {actionLoading === 'resume' ? (
                  <><RefreshCw size={16} className={styles.spinning} /> Reprise...</>
                ) : (
                  <><Play size={16} /> Reprendre</>
                )}
              </button>
            ) : (
              <button
                className={styles.secondaryButton}
                onClick={() => performAction('pause')}
                disabled={actionLoading !== null}
              >
                {actionLoading === 'pause' ? (
                  <><RefreshCw size={16} className={styles.spinning} /> Pause...</>
                ) : (
                  <><Pause size={16} /> Mettre en pause</>
                )}
              </button>
            )}
            
            <button
              className={styles.dangerButton}
              onClick={() => {
                if (confirm('Arrêter complètement le transcodage ?')) {
                  performAction('stop')
                }
              }}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'stop' ? (
                <><RefreshCw size={16} className={styles.spinning} /> Arrêt...</>
              ) : (
                <><Square size={16} /> Arrêter</>
              )}
            </button>
          </>
        )}

        {!watcher?.isWatching ? (
          <button
            className={styles.secondaryButton}
            onClick={() => performAction('start-watcher')}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'start-watcher' ? (
              <><RefreshCw size={16} className={styles.spinning} /> Activation...</>
            ) : (
              <><Eye size={16} /> Activer le watcher</>
            )}
          </button>
        ) : (
          <button
            className={styles.secondaryButton}
            onClick={() => performAction('stop-watcher')}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'stop-watcher' ? (
              <><RefreshCw size={16} className={styles.spinning} /> Arrêt...</>
            ) : (
              <><Eye size={16} /> Désactiver le watcher</>
            )}
          </button>
        )}
      </div>

      {/* Queue des films en attente */}
      {queue.length > 0 && (
        <div className={styles.resultCard}>
          <h3>Films en attente ({queue.length})</h3>
          <p className={styles.queueSubtitle}>Triés par date d&apos;ajout (plus récent en premier)</p>
          <div className={styles.queueList}>
            {queue.slice(0, 15).map((job, index) => (
              <div key={job.id} className={styles.queueItem}>
                <span className={styles.queueIndex}>{index + 1}</span>
                <div className={styles.queueInfo}>
                  <span className={styles.queueFilename}>{job.filename}</span>
                  {job.mtime && (
                    <span className={styles.queueDate}>Ajouté le {formatDate(job.mtime)}</span>
                  )}
                </div>
                <span className={`${styles.queueStatus} ${styles[job.status]}`}>
                  {job.status === 'pending' && 'En attente'}
                  {job.status === 'failed' && 'Échec - Retry prévu'}
                </span>
              </div>
            ))}
            {queue.length > 15 && (
              <p className={styles.queueMore}>... et {queue.length - 15} autres films</p>
            )}
          </div>
        </div>
      )}

      {/* Films transcodés */}
      <div className={styles.resultCard}>
        <div className={styles.transcodedHeader}>
          <h3>Films transcodés ({transcoded.length})</h3>
          <button
            className={styles.toggleButton}
            onClick={() => setShowTranscoded(!showTranscoded)}
          >
            {showTranscoded ? 'Masquer' : 'Afficher'}
          </button>
        </div>
        
        {transcoded.length === 0 ? (
          <p className={styles.emptyState}>Aucun film transcodé pour le moment</p>
        ) : (
          <>
            <p className={styles.transcodedSummary}>
              Espace total : {formatSize(transcoded.reduce((acc, t) => acc + t.totalSize, 0))}
            </p>
            
            {showTranscoded && (
              <div className={styles.transcodedList}>
                {transcoded.map((film) => (
                  <div key={film.folder} className={styles.transcodedItem}>
                    <div className={styles.transcodedInfo}>
                      <span className={styles.transcodedName}>{film.name}</span>
                      <span className={styles.transcodedMeta}>
                        {formatSize(film.totalSize)} • {film.segmentCount} segments • Transcodé le {formatDate(film.transcodedAt)}
                      </span>
                    </div>
                    <button
                      className={styles.deleteButton}
                      onClick={() => deleteTranscoded(film.folder, film.name)}
                      title="Supprimer ce film transcodé"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Info */}
      <div className={styles.infoBox}>
        <h4>💡 Comment ça fonctionne ?</h4>
        <ul>
          <li><strong>Priorité</strong> : Les films récemment ajoutés sont toujours transcodés en premier</li>
          <li><strong>Persistance</strong> : La queue est sauvegardée automatiquement et reprend après un redémarrage</li>
          <li><strong>Watcher</strong> : Détecte automatiquement les nouveaux films ajoutés au dossier</li>
          <li><strong>Auto-reprise</strong> : Le transcodage reprend automatiquement au démarrage du conteneur</li>
          <li>Les films transcodés ont un <strong>seek instantané</strong> sur toute la timeline</li>
          <li>Les films non transcodés fonctionnent normalement (transcodage temps réel)</li>
        </ul>
      </div>
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
        Vue d&apos;ensemble de la bibliothèque LEON
      </p>
      
      <div className={styles.placeholder}>
        <p>Section à venir...</p>
        <p>Films totaux, espace disque, films les plus regardés, etc.</p>
      </div>
    </div>
  )
}

