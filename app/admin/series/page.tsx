/**
 * Page Admin: Validation manuelle des séries
 * Interface pour corriger titres, chercher sur TMDB, uploader jaquettes pour les séries
 */

'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Header from '@/components/Header/Header'
import styles from './series-admin.module.css'

type Series = {
  id: string
  title: string
  tmdb_id: number | null
  poster_url: string | null
  backdrop_url: string | null
  local_folder_path: string
  episodeCount?: number
}

type TMDBResult = {
  id: number
  type: 'tv'
  name: string
  original_name: string
  first_air_date: string | null
  poster_path: string | null
  backdrop_path: string | null
  overview: string
  vote_average: number
  popularity: number
}

type Filter = 'all' | 'no_tmdb' | 'no_poster'

export default function SeriesAdminPage() {
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [filteredSeries, setFilteredSeries] = useState<Series[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('no_tmdb')
  const [searchQuery, setSearchQuery] = useState('')
  
  // État de la série en cours
  const [correctedTitle, setCorrectedTitle] = useState('')
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([])
  const [searching, setSearching] = useState(false)
  const [validating, setValidating] = useState(false)
  const [uploadedPosterUrl, setUploadedPosterUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  
  const currentSeries = filteredSeries[currentIndex]
  
  // Charger les séries
  useEffect(() => {
    loadSeries()
  }, [])
  
  // Appliquer le filtre et la recherche
  useEffect(() => {
    applyFilter()
  }, [seriesList, filter, searchQuery])
  
  // Réinitialiser le formulaire quand on change de série
  useEffect(() => {
    if (currentSeries) {
      setCorrectedTitle(cleanTitle(currentSeries.title))
      setSearchResults([])
      setUploadedPosterUrl(null)
    }
  }, [currentIndex, currentSeries])
  
  async function loadSeries() {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/series/list')
      const data = await response.json()
      
      if (Array.isArray(data)) {
        setSeriesList(data)
      } else {
        console.error('Format de données invalide:', data)
        setSeriesList([])
      }
    } catch (error) {
      console.error('Erreur chargement séries:', error)
      setSeriesList([])
    } finally {
      setLoading(false)
    }
  }
  
  function applyFilter() {
    if (!Array.isArray(seriesList)) {
      setFilteredSeries([])
      return
    }
    
    let filtered = [...seriesList]
    
    // Appliquer le filtre de type
    if (filter === 'no_tmdb') {
      filtered = filtered.filter(s => !s.tmdb_id)
    } else if (filter === 'no_poster') {
      filtered = filtered.filter(s => !s.poster_url || s.poster_url === '/placeholder-poster.png')
    }
    
    // Appliquer la recherche textuelle
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(query)
      )
    }
    
    setFilteredSeries(filtered)
    setCurrentIndex(0)
  }
  
  function cleanTitle(title: string): string {
    return title
      .replace(/[._-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  
  async function handleSearch() {
    if (!correctedTitle.trim()) {
      alert('Veuillez entrer un titre')
      return
    }
    
    try {
      setSearching(true)
      const response = await fetch('/api/admin/search-tmdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: correctedTitle,
          type: 'tv'
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSearchResults(data.results)
        if (data.results.length === 0) {
          alert('Aucun résultat trouvé. Essayez de modifier le titre ou uploadez une jaquette personnalisée.')
        }
      } else {
        alert(`Erreur: ${data.error}`)
      }
    } catch (error) {
      console.error('Erreur recherche:', error)
      alert('Erreur lors de la recherche')
    } finally {
      setSearching(false)
    }
  }
  
  async function handleSelectResult(result: TMDBResult) {
    if (!currentSeries) return
    
    try {
      setValidating(true)
      const response = await fetch('/api/admin/series/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesId: currentSeries.id,
          tmdbId: result.id
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        console.log(`✅ Série validée:`, result.name)
        goToNext()
      } else {
        alert(`Erreur: ${data.error}`)
      }
    } catch (error) {
      console.error('Erreur validation:', error)
      alert('Erreur lors de la validation')
    } finally {
      setValidating(false)
    }
  }
  
  async function handleUploadPoster(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentSeries) return
    
    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('seriesId', currentSeries.id)
      formData.append('type', 'series')
      
      const response = await fetch('/api/admin/upload-poster', {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      
      if (data.success) {
        setUploadedPosterUrl(data.url)
        alert('✅ Jaquette uploadée ! Cliquez sur "Valider" pour enregistrer.')
      } else {
        alert(`Erreur: ${data.error}`)
      }
    } catch (error) {
      console.error('Erreur upload:', error)
      alert('Erreur lors de l\'upload')
    } finally {
      setUploading(false)
    }
  }
  
  async function handleValidateCustom() {
    if (!currentSeries) return
    
    if (!uploadedPosterUrl && !correctedTitle) {
      alert('Veuillez uploader une jaquette ou corriger le titre')
      return
    }
    
    try {
      setValidating(true)
      const response = await fetch('/api/admin/series/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesId: currentSeries.id,
          customPosterUrl: uploadedPosterUrl,
          correctedTitle: correctedTitle
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        console.log('✅ Série validée avec jaquette personnalisée')
        goToNext()
      } else {
        alert(`Erreur: ${data.error}`)
      }
    } catch (error) {
      console.error('Erreur validation:', error)
      alert('Erreur lors de la validation')
    } finally {
      setValidating(false)
    }
  }
  
  function goToNext() {
    if (currentIndex < filteredSeries.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      alert('✅ Toutes les séries ont été traitées !')
      loadSeries()
    }
  }
  
  function goToPrevious() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }
  
  if (loading) {
    return <div className={styles.loading}>Chargement...</div>
  }
  
  if (filteredSeries.length === 0) {
    return (
      <>
        <Header />
        
        <div className={styles.container}>
          <header className={styles.header}>
            <Link href="/admin" className={styles.backLink}>← Retour Admin</Link>
            <h1>Validation des séries</h1>
          </header>
          <div className={styles.empty}>
            <p>Toutes les séries sont identifiées</p>
            <div className={styles.filters}>
              <button onClick={() => setFilter('all')}>Voir toutes</button>
              <button onClick={() => setFilter('no_tmdb')}>Sans TMDB ID</button>
              <button onClick={() => setFilter('no_poster')}>Sans poster</button>
            </div>
          </div>
        </div>
      </>
    )
  }
  
  return (
    <>
      <Header />
      
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/admin" className={styles.backLink}>← Retour Admin</Link>
          <h1>Validation des séries</h1>
          <p className={styles.progress}>
            {currentIndex + 1} / {filteredSeries.length} séries
            {searchQuery && <span className={styles.filtered}> (filtrées)</span>}
          </p>
        </header>
        
        {/* Filtres et recherche */}
        <div className={styles.filtersSection}>
          <div className={styles.filters}>
            <button 
              className={filter === 'all' ? styles.active : ''}
              onClick={() => setFilter('all')}
            >
              Toutes ({seriesList.length})
            </button>
            <button 
              className={filter === 'no_tmdb' ? styles.active : ''}
              onClick={() => setFilter('no_tmdb')}
            >
              Sans TMDB ID ({seriesList.filter(s => !s.tmdb_id).length})
            </button>
            <button 
              className={filter === 'no_poster' ? styles.active : ''}
              onClick={() => setFilter('no_poster')}
            >
              Sans poster ({seriesList.filter(s => !s.poster_url || s.poster_url === '/placeholder-poster.png').length})
            </button>
          </div>
          
          <div className={styles.searchBox}>
            <input 
              type="text"
              placeholder="Rechercher une série..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button 
                className={styles.clearButton}
                onClick={() => setSearchQuery('')}
                title="Effacer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        
        {/* Carte de validation */}
        {currentSeries && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>{currentSeries.title}</h2>
              <p className={styles.filepath}>{currentSeries.local_folder_path}</p>
              {currentSeries.episodeCount && (
                <p className={styles.episodeCount}>📺 {currentSeries.episodeCount} épisodes</p>
              )}
            </div>
            
            <div className={styles.cardBody}>
              {/* Poster actuel */}
              {currentSeries.poster_url && (
                <div className={styles.currentPoster}>
                  <h3>Jaquette actuelle</h3>
                  <Image
                    src={currentSeries.poster_url}
                    alt={currentSeries.title}
                    width={150}
                    height={225}
                    className={styles.posterImage}
                    unoptimized
                  />
                </div>
              )}
              
              {/* Formulaire de correction */}
              <div className={styles.form}>
                <label>
                  Titre corrigé
                  <input 
                    type="text"
                    value={correctedTitle}
                    onChange={(e) => setCorrectedTitle(e.target.value)}
                    placeholder="Ex: Better Call Saul"
                  />
                </label>
                
                <button 
                  className={styles.searchButton}
                  onClick={handleSearch}
                  disabled={searching || !correctedTitle.trim()}
                >
                  {searching ? 'Recherche en cours...' : 'Rechercher sur TMDB'}
                </button>
              </div>
              
              {/* Résultats TMDB */}
              {searchResults.length > 0 && (
                <div className={styles.results}>
                  <h3>Résultats TMDB ({searchResults.length})</h3>
                  <div className={styles.resultsList}>
                    {searchResults.map(result => (
                      <div key={result.id} className={styles.resultCard}>
                        {result.poster_path && (
                          <Image
                            src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                            alt={result.name}
                            width={46}
                            height={69}
                            className={styles.resultPoster}
                            unoptimized
                          />
                        )}
                        <div className={styles.resultInfo}>
                          <h4>{result.name} {result.first_air_date && `(${new Date(result.first_air_date).getFullYear()})`}</h4>
                          <p className={styles.resultOverview}>{result.overview}</p>
                          <p className={styles.resultMeta}>
                            ⭐ {result.vote_average?.toFixed(1) || 'N/A'} · Série TV
                          </p>
                        </div>
                        <button
                          className={styles.selectButton}
                          onClick={() => handleSelectResult(result)}
                          disabled={validating}
                        >
                          {validating ? 'Validation...' : 'Sélectionner'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Upload jaquette personnalisée */}
              <div className={styles.uploadSection}>
                <h3>Ou uploader une jaquette personnalisée</h3>
                <div className={styles.uploadArea}>
                  <input 
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleUploadPoster}
                    disabled={uploading}
                    id="posterUpload"
                    className={styles.fileInput}
                  />
                  <label htmlFor="posterUpload" className={styles.uploadLabel}>
                    {uploading ? 'Upload en cours...' : uploadedPosterUrl ? 'Jaquette uploadée' : 'Choisir une image'}
                  </label>
                  {uploadedPosterUrl && (
                    <div className={styles.uploadPreview}>
                      <Image src={uploadedPosterUrl} alt="Preview" width={100} height={150} unoptimized />
                    </div>
                  )}
                </div>
                {uploadedPosterUrl && (
                  <button
                    className={styles.validateButton}
                    onClick={handleValidateCustom}
                    disabled={validating}
                  >
                    {validating ? 'Validation en cours...' : 'Valider avec cette jaquette'}
                  </button>
                )}
              </div>
            </div>
            
            {/* Navigation */}
            <div className={styles.cardFooter}>
              <button onClick={goToPrevious} disabled={currentIndex === 0}>
                Précédent
              </button>
              <button onClick={goToNext} className={styles.skipButton}>
                Ignorer
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}




