/**
 * Page d'administration LEON - Version 2
 * Design épuré et organisé par sections
 */

'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Header from '@/components/Header/Header'
import { FolderSearch, Image as ImageIcon, HardDrive, BarChart3, Search, RefreshCw, Trash2, Check, X, ChevronLeft, ChevronRight, RotateCcw, Edit3, Filter, Film, Play, Pause, Square, Eye, Users, Clock, Activity } from 'lucide-react'
import styles from './admin.module.css'

// Sections de la page admin
type AdminSection = 'scan' | 'posters' | 'transcode' | 'stats' | 'watching'

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
            
            <button
              className={`${styles.navItem} ${activeSection === 'watching' ? styles.active : ''}`}
              onClick={() => setActiveSection('watching')}
            >
              <Users className={styles.icon} size={20} strokeWidth={1.5} />
              Qui regarde ?
            </button>
          </div>
        </nav>

        {/* Contenu principal */}
        <main className={styles.main}>
          {activeSection === 'scan' && <ScanSection />}
          {activeSection === 'posters' && <PostersSection />}
          {activeSection === 'transcode' && <TranscodeSection />}
          {activeSection === 'stats' && <StatsSection />}
          {activeSection === 'watching' && <WatchingSection />}
        </main>
      </div>
    </div>
  )
}

/**
 * Section: Scanner les médias (Films + Séries)
 */
