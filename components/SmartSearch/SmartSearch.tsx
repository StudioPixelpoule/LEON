/**
 * Moteur de recherche intelligent et compréhensif
 * Recherche dans : titre, titre original, acteurs, réalisateur, genres
 * Gère les fautes de frappe et les recherches approximatives
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import styles from './SmartSearch.module.css'

interface SmartSearchProps {
  movies: GroupedMedia[]
  onMovieClick: (movie: GroupedMedia) => void
}

export default function SmartSearch({ movies, onMovieClick }: SmartSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GroupedMedia[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Normaliser une chaîne pour la recherche (enlever accents, minuscules, etc.)
  function normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
      .replace(/[^a-z0-9\s]/g, '') // Enlever la ponctuation
      .trim()
  }

  // Calculer la similarité entre deux chaînes (algorithme de Levenshtein simplifié)
  function similarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b
    const shorter = a.length > b.length ? b : a
    
    if (longer.length === 0) return 1.0
    
    // Bonus si le mot est au début
    if (longer.startsWith(shorter)) return 0.95
    
    // Bonus si le mot est contenu
    if (longer.includes(shorter)) return 0.85
    
    // Sinon, calcul basique de similarité
    const editDistance = levenshteinDistance(a, b)
    return (longer.length - editDistance) / longer.length
  }

  function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[b.length][a.length]
  }

  // Recherche intelligente
  function searchMovies(searchQuery: string) {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    const normalizedQuery = normalizeString(searchQuery)
    const queryWords = normalizedQuery.split(/\s+/)

    const scoredResults = movies.map(movie => {
      let score = 0
      let matchedFields: string[] = []

      // Recherche dans le titre
      const normalizedTitle = normalizeString(movie.title)
      const titleSimilarity = similarity(normalizedQuery, normalizedTitle)
      if (titleSimilarity > 0.6) {
        score += titleSimilarity * 10
        matchedFields.push('titre')
      }

      // Recherche dans le titre original
      if (movie.original_title) {
        const normalizedOriginal = normalizeString(movie.original_title)
        const originalSimilarity = similarity(normalizedQuery, normalizedOriginal)
        if (originalSimilarity > 0.6) {
          score += originalSimilarity * 8
          matchedFields.push('titre original')
        }
      }

      // Recherche par mots dans le titre
      queryWords.forEach(word => {
        if (word.length >= 3 && normalizedTitle.includes(word)) {
          score += 3
        }
      })

      // Recherche dans les acteurs
      if (movie.movie_cast && Array.isArray(movie.movie_cast)) {
        movie.movie_cast.slice(0, 10).forEach((actor: any) => {
          if (actor.name) {
            const normalizedActor = normalizeString(actor.name)
            queryWords.forEach(word => {
              if (word.length >= 3 && normalizedActor.includes(word)) {
                score += 2
                if (!matchedFields.includes('casting')) {
                  matchedFields.push('casting')
                }
              }
            })
          }
        })
      }

      // Recherche dans le réalisateur
      if (movie.director?.name) {
        const normalizedDirector = normalizeString(movie.director.name)
        queryWords.forEach(word => {
          if (word.length >= 3 && normalizedDirector.includes(word)) {
            score += 3
            matchedFields.push('réalisateur')
          }
        })
      }

      // Recherche dans les genres
      if (movie.genres) {
        movie.genres.forEach(genre => {
          const normalizedGenre = normalizeString(genre)
          if (normalizedGenre.includes(normalizedQuery)) {
            score += 1
            if (!matchedFields.includes('genre')) {
              matchedFields.push('genre')
            }
          }
        })
      }

      // Bonus pour l'année si elle est dans la recherche
      const yearMatch = searchQuery.match(/\b(19|20)\d{2}\b/)
      if (yearMatch && movie.year && movie.year.toString() === yearMatch[0]) {
        score += 5
        matchedFields.push('année')
      }

      return {
        movie,
        score,
        matchedFields
      }
    })

    // Filtrer et trier par score
    const filtered = scoredResults
      .filter(r => r.score > 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(r => r.movie)

    setResults(filtered)
    setIsOpen(filtered.length > 0)
    setSelectedIndex(0)
  }

  // Debounce de la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      searchMovies(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, movies])

  // Gestion du clic en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Gestion du clavier
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % results.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length)
        break
      case 'Enter':
        e.preventDefault()
        if (results[selectedIndex]) {
          handleMovieClick(results[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        inputRef.current?.blur()
        break
    }
  }

  function handleMovieClick(movie: GroupedMedia) {
    onMovieClick(movie)
    setQuery('')
    setIsOpen(false)
    inputRef.current?.blur()
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className={styles.container} ref={searchRef}>
      <div className={styles.searchBox}>
        <div className={styles.icon}>🔍</div>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          placeholder="Rechercher un film, un acteur, un réalisateur..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && results.length > 0 && setIsOpen(true)}
        />
        {query && (
          <button className={styles.clearButton} onClick={handleClear} aria-label="Effacer">
            ×
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <span className={styles.resultsCount}>
              {results.length} résultat{results.length > 1 ? 's' : ''}
            </span>
            <span className={styles.resultsHint}>
              ↑↓ pour naviguer • ↵ pour sélectionner
            </span>
          </div>
          
          <div className={styles.resultsList}>
            {results.map((movie, index) => (
              <div
                key={movie.id}
                className={`${styles.resultItem} ${index === selectedIndex ? styles.selected : ''}`}
                onClick={() => handleMovieClick(movie)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className={styles.resultPoster}>
                  <Image
                    src={movie.poster_url || '/placeholder-poster.svg'}
                    alt={movie.title}
                    width={50}
                    height={75}
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                
                <div className={styles.resultInfo}>
                  <div className={styles.resultTitle}>{movie.title}</div>
                  
                  <div className={styles.resultMeta}>
                    {movie.year && <span className={styles.resultYear}>{movie.year}</span>}
                    {movie.rating && (
                      <span className={styles.resultRating}>
                        ★ {movie.rating.toFixed(1)}
                      </span>
                    )}
                    {movie.director?.name && (
                      <span className={styles.resultDirector}>
                        par {movie.director.name}
                      </span>
                    )}
                  </div>
                  
                  {movie.genres && movie.genres.length > 0 && (
                    <div className={styles.resultGenres}>
                      {movie.genres.slice(0, 3).join(' • ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOpen && results.length === 0 && query.length >= 2 && (
        <div className={styles.noResults}>
          <div className={styles.noResultsIcon}>🔍</div>
          <div className={styles.noResultsText}>Aucun résultat pour "{query}"</div>
          <div className={styles.noResultsHint}>
            Essayez avec un autre titre, acteur ou réalisateur
          </div>
        </div>
      )}
    </div>
  )
}

