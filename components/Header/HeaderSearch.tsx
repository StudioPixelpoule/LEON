/**
 * Recherche intégrée dans le Header - Style Netflix/Apple TV+
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import styles from './HeaderSearch.module.css'
import { normalizeString, similarity } from '@/components/SmartSearch/searchUtils'

interface HeaderSearchProps {
  movies: GroupedMedia[]
  onMovieClick: (movie: GroupedMedia) => void
  isSeries?: boolean
}

export default function HeaderSearch({ movies, onMovieClick, isSeries = false }: HeaderSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GroupedMedia[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Recherche intelligente
  function searchMovies(searchQuery: string) {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([])
      return
    }

    const normalizedQuery = normalizeString(searchQuery)
    const queryWords = normalizedQuery.split(/\s+/)

    const scoredResults = movies.map(movie => {
      let score = 0

      // Titre
      const normalizedTitle = normalizeString(movie.title)
      const titleSimilarity = similarity(normalizedQuery, normalizedTitle)
      if (titleSimilarity > 0.6) score += titleSimilarity * 10

      // Titre original
      if (movie.original_title) {
        const normalizedOriginal = normalizeString(movie.original_title)
        const originalSimilarity = similarity(normalizedQuery, normalizedOriginal)
        if (originalSimilarity > 0.6) score += originalSimilarity * 8
      }

      // Mots dans le titre
      queryWords.forEach(word => {
        if (word.length >= 3 && normalizedTitle.includes(word)) score += 3
      })

      // Acteurs
      if (movie.movie_cast && Array.isArray(movie.movie_cast)) {
        movie.movie_cast.slice(0, 10).forEach((actor: any) => {
          if (actor.name) {
            const normalizedActor = normalizeString(actor.name)
            queryWords.forEach(word => {
              if (word.length >= 3 && normalizedActor.includes(word)) score += 2
            })
          }
        })
      }

      // Réalisateur
      if (movie.director?.name) {
        const normalizedDirector = normalizeString(movie.director.name)
        queryWords.forEach(word => {
          if (word.length >= 3 && normalizedDirector.includes(word)) score += 3
        })
      }

      return { movie, score }
    })

    const filtered = scoredResults
      .filter(r => r.score > 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(r => r.movie)

    setResults(filtered)
    setSelectedIndex(0)
  }

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => searchMovies(query), 300)
    return () => clearTimeout(timer)
  }, [query, movies])

  // Clic en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Clavier
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!results.length) return

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
        if (results[selectedIndex]) handleMovieClick(results[selectedIndex])
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
    setResults([])
    setIsOpen(false)
    inputRef.current?.blur()
  }

  function handleFocus() {
    setIsOpen(true)
    if (query.length >= 2 && results.length > 0) {
      // Already has results
    }
  }

  return (
    <div className={`${styles.search} ${isOpen ? styles.open : ''}`} ref={searchRef}>
      <div className={styles.inputWrapper}>
        <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          placeholder={isSeries ? "Rechercher une série..." : "Rechercher un film..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button 
            className={styles.clear}
            onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
            aria-label="Effacer"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className={styles.results}>
          {results.map((movie, index) => (
            <div
              key={movie.id}
              className={`${styles.result} ${index === selectedIndex ? styles.selected : ''}`}
              onClick={() => handleMovieClick(movie)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className={styles.poster}>
                <Image
                  src={movie.poster_url || '/placeholder-poster.svg'}
                  alt={movie.title}
                  width={40}
                  height={60}
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className={styles.info}>
                <div className={styles.title}>{movie.title}</div>
                <div className={styles.meta}>
                  {movie.year && <span>{movie.year}</span>}
                  {movie.rating && <span>★ {movie.rating.toFixed(1)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

