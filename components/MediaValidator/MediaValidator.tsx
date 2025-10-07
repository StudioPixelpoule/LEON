/**
 * Interface de validation manuelle des films non identifiés
 * Permet de corriger et d'apprendre des erreurs de reconnaissance
 */

'use client'

import { useState } from 'react'
import styles from './MediaValidator.module.css'
import { SuggestionCard, type MovieSuggestion } from './SuggestionCard'
import { saveManualMatch } from '@/lib/media-recognition/learningCache'

export interface UnmatchedFile {
  id: string
  filename: string
  size: number
  suggestions: MovieSuggestion[]
}

interface MediaValidatorProps {
  unmatchedFiles: UnmatchedFile[]
  onValidation: (fileId: string, tmdbId: number) => void
}

export function MediaValidator({ unmatchedFiles, onValidation }: MediaValidatorProps) {
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({})
  const [searching, setSearching] = useState<Record<string, boolean>>({})
  const [searchResults, setSearchResults] = useState<Record<string, MovieSuggestion[]>>({})
  
  const handleManualSearch = async (fileId: string) => {
    const query = searchQueries[fileId]
    if (!query || query.length < 2) return
    
    setSearching(prev => ({ ...prev, [fileId]: true }))
    
    try {
      const response = await fetch('/api/media/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })
      
      if (!response.ok) {
        throw new Error('Erreur recherche')
      }
      
      const results = await response.json()
      
      setSearchResults(prev => ({
        ...prev,
        [fileId]: results.suggestions || []
      }))
      
    } catch (error) {
      console.error('Erreur recherche manuelle:', error)
    } finally {
      setSearching(prev => ({ ...prev, [fileId]: false }))
    }
  }
  
  const handleConfirmMatch = async (file: UnmatchedFile, movie: MovieSuggestion) => {
    try {
      // Sauvegarder dans le cache d'apprentissage
      await saveManualMatch({
        filename: file.filename,
        tmdbId: movie.tmdbId,
        title: movie.title,
        year: movie.year,
        posterPath: movie.posterPath || ''
      })
      
      // Notifier le parent
      onValidation(file.id, movie.tmdbId)
      
    } catch (error) {
      console.error('Erreur sauvegarde match:', error)
    }
  }
  
  if (!unmatchedFiles.length) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>✓ Tous les films sont identifiés</p>
      </div>
    )
  }
  
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>
          Films à identifier
          <span className={styles.count}>{unmatchedFiles.length}</span>
        </h2>
        <p className={styles.subtitle}>
          Validez les suggestions automatiques ou recherchez manuellement
        </p>
      </header>
      
      <div className={styles.list}>
        {unmatchedFiles.map(file => {
          const displaySuggestions = searchResults[file.id] || file.suggestions
          
          return (
            <div key={file.id} className={styles.item}>
              <div className={styles.fileInfo}>
                <p className={styles.filename}>{file.filename}</p>
                <p className={styles.fileSize}>
                  {(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                </p>
              </div>
              
              {/* Suggestions automatiques ou résultats de recherche */}
              {displaySuggestions.length > 0 ? (
                <div className={styles.suggestions}>
                  <p className={styles.suggestionsLabel}>
                    {searchResults[file.id] ? 'Résultats :' : 'Suggestions :'}
                  </p>
                  <div className={styles.suggestionGrid}>
                    {displaySuggestions.slice(0, 3).map(movie => (
                      <SuggestionCard
                        key={movie.tmdbId}
                        movie={movie}
                        onSelect={() => handleConfirmMatch(file, movie)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <p className={styles.noSuggestions}>
                  Aucune suggestion automatique trouvée
                </p>
              )}
              
              {/* Recherche manuelle */}
              <div className={styles.manualSearch}>
                <input
                  type="text"
                  placeholder="Rechercher manuellement sur TMDB..."
                  className={styles.searchInput}
                  value={searchQueries[file.id] || ''}
                  onChange={e => setSearchQueries(prev => ({
                    ...prev,
                    [file.id]: e.target.value
                  }))}
                  onKeyDown={e => e.key === 'Enter' && handleManualSearch(file.id)}
                />
                <button
                  className={styles.searchButton}
                  onClick={() => handleManualSearch(file.id)}
                  disabled={searching[file.id] || !searchQueries[file.id]?.length}
                >
                  {searching[file.id] ? (
                    <div className={styles.loading}>
                      <span className={styles.dot}></span>
                      <span className={styles.dot}></span>
                      <span className={styles.dot}></span>
                    </div>
                  ) : (
                    'Rechercher'
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}




