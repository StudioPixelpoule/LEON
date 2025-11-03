/**
 * Interface Admin Ultra-Simple - Correction des films
 * Navigation fluide, preview avant/après, raccourcis clavier
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import styles from './fix.module.css'

interface Issue {
  id: string
  media_id: string
  type: 'no_poster' | 'duplicate' | 'suspicious_match' | 'no_tmdb'
  severity: 'high' | 'medium' | 'low'
  title: string
  year: number | null
  poster_url: string | null
  pcloud_fileid: string
  details: string
  suggested_action: string
}

interface SearchResult {
  id: string
  source: 'tmdb' | 'omdb'
  title: string
  original_title: string
  year: number | null
  poster_url: string | null
  poster_high_res: string | null
  backdrop_url: string | null
  overview: string
  rating: number
  confidence: number
}

export default function FixPage() {
  const router = useRouter()
  const [issues, setIssues] = useState<Issue[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [applying, setApplying] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)
  
  const currentIssue = issues[currentIndex]
  
  // Charger les problèmes détectés
  useEffect(() => {
    loadIssues()
  }, [])
  
  // Préremplir la recherche avec le titre du film
  useEffect(() => {
    if (currentIssue) {
      setSearchQuery(currentIssue.title)
      setSearchResults([])
      setSelectedResult(null)
      setShowPreview(false)
    }
  }, [currentIndex, currentIssue])
  
  // Debounce de recherche
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }
    
    const timer = setTimeout(() => {
      handleSearch()
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchQuery])
  
  // Raccourcis clavier
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignorer si dans un input
      if (document.activeElement?.tagName === 'INPUT') {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement).blur()
        }
        return
      }
      
      switch (e.key) {
        case ' ': // Espace = Valider
          e.preventDefault()
          if (currentIssue && currentIssue.poster_url && currentIssue.poster_url !== '/placeholder-poster.png') {
            handleSkip()
          }
          break
        case 'ArrowRight': // → Suivant
          handleNext()
          break
        case 'ArrowLeft': // ← Précédent
          handlePrevious()
          break
        case 'Escape': // Échap = Ignorer
          handleSkip()
          break
        case 'Delete': // Suppr = Supprimer
          if (confirm('Supprimer ce film définitivement ?')) {
            handleDelete()
          }
          break
        case '/': // / = Focus recherche
          e.preventDefault()
          inputRef.current?.focus()
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIssue, currentIndex, issues])
  
  async function loadIssues() {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/detect-issues')
      const data = await response.json()
      
      if (data.success) {
        setIssues(data.issues)
        console.log(`✅ ${data.issues.length} problèmes chargés`)
      }
    } catch (error) {
      console.error('❌ Erreur chargement problèmes:', error)
    } finally {
      setLoading(false)
    }
  }
  
  async function handleSearch() {
    if (searchQuery.trim().length < 2) return
    
    try {
      setSearching(true)
      const response = await fetch('/api/admin/search-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          year: currentIssue?.year
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSearchResults(data.results || [])
      }
    } catch (error) {
      console.error('❌ Erreur recherche:', error)
    } finally {
      setSearching(false)
    }
  }
  
  function handleSelectResult(result: SearchResult) {
    setSelectedResult(result)
    setShowPreview(true)
  }
  
  async function handleApplyCorrection() {
    if (!selectedResult || !currentIssue) return
    
    try {
      setApplying(true)
      const response = await fetch('/api/admin/apply-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: currentIssue.media_id,
          source: selectedResult.source,
          resultId: selectedResult.id,
          reason: currentIssue.type
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        console.log('✅ Correction appliquée')
        // Passer au suivant
        handleNext()
      }
    } catch (error) {
      console.error('❌ Erreur application correction:', error)
    } finally {
      setApplying(false)
    }
  }
  
  function handleNext() {
    if (currentIndex < issues.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setShowPreview(false)
    }
  }
  
  function handlePrevious() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setShowPreview(false)
    }
  }
  
  function handleSkip() {
    handleNext()
  }
  
  async function handleDelete() {
    if (!currentIssue) return
    
    try {
      // TODO: Implémenter l'API de suppression
      console.log('🗑️ Suppression:', currentIssue.media_id)
      handleNext()
    } catch (error) {
      console.error('❌ Erreur suppression:', error)
    }
  }
  
  async function handleUploadCustomPoster() {
    // TODO: Implémenter l'upload de jaquette personnalisée
    console.log('📤 Upload custom poster')
  }
  
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Chargement des problèmes...</div>
      </div>
    )
  }
  
  if (issues.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <h1>✅ Aucun problème détecté</h1>
          <p>Tous les films sont correctement identifiés</p>
          <button onClick={() => router.push('/admin')} className={styles.backButton}>
            Retour admin
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button onClick={() => router.push('/admin')} className={styles.backButton}>
          ← Admin
        </button>
        
        <div className={styles.progress}>
          <span className={styles.progressText}>
            {currentIndex + 1} / {issues.length}
          </span>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${((currentIndex + 1) / issues.length) * 100}%` }}
            />
          </div>
        </div>
        
        <button onClick={handleSkip} className={styles.skipButton}>
          Ignorer
        </button>
      </div>
      
      {/* Contenu principal */}
      {currentIssue && (
        <div className={styles.main}>
          {/* Section actuelle */}
          <div className={styles.current}>
            <div className={styles.posterWrapper}>
              {currentIssue.poster_url && currentIssue.poster_url !== '/placeholder-poster.png' ? (
                <Image
                  src={currentIssue.poster_url}
                  alt={currentIssue.title}
                  fill
                  className={styles.poster}
                  unoptimized
                />
              ) : (
                <div className={styles.noPoster}>?</div>
              )}
            </div>
            
            <div className={styles.info}>
              <h2>{currentIssue.title}</h2>
              {currentIssue.year && <p className={styles.year}>{currentIssue.year}</p>}
              <p className={styles.details}>{currentIssue.details}</p>
              <p className={styles.filename}>{currentIssue.pcloud_fileid}</p>
              
              <div className={styles.severity}>
                <span className={`${styles.badge} ${styles[currentIssue.severity]}`}>
                  {currentIssue.severity === 'high' ? '🔴' : currentIssue.severity === 'medium' ? '🟡' : '🟢'}
                  {currentIssue.type === 'no_tmdb' ? 'Non identifié' :
                   currentIssue.type === 'no_poster' ? 'Sans jaquette' :
                   currentIssue.type === 'duplicate' ? 'Duplicata' : 'Suspect'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Recherche */}
          <div className={styles.search}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Rechercher le bon film..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searching && <div className={styles.searchLoader}>🔍</div>}
          </div>
          
          {/* Résultats */}
          {searchResults.length > 0 && (
            <div className={styles.results}>
              {searchResults.slice(0, 6).map((result) => (
                <div
                  key={result.id}
                  className={`${styles.resultCard} ${selectedResult?.id === result.id ? styles.selected : ''}`}
                  onClick={() => handleSelectResult(result)}
                >
                  {result.poster_url ? (
                    <Image
                      src={result.poster_url}
                      alt={result.title}
                      width={150}
                      height={225}
                      className={styles.resultPoster}
                      unoptimized
                    />
                  ) : (
                    <div className={styles.noResultPoster}>?</div>
                  )}
                  <div className={styles.resultInfo}>
                    <h3>{result.title}</h3>
                    {result.year && <p>{result.year}</p>}
                    <div className={styles.confidence}>
                      <div 
                        className={styles.confidenceBar}
                        style={{ width: `${result.confidence}%` }}
                      />
                      <span>{result.confidence}%</span>
                    </div>
                    <span className={styles.source}>{result.source.toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Preview avant/après */}
          {showPreview && selectedResult && (
            <div className={styles.preview}>
              <div className={styles.previewContent}>
                <div className={styles.previewColumn}>
                  <h3>Avant</h3>
                  {currentIssue.poster_url && currentIssue.poster_url !== '/placeholder-poster.png' ? (
                    <Image
                      src={currentIssue.poster_url}
                      alt="Avant"
                      width={200}
                      height={300}
                      unoptimized
                    />
                  ) : (
                    <div className={styles.previewNoPoster}>?</div>
                  )}
                  <p>{currentIssue.title}</p>
                </div>
                
                <div className={styles.previewArrow}>→</div>
                
                <div className={styles.previewColumn}>
                  <h3>Après</h3>
                  {selectedResult.poster_url ? (
                    <Image
                      src={selectedResult.poster_url}
                      alt="Après"
                      width={200}
                      height={300}
                      unoptimized
                    />
                  ) : (
                    <div className={styles.previewNoPoster}>?</div>
                  )}
                  <p>{selectedResult.title} ({selectedResult.year})</p>
                </div>
              </div>
              
              <div className={styles.previewActions}>
                <button onClick={() => setShowPreview(false)} className={styles.cancelButton}>
                  Annuler
                </button>
                <button 
                  onClick={handleApplyCorrection} 
                  className={styles.applyButton}
                  disabled={applying}
                >
                  {applying ? 'Application...' : '✅ Appliquer'}
                </button>
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className={styles.actions}>
            <button onClick={handleUploadCustomPoster} className={styles.uploadButton}>
              📤 Jaquette personnalisée
            </button>
            
            {currentIssue.type !== 'duplicate' && currentIssue.poster_url && currentIssue.poster_url !== '/placeholder-poster.png' && (
              <button onClick={handleSkip} className={styles.validButton}>
                ✅ C'est bon
              </button>
            )}
            
            <button 
              onClick={() => {
                if (confirm('Supprimer ce film définitivement ?')) {
                  handleDelete()
                }
              }} 
              className={styles.deleteButton}
            >
              🗑️ Supprimer
            </button>
          </div>
          
          {/* Navigation */}
          <div className={styles.navigation}>
            <button 
              onClick={handlePrevious} 
              disabled={currentIndex === 0}
              className={styles.navButton}
            >
              ← Précédent
            </button>
            <button 
              onClick={handleNext} 
              disabled={currentIndex === issues.length - 1}
              className={styles.navButton}
            >
              Suivant →
            </button>
          </div>
        </div>
      )}
      
      {/* Aide raccourcis */}
      <div className={styles.shortcuts}>
        <span>Espace : Valider</span>
        <span>←/→ : Navigation</span>
        <span>Échap : Ignorer</span>
        <span>/ : Rechercher</span>
      </div>
    </div>
  )
}




