'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Search, Check, X, ChevronLeft, ChevronRight, Save, RotateCcw } from 'lucide-react'
import styles from './validate.module.css'

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

export default function ValidatePage() {
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
        // Filtrer les films sans poster ou avec un poster placeholder
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
        setSuggestions(data.results.slice(0, 6)) // Max 6 suggestions
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
      const response = await fetch('/api/admin/update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: currentMovie.id,
          tmdbId: tmdbId
        })
      })
      
      if (response.ok) {
        // Marquer comme validé
        setValidated(prev => new Set([...prev, currentMovie.id]))
        
        // Passer au suivant après 500ms
        setTimeout(() => {
          if (currentIndex < movies.length - 1) {
            setCurrentIndex(currentIndex + 1)
            setSuggestions([])
            setSearchQuery('')
          }
        }, 500)
      }
    } catch (error) {
      console.error('Erreur mise à jour:', error)
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

  // Vérification de sécurité
  if (!currentMovie && !loading) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <Check size={48} />
          <h2>Tous les films sont validés !</h2>
          <p>Aucun film n&apos;a besoin de validation de poster.</p>
          <button onClick={() => window.location.href = '/admin'} className={styles.backButton}>
            <ChevronLeft size={16} />
            Retour à l&apos;admin
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <RotateCcw size={32} className={styles.spinning} />
          <p>Chargement des films à valider...</p>
        </div>
      </div>
    )
  }

  if (movies.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <Check size={48} />
          <h2>Tous les films sont validés !</h2>
          <p>Aucun film n&apos;a besoin de validation de poster.</p>
          <button onClick={() => window.location.href = '/admin'} className={styles.backButton}>
            <ChevronLeft size={16} />
            Retour à l&apos;admin
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => window.location.href = '/admin'} className={styles.backButton}>
          <ChevronLeft size={16} />
          Retour
        </button>
        
        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={styles.progressText}>
            {validated.size} / {movies.length} validés ({progress}%)
          </span>
        </div>
      </div>

      <div className={styles.main}>
        {/* Film actuel */}
        <div className={styles.currentMovie}>
          <div className={styles.moviePoster}>
            {currentMovie.poster_url && !currentMovie.poster_url.includes('placeholder') ? (
              <Image
                src={currentMovie.poster_url}
                alt={currentMovie.title}
                width={300}
                height={450}
                unoptimized
              />
            ) : (
              <div className={styles.noPoster}>
                <X size={48} />
                <p>Pas de poster</p>
              </div>
            )}
          </div>
          
          <div className={styles.movieInfo}>
            <h1>{currentMovie.title}</h1>
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
                className={styles.searchButton}
              >
                {searching ? (
                  <RotateCcw size={20} className={styles.spinning} />
                ) : (
                  <Search size={20} />
                )}
              </button>
            </div>

            {/* Actions rapides */}
            <div className={styles.quickActions}>
              <button 
                onClick={previousMovie}
                disabled={currentIndex === 0}
                className={styles.navButton}
              >
                <ChevronLeft size={20} />
                Précédent
              </button>
              
              <button 
                onClick={skipMovie}
                className={styles.skipButton}
              >
                Passer
                <ChevronRight size={20} />
              </button>
              
              <button 
                onClick={skipMovie}
                disabled={currentIndex === movies.length - 1}
                className={styles.navButton}
              >
                Suivant
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className={styles.suggestions}>
            <h3>Suggestions TMDB</h3>
            <div className={styles.suggestionGrid}>
              {suggestions.map((movie) => (
                <div 
                  key={movie.id}
                  className={styles.suggestionCard}
                  onClick={() => selectSuggestion(movie.id)}
                >
                  {movie.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                      alt={movie.title}
                      width={150}
                      height={225}
                      unoptimized
                      style={{ width: '100%', height: 'auto' }}
                    />
                  ) : (
                    <div className={styles.noPosterSmall}>
                      <X size={24} />
                    </div>
                  )}
                  <div className={styles.suggestionInfo}>
                    <h4>{movie.title}</h4>
                    <p>{new Date(movie.release_date).getFullYear()}</p>
                    <div className={styles.rating}>
                      ⭐ {movie.vote_average.toFixed(1)}
                    </div>
                  </div>
                  {saving && <div className={styles.savingOverlay}>
                    <Save size={24} className={styles.spinning} />
                  </div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Indicateur de validation */}
      {validated.has(currentMovie.id) && (
        <div className={styles.validatedOverlay}>
          <Check size={48} />
          <p>Validé !</p>
        </div>
      )}
    </div>
  )
}