'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import {
  RefreshCw,
  Film,
  Tv,
  X,
  Filter,
  Search,
  Check,
  Image as ImageIcon,
  Edit3
} from 'lucide-react'
import styles from '@/app/admin/admin.module.css'
import { useAdminToast } from '@/components/admin/Toast/Toast'

// ============================================
// TYPES
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

// ============================================
// COMPONENT
// ============================================

export function PostersView() {
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
