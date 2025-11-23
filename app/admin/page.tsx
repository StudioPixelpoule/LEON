/**
 * Page d'administration LEON - Version 2
 * Design épuré et organisé par sections
 */

'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Header from '@/components/Header/Header'
import { FolderSearch, Image as ImageIcon, HardDrive, BarChart3, Search, RefreshCw, Trash2, Check, X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
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
              <ImageIcon className={styles.icon} size={20} strokeWidth={1.5} />
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
 * Section: Validation des posters
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

function ValidationSection() {
  const [movies, setMovies] = useState<MediaToValidate[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<TMDBResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [validated, setValidated] = useState(new Set<string>())

  useEffect(() => {
    loadMoviesToValidate()
  }, [])

  async function loadMoviesToValidate() {
    try {
      setLoading(true)
      const response = await fetch('/api/media/grouped?type=movie')
      const data = await response.json()
      
      if (data.success) {
        const needsValidation = data.media.filter((m: MediaToValidate) => 
          !m.poster_url || 
          m.poster_url.includes('placeholder') ||
          !m.tmdb_id
        )
        setMovies(needsValidation)
      }
    } catch (error) {
      console.error('Erreur chargement films:', error)
    } finally {
      setLoading(false)
    }
  }

  async function searchAlternatives() {
    if (!currentMovie) return
    
    setSearching(true)
    try {
      const query = searchQuery || currentMovie.title
      const response = await fetch(`/api/admin/search-tmdb?query=${encodeURIComponent(query)}`)
      const data = await response.json()
      
      if (data.results) {
        setSuggestions(data.results.slice(0, 6))
      }
    } catch (error) {
      console.error('Erreur recherche TMDB:', error)
    } finally {
      setSearching(false)
    }
  }

  async function selectSuggestion(tmdbId: number) {
    if (!currentMovie) return
    
    setSaving(true)
    try {
      console.log('🚀 Envoi requête update-metadata:', { mediaId: currentMovie.id, tmdbId })
      
      const response = await fetch('/api/admin/update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: currentMovie.id,
          tmdbId: tmdbId
        })
      })
      
      const data = await response.json()
      console.log('📥 Réponse reçue:', data)
      
      if (response.ok) {
        console.log('✅ Mise à jour réussie')
        setValidated(prev => new Set([...prev, currentMovie.id]))
        
        // Rafraîchir la liste pour voir les changements
        await loadMoviesToValidate()
        
        setTimeout(() => {
          if (currentIndex < movies.length - 1) {
            setCurrentIndex(currentIndex + 1)
            setSuggestions([])
            setSearchQuery('')
          }
        }, 500)
      } else {
        console.error('❌ Erreur mise à jour:', data)
        alert(`Erreur: ${data.error || 'Erreur inconnue'}\n${data.message || ''}`)
      }
    } catch (error) {
      console.error('❌ Erreur mise à jour:', error)
      alert('Erreur lors de la mise à jour. Vérifiez la console.')
    } finally {
      setSaving(false)
    }
  }

  function skipMovie() {
    if (currentIndex < movies.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setSuggestions([])
      setSearchQuery('')
    }
  }

  function previousMovie() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setSuggestions([])
      setSearchQuery('')
    }
  }

  const currentMovie = movies[currentIndex]
  const progress = movies.length > 0 ? ((validated.size / movies.length) * 100).toFixed(0) : 0

  if (loading) {
    return (
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Validation des posters</h2>
        <div className={styles.resultCard}>
          <RotateCcw size={32} className={styles.spinning} />
          <p>Chargement des films à valider...</p>
        </div>
      </div>
    )
  }

  if (movies.length === 0) {
    return (
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Validation des posters</h2>
        <div className={styles.resultCard}>
          <Check size={48} style={{ color: '#10b981' }} />
          <h3>Tous les films sont validés !</h3>
          <p>Aucun film n'a besoin de validation de poster.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Validation des posters</h2>
      <p className={styles.sectionDesc}>
        {validated.size} / {movies.length} validés ({progress}%)
      </p>

      {/* Film actuel */}
      <div className={styles.validationContainer}>
        <div className={styles.currentMovie}>
          <div className={styles.moviePoster}>
            {currentMovie.poster_url && !currentMovie.poster_url.includes('placeholder') ? (
              <Image
                src={currentMovie.poster_url}
                alt={currentMovie.title}
                width={200}
                height={300}
                unoptimized
                style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
              />
            ) : (
              <div className={styles.noPoster}>
                <X size={48} />
                <p>Pas de poster</p>
              </div>
            )}
          </div>
          
          <div className={styles.movieInfo}>
            <h3>{currentMovie.title}</h3>
            {currentMovie.year && <p className={styles.year}>{currentMovie.year}</p>}
            <p className={styles.filePath}>{currentMovie.file_path?.split('/').pop() || 'Chemin inconnu'}</p>
            
            {/* Barre de recherche */}
            <div className={styles.searchBar}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchAlternatives()}
                placeholder={`Rechercher "${currentMovie.title}"...`}
                className={styles.searchInput}
              />
              <button 
                onClick={searchAlternatives}
                disabled={searching}
                className={styles.secondaryButton}
              >
                {searching ? <RotateCcw size={16} className={styles.spinning} /> : <Search size={16} />}
              </button>
            </div>

            {/* Navigation */}
            <div className={styles.quickActions}>
              <button 
                onClick={previousMovie}
                disabled={currentIndex === 0}
                className={styles.secondaryButton}
              >
                <ChevronLeft size={16} />
              </button>
              
              <button 
                onClick={skipMovie}
                className={styles.secondaryButton}
              >
                Passer
              </button>
              
              <button 
                onClick={skipMovie}
                disabled={currentIndex === movies.length - 1}
                className={styles.secondaryButton}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Suggestions TMDB */}
        {suggestions.length > 0 && (
          <div className={styles.suggestions}>
            <h4>Suggestions TMDB</h4>
            <div className={styles.suggestionGrid}>
              {suggestions.map((movie) => (
                <div 
                  key={movie.id}
                  className={styles.suggestionCard}
                  onClick={() => selectSuggestion(movie.id)}
                >
                  {movie.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                      alt={movie.title}
                      width={120}
                      height={180}
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
                    <p className={styles.suggestionRating}>⭐ {movie.vote_average.toFixed(1)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Indicateur de validation */}
      {validated.has(currentMovie.id) && (
        <div className={styles.validatedBadge}>
          <Check size={20} /> Validé !
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

