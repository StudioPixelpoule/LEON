/**
 * Barre de recherche minimaliste
 * Debounce de 300ms pour limiter les requêtes
 */

'use client'

import { useState, useEffect } from 'react'

type SearchBarProps = {
  onSearch: (query: string) => void
  placeholder?: string
}

export default function SearchBar({ 
  onSearch, 
  placeholder = 'Rechercher un film...' 
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  
  // Debounce de 300ms pour éviter trop de requêtes
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [query, onSearch])
  
  return (
    <div className="searchBar">
      <input
        type="text"
        className="searchInput"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Recherche"
      />
    </div>
  )
}




