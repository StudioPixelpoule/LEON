/**
 * Page Admin: Validation manuelle des médias non identifiés
 * Interface pour corriger titres, chercher sur TMDB, uploader jaquettes
 */

'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Header from '@/components/Header/Header'
import styles from './validate.module.css'

type Media = {
  id: string
  title: string
  pcloud_fileid: string
  tmdb_id: number | null
  poster_url: string | null
  year: number | null
}

type TMDBResult = {
  id: number
  type: 'movie'
  title: string
  original_title: string
  year: number | null
  poster_path: string | null
  overview: string
  rating: number
  popularity: number
}

type Filter = 'all' | 'no_tmdb' | 'no_poster'

export default function ValidatePage() {
  const [mediaList, setMediaList] = useState<Media[]>([])
  const [filteredMedia, setFilteredMedia] = useState<Media[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('no_tmdb')
  
  // État du média en cours
  const [correctedTitle, setCorrectedTitle] = useState('')
  const [correctedYear, setCorrectedYear] = useState<number | null>(null)
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([])
  const [searching, setSearching] = useState(false)
  const [validating, setValidating] = useState(false)
  const [uploadedPosterUrl, setUploadedPosterUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  
  const currentMedia = filteredMedia[currentIndex]
  
  // Charger les médias non identifiés
  useEffect(() => {
    loadMedia()
  }, [])
  
  // Appliquer le filtre
  useEffect(() => {
    applyFilter()
  }, [mediaList, filter])
  
  // Réinitialiser le formulaire quand on change de média
  useEffect(() => {
    if (currentMedia) {
      setCorrectedTitle(cleanTitle(currentMedia.title))
      setCorrectedYear(currentMedia.year)
      setSearchResults([])
      setUploadedPosterUrl(null)
    }
  }, [currentIndex, currentMedia])
  
  async function loadMedia() {
    try {
      setLoading(true)
      const response = await fetch('/api/media/list')
      const data = await response.json()
      setMediaList(data)
    } catch (error) {
      console.error('Erreur chargement médias:', error)
    } finally {
      setLoading(false)
    }
  }
  
  function applyFilter() {
    let filtered = [...mediaList]
    
    if (filter === 'no_tmdb') {
      filtered = filtered.filter(m => !m.tmdb_id)
    } else if (filter === 'no_poster') {
      filtered = filtered.filter(m => !m.poster_url || m.poster_url === '/placeholder-poster.png')
    }
    
    setFilteredMedia(filtered)
    setCurrentIndex(0)
  }
  
  function cleanTitle(filename: string): string {
    return filename
      .replace(/\.(mkv|mp4|avi|mov|webm)$/i, '')
      .replace(/[._-]/g, ' ')
      .replace(/\b(1080p|720p|FRENCH|WEB-DL|H264|x264|x265|Slay3R|MULTI|TRUEFRENCH|VFF|VFQ)\b/gi, '')
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
          year: correctedYear,
          type: 'movie'
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
    if (!currentMedia) return
    
    try {
      setValidating(true)
      const response = await fetch('/api/admin/validate-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: currentMedia.id,
          tmdbId: result.id,
          type: 'movie'
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        console.log(`✅ Film validé:`, result.title)
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
    if (!file || !currentMedia) return
    
    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mediaId', currentMedia.id)
      
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
    if (!currentMedia) return
    
    if (!uploadedPosterUrl && !correctedTitle) {
      alert('Veuillez uploader une jaquette ou corriger le titre')
      return
    }
    
    try {
      setValidating(true)
      const response = await fetch('/api/admin/validate-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: currentMedia.id,
          customPosterUrl: uploadedPosterUrl,
          correctedTitle: correctedTitle,
          type: 'movie'
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        console.log('✅ Média validé avec jaquette personnalisée')
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
    if (currentIndex < filteredMedia.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      alert('✅ Tous les médias ont été traités !')
      loadMedia() // Recharger
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
  
  if (filteredMedia.length === 0) {
    return (
      <>
        <Header />
        
        <div className={styles.container}>
          <header className={styles.header}>
            <Link href="/admin" className={styles.backLink}>← Retour Admin</Link>
            <h1>Validation manuelle</h1>
          </header>
          <div className={styles.empty}>
            <p>Tous les médias sont identifiés</p>
              <div className={styles.filters}>
                <button onClick={() => setFilter('all')}>Voir tous</button>
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
          <h1>Validation manuelle</h1>
          <p className={styles.progress}>
          {currentIndex + 1} / {filteredMedia.length} médias à traiter
        </p>
      </header>
      
      {/* Filtres */}
      <div className={styles.filters}>
        <button 
          className={filter === 'all' ? styles.active : ''}
          onClick={() => setFilter('all')}
        >
          Tous ({mediaList.length})
        </button>
        <button 
          className={filter === 'no_tmdb' ? styles.active : ''}
          onClick={() => setFilter('no_tmdb')}
        >
          Sans TMDB ID ({mediaList.filter(m => !m.tmdb_id).length})
        </button>
        <button 
          className={filter === 'no_poster' ? styles.active : ''}
          onClick={() => setFilter('no_poster')}
        >
          Sans poster ({mediaList.filter(m => !m.poster_url || m.poster_url === '/placeholder-poster.png').length})
        </button>
      </div>
      
      {/* Carte de validation */}
      {currentMedia && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>{currentMedia.title}</h2>
            <p className={styles.filepath}>{currentMedia.pcloud_fileid}</p>
          </div>
          
          <div className={styles.cardBody}>
            {/* Formulaire de correction */}
            <div className={styles.form}>
              <label>
                Titre corrigé
                <input 
                  type="text"
                  value={correctedTitle}
                  onChange={(e) => setCorrectedTitle(e.target.value)}
                  placeholder="Ex: À bicyclette"
                />
              </label>
              
              <label>
                Année
                <input 
                  type="number"
                  value={correctedYear || ''}
                  onChange={(e) => setCorrectedYear(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="2025"
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
                          alt={result.title}
                          width={46}
                          height={69}
                          className={styles.resultPoster}
                          unoptimized
                        />
                      )}
                      <div className={styles.resultInfo}>
                        <h4>{result.title} {result.year && `(${result.year})`}</h4>
                        <p className={styles.resultOverview}>{result.overview}</p>
                        <p className={styles.resultMeta}>
                          ⭐ {result.rating?.toFixed(1) || 'N/A'} · 
                          {result.type === 'movie' ? ' Film' : ' Série TV'}
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

