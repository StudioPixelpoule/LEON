/**
 * Recherche intégrée dans le Header - Style Netflix/Apple TV+
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import styles from './HeaderSearch.module.css'

interface HeaderSearchProps {
  movies: GroupedMedia[]
  onMovieClick: (movie: GroupedMedia) => void
  isSeries?: boolean
  onSearch?: (query: string) => void
}

export default function HeaderSearch({ movies, onMovieClick, isSeries = false, onSearch }: HeaderSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onSearch) {
        onSearch(query)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, onSearch])

  // Clic en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        if (!query) {
          setIsOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [query])

  // Clavier
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
      setQuery('')
    }
  }

  function toggleSearch() {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  // Fermer la recherche sur mobile
  function closeSearch() {
    setIsOpen(false)
    setQuery('')
  }

  return (
    <div className={`${styles.search} ${isOpen ? styles.open : ''}`} ref={searchRef}>
      {/* Bouton fermer sur mobile (en overlay) */}
      {isOpen && (
        <button 
          className={styles.closeButton}
          onClick={closeSearch}
          aria-label="Fermer la recherche"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
      
      <div className={styles.inputWrapper}>
        <button 
          className={styles.searchButton}
          onClick={toggleSearch}
          aria-label="Rechercher"
        >
          <svg className={styles.icon} width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          placeholder={isSeries ? "Titres, personnes, genres..." : "Titres, personnes, genres..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        
        {query && (
          <button 
            className={styles.clear}
            onClick={() => { 
              setQuery('')
              inputRef.current?.focus()
            }}
            aria-label="Effacer"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}