function ScanSection() {
  const [scanningFilms, setScanningFilms] = useState(false)
  const [scanningSeries, setScanningSeries] = useState(false)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [filmResult, setFilmResult] = useState<any>(null)
  const [seriesResult, setSeriesResult] = useState<any>(null)
  const [cleanupResult, setCleanupResult] = useState<any>(null)

  async function handleScanFilms() {
    try {
      setScanningFilms(true)
      setFilmResult(null)
      
      const response = await fetch('/api/scan', {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error('Erreur scan films')
      }
      
      const data = await response.json()
      setFilmResult(data)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors du scan des films')
    } finally {
      setScanningFilms(false)
    }
  }

  async function handleScanSeries() {
    try {
      setScanningSeries(true)
      setSeriesResult(null)
      
      const response = await fetch('/api/scan-series', {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error('Erreur scan séries')
      }
      
      const data = await response.json()
      setSeriesResult(data)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors du scan des séries')
    } finally {
      setScanningSeries(false)
    }
  }

  async function handleCleanup() {
    if (!confirm('Voulez-vous supprimer les médias dont le fichier n\'existe plus sur le disque ?')) {
      return
    }
    
    try {
      setCleaningUp(true)
      setCleanupResult(null)
      
      const response = await fetch('/api/admin/cleanup-missing', {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error('Erreur nettoyage')
      }
      
      const data = await response.json()
      setCleanupResult(data)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors du nettoyage')
    } finally {
      setCleaningUp(false)
    }
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Scanner les médias</h2>
      <p className={styles.sectionDesc}>
        Analyse les dossiers pour détecter les nouveaux films et séries
      </p>

      {/* Films */}
      <div className={styles.scanBlock}>
        <div className={styles.scanHeader}>
          <Film size={20} />
          <h3>Films</h3>
          <code>/media/films</code>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.primaryButton}
            onClick={handleScanFilms}
            disabled={scanningFilms}
          >
            {scanningFilms ? (
              <>
                <RefreshCw size={16} className={styles.spinning} />
                Scan en cours...
              </>
            ) : (
              <>
                <Search size={16} />
                Scanner les films
              </>
            )}
          </button>
        </div>

        {filmResult && (
          <div className={styles.resultCard}>
            <h4>Scan films terminé</h4>
            <div className={styles.stats}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{filmResult.stats?.total || 0}</span>
                <span className={styles.statLabel}>Analysés</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{filmResult.stats?.new || 0}</span>
                <span className={styles.statLabel}>Nouveaux</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{filmResult.stats?.updated || 0}</span>
                <span className={styles.statLabel}>Mis à jour</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Séries */}
      <div className={styles.scanBlock}>
        <div className={styles.scanHeader}>
          <Eye size={20} />
          <h3>Séries TV</h3>
          <code>/media/series</code>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.primaryButton}
            onClick={handleScanSeries}
            disabled={scanningSeries}
          >
            {scanningSeries ? (
              <>
                <RefreshCw size={16} className={styles.spinning} />
                Scan en cours...
              </>
            ) : (
              <>
                <Search size={16} />
                Scanner les séries
              </>
            )}
          </button>
        </div>

        {seriesResult && (
          <div className={styles.resultCard}>
            <h4>Scan séries terminé</h4>
            <div className={styles.stats}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{seriesResult.stats?.totalSeries || 0}</span>
                <span className={styles.statLabel}>Séries</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{seriesResult.stats?.newSeries || 0}</span>
                <span className={styles.statLabel}>Nouvelles</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{seriesResult.stats?.totalEpisodes || 0}</span>
                <span className={styles.statLabel}>Épisodes</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{seriesResult.stats?.newEpisodes || 0}</span>
                <span className={styles.statLabel}>Nouveaux ép.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Nettoyage */}
      <div className={styles.scanBlock}>
        <div className={styles.scanHeader}>
          <Trash2 size={20} />
          <h3>Nettoyage</h3>
        </div>
        <p className={styles.scanDesc}>
          Supprime de la base les médias dont le fichier n&apos;existe plus sur le disque
        </p>
        <div className={styles.actions}>
          <button
            className={styles.dangerButton}
            onClick={handleCleanup}
            disabled={cleaningUp}
          >
            {cleaningUp ? (
              <>
                <RefreshCw size={16} className={styles.spinning} />
                Nettoyage...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Nettoyer les fichiers manquants
              </>
            )}
          </button>
        </div>

        {cleanupResult && (
          <div className={styles.resultCard}>
            <h4>Nettoyage terminé</h4>
            <div className={styles.stats}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{cleanupResult.result?.checked || 0}</span>
                <span className={styles.statLabel}>Vérifiés</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{cleanupResult.result?.missing || 0}</span>
                <span className={styles.statLabel}>Manquants</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{cleanupResult.result?.deleted || 0}</span>
                <span className={styles.statLabel}>Supprimés</span>
              </div>
            </div>
            {cleanupResult.result?.details?.length > 0 && (
              <details className={styles.detailsList}>
                <summary>Voir les détails ({cleanupResult.result.details.length})</summary>
                <ul>
                  {cleanupResult.result.details.map((item: any, i: number) => (
                    <li key={i}>{item.title}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Section: Gestion des affiches
 * Version unifiée avec onglets Films / Séries
 */
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
  name?: string // Pour les séries TV
  release_date: string
  first_air_date?: string // Pour les séries TV
  poster_path: string
  overview: string
  vote_average: number
}

type PosterFilter = 'all' | 'to-validate'
type MediaTab = 'films' | 'series'

function PostersSection() {
  // Onglet actif (Films / Séries)
  const [mediaTab, setMediaTab] = useState<MediaTab>('films')
  
  // Films
  const [allMovies, setAllMovies] = useState<MediaToValidate[]>([])
  const [filteredMovies, setFilteredMovies] = useState<MediaToValidate[]>([])
  
  // Séries
  const [allSeries, setAllSeries] = useState<SeriesData[]>([])
  const [filteredSeries, setFilteredSeries] = useState<SeriesData[]>([])
  
  // États partagés
  const [loading, setLoading] = useState(true)
  const [posterFilter, setPosterFilter] = useState<PosterFilter>('to-validate')
  const [searchFilter, setSearchFilter] = useState('')
  const [selectedMovie, setSelectedMovie] = useState<MediaToValidate | null>(null)
  const [selectedSeries, setSelectedSeries] = useState<SeriesData | null>(null)
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<TMDBResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)

  // Charger au montage
  useEffect(() => {
    loadAllMovies()
    loadAllSeries()
  }, [])

  // Filtrage films
  useEffect(() => {
    let movies = allMovies
    
    if (posterFilter === 'to-validate') {
      movies = allMovies.filter((m: MediaToValidate) => 
        !m.poster_url || 
        m.poster_url.includes('placeholder') ||
        !m.tmdb_id
      )
    }
    
    if (searchFilter.trim() === '') {
      setFilteredMovies(movies)
    } else {
      const filtered = movies.filter(m => 
        m.title.toLowerCase().includes(searchFilter.toLowerCase())
      )
      setFilteredMovies(filtered)
    }
  }, [searchFilter, allMovies, posterFilter])

  // Filtrage séries
  useEffect(() => {
    let series = allSeries
    
    if (posterFilter === 'to-validate') {
      series = allSeries.filter((s: SeriesData) => 
        !s.poster_url || 
        s.poster_url.includes('placeholder') ||
        !s.tmdb_id
      )
    }
    
    if (searchFilter.trim() === '') {
      setFilteredSeries(series)
    } else {
      const filtered = series.filter(s => 
        s.title.toLowerCase().includes(searchFilter.toLowerCase())
      )
      setFilteredSeries(filtered)
    }
  }, [searchFilter, allSeries, posterFilter])

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

  async function loadAllSeries() {
    try {
      const response = await fetch('/api/series/list')
      const data = await response.json()
      
      if (data.success) {
        const sorted = (data.series || []).sort((a: SeriesData, b: SeriesData) => 
          a.title.localeCompare(b.title)
        )
        setAllSeries(sorted)
      }
    } catch (error) {
      console.error('Erreur chargement séries:', error)
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

  function closeSeriesModal() {
    setSelectedSeries(null)
    setSuggestions([])
    setSearchQuery('')
  }

  async function searchTMDBSeries() {
    if (!selectedSeries) return
    
    setSearching(true)
    try {
      const query = searchQuery || selectedSeries.title
      const response = await fetch(`/api/admin/search-tmdb?query=${encodeURIComponent(query)}&type=tv`)
      const data = await response.json()
      
      if (data.results) {
        setSuggestions(data.results.slice(0, 8))
      }
    } catch (error) {
      console.error('Erreur recherche TMDB séries:', error)
    } finally {
      setSearching(false)
    }
  }

  async function updateSeriesPoster(tmdbId: number) {
    if (!selectedSeries) return
    
    setSaving(true)
    try {
      const response = await fetch('/api/admin/update-series-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesId: selectedSeries.id,
          tmdbId: tmdbId
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        // Fermer le modal et rafraîchir la liste
        setSelectedSeries(null)
        setSuggestions([])
        setSearchQuery('')
        await loadAllSeries()
        
        // Notification de succès
        alert('✅ Affiche de la série mise à jour avec succès !')
      } else {
        alert(`Erreur: ${data.error || 'Erreur inconnue'}`)
      }
    } catch (error) {
      console.error('Erreur mise à jour série:', error)
      alert('Erreur lors de la mise à jour de la série')
    } finally {
      setSaving(false)
    }
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

  const toValidateMoviesCount = allMovies.filter(m => 
    !m.poster_url || m.poster_url.includes('placeholder') || !m.tmdb_id
  ).length

  const toValidateSeriesCount = allSeries.filter(s => 
    !s.poster_url || s.poster_url.includes('placeholder') || !s.tmdb_id
  ).length

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Gestion des affiches</h2>
      <p className={styles.sectionDesc}>
        Valider ou modifier les affiches de vos médias
      </p>

      {/* Onglets Films / Séries */}
      <div className={styles.mediaTabs}>
        <button
          className={`${styles.mediaTab} ${mediaTab === 'films' ? styles.active : ''}`}
          onClick={() => setMediaTab('films')}
        >
          <Film size={18} />
          Films ({allMovies.length})
          {toValidateMoviesCount > 0 && (
            <span className={styles.tabBadge}>{toValidateMoviesCount}</span>
          )}
        </button>
        <button
          className={`${styles.mediaTab} ${mediaTab === 'series' ? styles.active : ''}`}
          onClick={() => setMediaTab('series')}
        >
          <Eye size={18} />
          Séries ({allSeries.length})
          {toValidateSeriesCount > 0 && (
            <span className={styles.tabBadge}>{toValidateSeriesCount}</span>
          )}
        </button>
      </div>

      {/* Filtres et barre de recherche */}
      <div className={styles.filterBar}>
        <div className={styles.posterFilters}>
          <button
            className={`${styles.filterButton} ${posterFilter === 'to-validate' ? styles.active : ''}`}
            onClick={() => setPosterFilter('to-validate')}
          >
            <X size={16} />
            À valider ({mediaTab === 'films' ? toValidateMoviesCount : toValidateSeriesCount})
          </button>
          <button
            className={`${styles.filterButton} ${posterFilter === 'all' ? styles.active : ''}`}
            onClick={() => setPosterFilter('all')}
          >
            <Filter size={16} />
            {mediaTab === 'films' ? `Tous les films (${allMovies.length})` : `Toutes les séries (${allSeries.length})`}
          </button>
        </div>
        
        <div className={styles.searchBar}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder={mediaTab === 'films' ? "Rechercher un film..." : "Rechercher une série..."}
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
          {mediaTab === 'films' 
            ? `${filteredMovies.length} film${filteredMovies.length > 1 ? 's' : ''}`
            : `${filteredSeries.length} série${filteredSeries.length > 1 ? 's' : ''}`
          }
        </div>
      </div>

      {/* Message si aucun élément à valider */}
      {posterFilter === 'to-validate' && (
        (mediaTab === 'films' && filteredMovies.length === 0) ||
        (mediaTab === 'series' && filteredSeries.length === 0)
      ) && (
        <div className={styles.successState}>
          <Check size={64} style={{ color: '#10b981' }} />
          <h3>{mediaTab === 'films' ? 'Tous les films sont validés ! 🎉' : 'Toutes les séries sont validées ! 🎉'}</h3>
          <p>Aucun {mediaTab === 'films' ? 'film' : 'série'} n&apos;a besoin de validation de poster.</p>
        </div>
      )}

      {/* Grille de films */}
      {mediaTab === 'films' && filteredMovies.length > 0 && (
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

      {/* Grille de séries */}
      {mediaTab === 'series' && filteredSeries.length > 0 && (
        <div className={styles.moviesGrid}>
          {filteredSeries.map((series) => {
            const needsValidation = !series.poster_url || series.poster_url.includes('placeholder') || !series.tmdb_id
            const seasonCount = series.seasons?.length || 0
            
            return (
              <div 
                key={series.id}
                className={styles.movieCard}
                onClick={() => {
                  setSelectedSeries(series)
                  setSearchQuery(series.title)
                }}
              >
                <div className={styles.movieCardPoster}>
                  {series.poster_url && !series.poster_url.includes('placeholder') ? (
                    <Image
                      src={series.poster_url}
                      alt={series.title}
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
                  {seasonCount > 0 && (
                    <div className={styles.seasonBadge}>
                      {seasonCount} saison{seasonCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <div className={styles.movieCardInfo}>
                  <h4 className={styles.movieCardTitle}>{series.title}</h4>
                  {series.first_air_date && (
                    <p className={styles.movieCardYear}>
                      {new Date(series.first_air_date).getFullYear()}
                    </p>
                  )}
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

      {/* Modal de validation - SÉRIES */}
      {selectedSeries && (
        <div className={styles.modal} onClick={closeSeriesModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={closeSeriesModal}>
              <X size={24} />
            </button>

            <div className={styles.modalLayout}>
              {/* Colonne gauche : Affiche actuelle */}
              <div className={styles.currentPoster}>
                <h3>Affiche actuelle</h3>
                <div className={styles.posterPreview}>
                  {selectedSeries.poster_url && !selectedSeries.poster_url.includes('placeholder') ? (
                    <Image
                      src={selectedSeries.poster_url}
                      alt={selectedSeries.title}
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
                  <h4>{selectedSeries.title}</h4>
                  {selectedSeries.first_air_date && (
                    <p>{new Date(selectedSeries.first_air_date).getFullYear()}</p>
                  )}
                  <p className={styles.filePath}>
                    {selectedSeries.seasons?.length || 0} saison(s)
                  </p>
                </div>
              </div>

              {/* Colonne droite : Recherche TMDB */}
              <div className={styles.posterSearch}>
                <h3>Rechercher sur TMDB</h3>
                
                <div className={styles.searchBar}>
                  <input
                    type="text"
                    placeholder="Titre de la série..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchTMDBSeries()}
                    className={styles.searchInput}
                  />
                  <button 
                    onClick={searchTMDBSeries}
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
                    {suggestions.map((series) => (
                      <div 
                        key={series.id}
                        className={styles.suggestionCard}
                        onClick={() => updateSeriesPoster(series.id)}
                      >
                        {series.poster_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w300${series.poster_path}`}
                            alt={series.title || series.name || 'Série'}
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
                          <p className={styles.suggestionTitle}>{series.title || series.name}</p>
                          <p className={styles.suggestionYear}>
                            {series.first_air_date ? new Date(series.first_air_date).getFullYear() : 'N/A'}
                          </p>
                          {series.vote_average > 0 && (
                            <p className={styles.suggestionRating}>⭐ {series.vote_average.toFixed(1)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {suggestions.length === 0 && !searching && (
                  <div className={styles.emptyState}>
                    <Search size={48} opacity={0.3} />
                    <p>Recherchez la série pour voir les suggestions TMDB</p>
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
  hasMultiAudio?: boolean
  hasSubtitles?: boolean
  audioCount?: number
  subtitleCount?: number
}

// Type pour les stats du cache HLS
interface CacheStats {
  totalSizeGB: string
  totalFiles: number
  oldestFile?: string
  newestFile?: string
}

function TranscodeSection() {
  const [stats, setStats] = useState<TranscodeStats | null>(null)
  const [queue, setQueue] = useState<TranscodeJob[]>([])
  const [transcoded, setTranscoded] = useState<TranscodedFile[]>([])
  const [watcher, setWatcher] = useState<{ isWatching: boolean; watchedDirs: number; knownFiles: number } | null>(null)
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showTranscoded, setShowTranscoded] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)

  // Charger les stats au montage et toutes les 3 secondes (mode rapide)
  useEffect(() => {
    loadStats(false) // Premier chargement complet
    loadCacheStats()
    const interval = setInterval(() => loadStats(true), 3000) // Polling rapide
    return () => clearInterval(interval)
  }, [])

  // Charger les stats (quick=true pour polling fréquent, false pour la liste transcodés)
  async function loadStats(quick: boolean = true) {
    try {
      const response = await fetch(`/api/transcode${quick ? '?quick=true' : ''}`)
      const data = await response.json()
      setStats(data.stats)
      setQueue(data.queue || [])
      setWatcher(data.watcher || null)
      // La liste transcodés n'est chargée qu'en mode complet
      if (data.transcoded) {
        setTranscoded(data.transcoded)
      }
    } catch (error) {
      console.error('Erreur chargement stats transcodage:', error)
    } finally {
      setLoading(false)
    }
  }

  // Recharger la liste des transcodés (appelé manuellement)
  async function reloadTranscoded() {
    try {
      const response = await fetch('/api/transcode')
      const data = await response.json()
      if (data.transcoded) {
        setTranscoded(data.transcoded)
      }
    } catch (error) {
      console.error('Erreur chargement liste transcodés:', error)
    }
  }

  async function loadCacheStats() {
    try {
      const response = await fetch('/api/cache/stats')
      const data = await response.json()
      if (data.success) {
        setCacheStats(data.stats)
      }
    } catch (error) {
      console.error('Erreur chargement stats cache:', error)
    }
  }

  async function clearCache() {
    if (!confirm('Vider le cache HLS temporaire ?\n\nCela supprime les segments transcodés à la volée (pas les films pré-transcodés).')) {
      return
    }

    try {
      setClearingCache(true)
      const response = await fetch('/api/cache/clear', { method: 'POST' })
      const data = await response.json()
      
      if (data.success) {
        alert(`✅ Cache vidé : ${data.deleted.files} segments supprimés (${data.deleted.sizeGB}GB)`)
        loadCacheStats()
      }
    } catch (error) {
      console.error('Erreur vidage cache:', error)
      alert('❌ Erreur lors du vidage du cache')
    } finally {
      setClearingCache(false)
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

  async function reTranscode(folder: string, name: string) {
    if (!confirm(`Re-transcoder "${name}" avec multi-audio et sous-titres ?\n\nLe film sera supprimé puis re-ajouté à la queue de transcodage.`)) {
      return
    }
    
    try {
      // 1. Supprimer l'ancien transcodage
      await fetch(`/api/transcode?folder=${encodeURIComponent(folder)}`, {
        method: 'DELETE'
      })
      
      // 2. Re-scanner pour ajouter le film à la queue
      await fetch('/api/transcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan' })
      })
      
      alert(`"${name}" ajouté à la queue de transcodage.\nLe nouveau transcodage inclura toutes les pistes audio et sous-titres.`)
      await loadStats()
    } catch (error) {
      console.error('Erreur re-transcodage:', error)
      alert('Erreur lors du re-transcodage')
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
            {showTranscoded && (
              <div className={styles.transcodedList}>
                {transcoded.map((film) => (
                  <div key={film.folder} className={styles.transcodedItem}>
                    <div className={styles.transcodedInfo}>
                      <span className={styles.transcodedName}>{film.name}</span>
                      <span className={styles.transcodedMeta}>
                        {film.segmentCount} segments • Transcodé le {formatDate(film.transcodedAt)}
                        {/* Indicateurs multi-audio et sous-titres */}
                        <span style={{ marginLeft: '10px', display: 'inline-flex', gap: '6px' }}>
                          <span 
                            title={`${film.audioCount || 1} piste(s) audio`}
                            style={{ 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontSize: '10px',
                              fontWeight: 600,
                              background: (film.audioCount || 1) > 1 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                              color: (film.audioCount || 1) > 1 ? '#22c55e' : 'rgba(255,255,255,0.5)'
                            }}
                          >
                            🔊 {film.audioCount || 1}
                          </span>
                          <span 
                            title={`${film.subtitleCount || 0} sous-titre(s)`}
                            style={{ 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontSize: '10px',
                              fontWeight: 600,
                              background: (film.subtitleCount || 0) > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                              color: (film.subtitleCount || 0) > 0 ? '#3b82f6' : 'rgba(255,255,255,0.5)'
                            }}
                          >
                            📝 {film.subtitleCount || 0}
                          </span>
                        </span>
                      </span>
                    </div>
                    <div className={styles.transcodedActions}>
                      {/* Afficher le bouton re-transcoder uniquement si ancien format (1 audio, 0 sous-titres) */}
                      {((film.audioCount || 1) <= 1 && (film.subtitleCount || 0) === 0) && (
                        <button
                          className={styles.secondaryButton}
                          onClick={() => reTranscode(film.folder, film.name)}
                          title="Re-transcoder avec multi-audio et sous-titres"
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                      <button
                        className={styles.deleteButton}
                        onClick={() => deleteTranscoded(film.folder, film.name)}
                        title="Supprimer ce film transcodé"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Cache HLS temporaire (pour films non pré-transcodés) */}
      <div className={styles.resultCard}>
        <div className={styles.transcodedHeader}>
          <h3>Cache HLS temporaire</h3>
          <button
            className={styles.dangerButton}
            onClick={clearCache}
            disabled={clearingCache || !cacheStats || cacheStats.totalFiles === 0}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            {clearingCache ? (
              <><RefreshCw size={14} className={styles.spinning} /> Vidage...</>
            ) : (
              <><Trash2 size={14} /> Vider le cache</>
            )}
          </button>
        </div>
        <p className={styles.sectionDesc} style={{ marginBottom: '16px' }}>
          Segments transcodés à la volée pour les films non pré-transcodés
        </p>
        {cacheStats ? (
          <div className={styles.stats} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{cacheStats.totalSizeGB} GB</span>
              <span className={styles.statLabel}>Espace utilisé</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{cacheStats.totalFiles}</span>
              <span className={styles.statLabel}>Segments en cache</span>
            </div>
          </div>
        ) : (
          <p className={styles.emptyState}>Cache vide ou non disponible</p>
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
          <li>Les films <strong>pré-transcodés</strong> ont un seek instantané sur toute la timeline</li>
          <li>Les films <strong>non transcodés</strong> utilisent le cache temporaire (transcodage temps réel)</li>
          <li>Vider le cache libère de l&apos;espace mais peut ralentir les films non pré-transcodés</li>
        </ul>
      </div>
    </div>
  )
}

/**
 * Section: Statistiques globales
 */
interface DashboardStats {
  library: {
    totalMovies: number
    totalSeries: number
    totalEpisodes: number
    totalDurationMinutes: number
    averageDurationMinutes: number
  }
  posters: {
    withPosters: number
    withoutPosters: number
    validationRate: number
  }
  storage: {
    mediaFiles: number
    mediaSizeGB: number
    transcodedFiles: number
    transcodedSizeGB: number
    cacheFiles: number
    cacheSizeGB: number
  }
  transcoding: {
    completed: number
    pending: number
    inProgress: boolean
  }
  activity: {
    recentlyAdded: Array<{
      id: string
      title: string
      poster_url: string | null
      created_at: string
    }>
    inProgress: Array<{
      id: string
      title: string
      poster_url: string | null
      progress: number
    }>
    mostWatched: Array<{
      id: string
      title: string
      poster_url: string | null
      watchCount: number
    }>
  }
  genres: Array<{
    name: string
    count: number
  }>
  years: Array<{
    year: number
    count: number
  }>
}

function StatsSection() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/stats/dashboard')
      
      if (!response.ok) {
        throw new Error('Erreur chargement stats')
      }
      
      const data = await response.json()
      setStats(data)
    } catch (err) {
      console.error('Erreur chargement stats:', err)
      setError('Impossible de charger les statistiques')
    } finally {
      setLoading(false)
    }
  }

  function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours < 24) return `${hours}h ${mins}min`
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return `${days}j ${remainingHours}h`
  }

  function formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    })
  }

  if (loading) {
    return (
      <div className={styles.section}>
        <div className={styles.loadingState}>
          <RefreshCw size={32} className={styles.spinning} />
          <p>Chargement des statistiques...</p>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Statistiques</h2>
        <div className={styles.errorState}>
          <p>{error || 'Aucune donnée disponible'}</p>
          <button className={styles.secondaryButton} onClick={loadStats}>
            <RefreshCw size={16} />
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.section}>
      <div className={styles.statsHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Statistiques</h2>
          <p className={styles.sectionDesc}>
            Vue d&apos;ensemble de votre bibliothèque LEON
          </p>
        </div>
        <button className={styles.refreshButton} onClick={loadStats} title="Actualiser">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* KPIs principaux */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <Film size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats.library.totalMovies}</span>
            <span className={styles.kpiLabel}>Films</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <Play size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{formatDuration(stats.library.totalDurationMinutes)}</span>
            <span className={styles.kpiLabel}>Durée totale</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <HardDrive size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats.storage.mediaSizeGB} GB</span>
            <span className={styles.kpiLabel}>Espace média</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <Check size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats.posters.validationRate}%</span>
            <span className={styles.kpiLabel}>Affiches validées</span>
          </div>
        </div>
      </div>

      {/* Graphiques */}
      <div className={styles.chartsRow}>
        {/* Répartition par genres */}
        <div className={styles.chartCard}>
          <h3>Top Genres</h3>
          <div className={styles.barChart}>
            {stats.genres.slice(0, 8).map((genre, index) => {
              const maxCount = stats.genres[0]?.count || 1
              const percentage = (genre.count / maxCount) * 100
              return (
                <div key={genre.name} className={styles.barItem}>
                  <span className={styles.barLabel}>{genre.name}</span>
                  <div className={styles.barTrack}>
                    <div 
                      className={styles.barFill}
                      style={{ 
                        width: `${percentage}%`,
                        animationDelay: `${index * 0.05}s`
                      }}
                    />
                  </div>
                  <span className={styles.barValue}>{genre.count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Distribution par années */}
        <div className={styles.chartCard}>
          <h3>Films par année</h3>
          <div className={styles.yearChart}>
            {stats.years.slice(0, 12).map((item) => {
              const maxCount = Math.max(...stats.years.slice(0, 12).map(y => y.count)) || 1
              const height = (item.count / maxCount) * 100
              return (
                <div key={item.year} className={styles.yearBar}>
                  <div 
                    className={styles.yearBarFill}
                    style={{ height: `${height}%` }}
                    title={`${item.year}: ${item.count} films`}
                  />
                  <span className={styles.yearLabel}>{String(item.year).slice(-2)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Détails */}
      <div className={styles.statsDetailsRow}>
        {/* Validation des affiches */}
        <div className={styles.detailCard}>
          <h3>
            <ImageIcon size={18} />
            État des affiches
          </h3>
          <div className={styles.progressRing}>
            <svg viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#10b981"
                strokeWidth="8"
                strokeDasharray={`${stats.posters.validationRate * 2.51} 251`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className={styles.progressRingCenter}>
              <span className={styles.progressRingValue}>{stats.posters.validationRate}%</span>
              <span className={styles.progressRingLabel}>validées</span>
            </div>
          </div>
          <div className={styles.detailStats}>
            <div className={styles.detailStatItem}>
              <span className={styles.detailStatValue}>{stats.posters.withPosters}</span>
              <span className={styles.detailStatLabel}>Avec affiche</span>
            </div>
            <div className={styles.detailStatItem}>
              <span className={styles.detailStatValue}>{stats.posters.withoutPosters}</span>
              <span className={styles.detailStatLabel}>À valider</span>
            </div>
          </div>
        </div>

        {/* Transcodage */}
        <div className={styles.detailCard}>
          <h3>
            <Film size={18} />
            Pré-transcodage
          </h3>
          <div className={styles.transcodingStats}>
            <div className={styles.transcodingMain}>
              <span className={styles.transcodingValue}>{stats.transcoding.completed}</span>
              <span className={styles.transcodingLabel}>films prêts</span>
            </div>
            <div className={styles.transcodingProgress}>
              <div className={styles.progressBarContainer}>
                <div 
                  className={styles.progressBarFill}
                  style={{ 
                    width: `${stats.library.totalMovies > 0 
                      ? (stats.transcoding.completed / stats.library.totalMovies) * 100 
                      : 0}%` 
                  }}
                />
              </div>
              <span className={styles.transcodingPercent}>
                {stats.library.totalMovies > 0 
                  ? Math.round((stats.transcoding.completed / stats.library.totalMovies) * 100) 
                  : 0}%
              </span>
            </div>
          </div>
          <p className={styles.detailNote}>
            Films avec seek instantané sur toute la timeline
          </p>
        </div>

        {/* Statistiques films */}
        <div className={styles.detailCard}>
          <h3>
            <BarChart3 size={18} />
            Métriques
          </h3>
          <div className={styles.metricsList}>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Durée moyenne</span>
              <span className={styles.metricValue}>{stats.library.averageDurationMinutes} min</span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Fichiers média</span>
              <span className={styles.metricValue}>{stats.storage.mediaFiles}</span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Films transcodés</span>
              <span className={styles.metricValue}>{stats.storage.transcodedFiles}</span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>En cours de visionnage</span>
              <span className={styles.metricValue}>{stats.activity.inProgress.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activité récente */}
      <div className={styles.activitySection}>
        <h3>Récemment ajoutés</h3>
        <div className={styles.recentGrid}>
          {stats.activity.recentlyAdded.slice(0, 8).map((movie) => (
            <div key={movie.id} className={styles.recentCard}>
              <div className={styles.recentPoster}>
                {movie.poster_url && !movie.poster_url.includes('placeholder') ? (
                  <Image
                    src={movie.poster_url}
                    alt={movie.title}
                    fill
                    sizes="120px"
                    style={{ objectFit: 'cover' }}
                    unoptimized
                  />
                ) : (
                  <div className={styles.noPoster}>
                    <Film size={24} />
                  </div>
                )}
              </div>
              <div className={styles.recentInfo}>
                <span className={styles.recentTitle}>{movie.title}</span>
                <span className={styles.recentDate}>{formatDate(movie.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* En cours de visionnage */}
      {stats.activity.inProgress.length > 0 && (
        <div className={styles.activitySection}>
          <h3>En cours de visionnage</h3>
          <div className={styles.inProgressList}>
            {stats.activity.inProgress.map((movie) => (
              <div key={movie.id} className={styles.inProgressItem}>
                <div className={styles.inProgressPoster}>
                  {movie.poster_url && !movie.poster_url.includes('placeholder') ? (
                    <Image
                      src={movie.poster_url}
                      alt={movie.title}
                      fill
                      sizes="60px"
                      style={{ objectFit: 'cover' }}
                      unoptimized
                    />
                  ) : (
                    <div className={styles.noPoster}>
                      <Film size={16} />
                    </div>
                  )}
                </div>
                <div className={styles.inProgressInfo}>
                  <span className={styles.inProgressTitle}>{movie.title}</span>
                  <div className={styles.inProgressBar}>
                    <div className={styles.progressBarContainer}>
                      <div 
                        className={styles.progressBarFill}
                        style={{ width: `${movie.progress}%` }}
                      />
                    </div>
                    <span className={styles.inProgressPercent}>{movie.progress}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Section: Qui regarde ? (Suivi multi-utilisateurs)
 */
interface ActiveSession {
  id: string
  userId: string | null
  userName: string
  mediaId: string
  title: string
  posterUrl: string | null
  year: number | null
  position: number
  duration: number | null
  progress: number
  updatedAt: string
  isActive: boolean
}

interface WatchHistoryEntry {
  id: string
  userId: string | null
  userName: string
  mediaId: string
  title: string
  posterUrl: string | null
  year: number | null
  watchedAt: string
  watchDuration: number | null
  completed: boolean
}

interface WatchingStats {
  activeSessions: ActiveSession[]
  recentHistory: WatchHistoryEntry[]
  stats: {
    totalWatches: number
    uniqueViewers: number
    totalWatchTimeMinutes: number
    mostWatchedToday: Array<{
      mediaId: string
      title: string
      posterUrl: string | null
      watchCount: number
    }>
  }
}

function WatchingSection() {
  const [data, setData] = useState<WatchingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
    // Rafraîchir toutes les 10 secondes
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      setError(null)
      const response = await fetch('/api/stats/watching')
      
      if (!response.ok) {
        throw new Error('Erreur chargement données')
      }
      
      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error('Erreur chargement watching stats:', err)
      setError('Impossible de charger les données de visionnage')
    } finally {
      setLoading(false)
    }
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return '--'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}min`
    return `${minutes}min`
  }

  function formatTime(isoString: string): string {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    
    if (diffMin < 1) return 'À l\'instant'
    if (diffMin < 60) return `Il y a ${diffMin}min`
    
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `Il y a ${diffHours}h`
    
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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

  if (error) {
    return (
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Qui regarde ?</h2>
        <div className={styles.errorState}>
          <p>{error}</p>
          <button className={styles.secondaryButton} onClick={loadData}>
            <RefreshCw size={16} />
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  const activeSessions = data?.activeSessions.filter(s => s.isActive) || []
  const recentSessions = data?.activeSessions.filter(s => !s.isActive) || []

  return (
    <div className={styles.section}>
      <div className={styles.statsHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Qui regarde ?</h2>
          <p className={styles.sectionDesc}>
            Suivi en temps réel des visionnages
          </p>
        </div>
        <button className={styles.refreshButton} onClick={loadData} title="Actualiser">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
            <Activity size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{activeSessions.length}</span>
            <span className={styles.kpiLabel}>En train de regarder</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <Users size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{data?.stats.uniqueViewers || 0}</span>
            <span className={styles.kpiLabel}>Spectateurs (24h)</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <Eye size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{data?.stats.totalWatches || 0}</span>
            <span className={styles.kpiLabel}>Visionnages (24h)</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(249, 115, 22, 0.15)', color: '#f97316' }}>
            <Clock size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{formatDuration((data?.stats.totalWatchTimeMinutes || 0) * 60)}</span>
            <span className={styles.kpiLabel}>Temps total (24h)</span>
          </div>
        </div>
      </div>

      {/* Sessions actives */}
      <div className={styles.resultCard}>
        <h3>
          <span className={styles.statusDot + ' ' + styles.active} style={{ marginRight: '8px' }} />
          En train de regarder ({activeSessions.length})
        </h3>
        
        {activeSessions.length === 0 ? (
          <p className={styles.emptyState}>Personne ne regarde en ce moment</p>
        ) : (
          <div className={styles.watchingList}>
            {activeSessions.map((session) => (
              <div key={session.id} className={styles.watchingItem}>
                <div className={styles.watchingPoster}>
                  {session.posterUrl && !session.posterUrl.includes('placeholder') ? (
                    <Image
                      src={session.posterUrl}
                      alt={session.title}
                      fill
                      sizes="60px"
                      style={{ objectFit: 'cover' }}
                      unoptimized
                    />
                  ) : (
                    <div className={styles.noPoster}>
                      <Film size={20} />
                    </div>
                  )}
                </div>
                <div className={styles.watchingInfo}>
                  <div className={styles.watchingHeader}>
                    <span className={styles.watchingUser}>{session.userName}</span>
                    <span className={styles.watchingTime}>{formatTime(session.updatedAt)}</span>
                  </div>
                  <span className={styles.watchingTitle}>
                    {session.title} {session.year && `(${session.year})`}
                  </span>
                  <div className={styles.watchingProgress}>
                    <div className={styles.progressBarContainer}>
                      <div 
                        className={styles.progressBarFill}
                        style={{ width: `${session.progress}%` }}
                      />
                    </div>
                    <span className={styles.watchingPercent}>{session.progress}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sessions récentes (pas actives mais dans les 10 dernières minutes) */}
      {recentSessions.length > 0 && (
        <div className={styles.resultCard}>
          <h3>Récemment en pause ({recentSessions.length})</h3>
          <div className={styles.watchingList}>
            {recentSessions.slice(0, 5).map((session) => (
              <div key={session.id} className={styles.watchingItem} style={{ opacity: 0.7 }}>
                <div className={styles.watchingPoster}>
                  {session.posterUrl && !session.posterUrl.includes('placeholder') ? (
                    <Image
                      src={session.posterUrl}
                      alt={session.title}
                      fill
                      sizes="60px"
                      style={{ objectFit: 'cover' }}
                      unoptimized
                    />
                  ) : (
                    <div className={styles.noPoster}>
                      <Film size={20} />
                    </div>
                  )}
                </div>
                <div className={styles.watchingInfo}>
                  <div className={styles.watchingHeader}>
                    <span className={styles.watchingUser}>{session.userName}</span>
                    <span className={styles.watchingTime}>{formatTime(session.updatedAt)}</span>
                  </div>
                  <span className={styles.watchingTitle}>
                    {session.title} {session.year && `(${session.year})`}
                  </span>
                  <div className={styles.watchingProgress}>
                    <div className={styles.progressBarContainer}>
                      <div 
                        className={styles.progressBarFill}
                        style={{ width: `${session.progress}%`, background: 'rgba(255,255,255,0.3)' }}
                      />
                    </div>
                    <span className={styles.watchingPercent}>{session.progress}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historique récent */}
      {data?.recentHistory && data.recentHistory.length > 0 && (
        <div className={styles.resultCard}>
          <h3>Historique des dernières 24h</h3>
          <div className={styles.historyList}>
            {data.recentHistory.map((entry) => (
              <div key={entry.id} className={styles.historyItem}>
                <div className={styles.historyPoster}>
                  {entry.posterUrl && !entry.posterUrl.includes('placeholder') ? (
                    <Image
                      src={entry.posterUrl}
                      alt={entry.title}
                      fill
                      sizes="40px"
                      style={{ objectFit: 'cover' }}
                      unoptimized
                    />
                  ) : (
                    <div className={styles.noPoster}>
                      <Film size={16} />
                    </div>
                  )}
                </div>
                <div className={styles.historyInfo}>
                  <span className={styles.historyUser}>{entry.userName}</span>
                  <span className={styles.historyTitle}>{entry.title}</span>
                </div>
                <div className={styles.historyMeta}>
                  <span className={styles.historyTime}>{formatTime(entry.watchedAt)}</span>
                  {entry.completed && (
                    <span className={styles.historyCompleted}>
                      <Check size={14} /> Terminé
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Films populaires aujourd'hui */}
      {data?.stats.mostWatchedToday && data.stats.mostWatchedToday.length > 0 && (
        <div className={styles.resultCard}>
          <h3>Top films du jour</h3>
          <div className={styles.topFilmsList}>
            {data.stats.mostWatchedToday.map((film, index) => (
              <div key={film.mediaId} className={styles.topFilmItem}>
                <span className={styles.topFilmRank}>{index + 1}</span>
                <div className={styles.topFilmPoster}>
                  {film.posterUrl && !film.posterUrl.includes('placeholder') ? (
                    <Image
                      src={film.posterUrl}
                      alt={film.title}
                      fill
                      sizes="40px"
                      style={{ objectFit: 'cover' }}
                      unoptimized
                    />
                  ) : (
                    <div className={styles.noPoster}>
                      <Film size={16} />
                    </div>
                  )}
                </div>
                <span className={styles.topFilmTitle}>{film.title}</span>
                <span className={styles.topFilmCount}>{film.watchCount} visionnage{film.watchCount > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className={styles.infoBox}>
        <h4>💡 À propos du suivi</h4>
        <ul>
          <li><strong>En train de regarder</strong> : Mis à jour dans les 5 dernières minutes</li>
          <li><strong>Historique</strong> : Enregistré quand un film est terminé (&gt;90%)</li>
          <li><strong>Anonyme</strong> : Si pas d&apos;utilisateur connecté</li>
          <li>Les données se rafraîchissent automatiquement toutes les 10 secondes</li>
        </ul>
      </div>
    </div>
  )
}

