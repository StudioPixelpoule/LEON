/**
 * Page Séries - Catalogue complet des séries TV
 * Même layout que la page Films avec rangées scrollables
 */

'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header/Header'
import HeroSection from '@/components/HeroSection/HeroSection'
import MovieRow from '@/components/MovieRow/MovieRow'
import SeriesModal from '@/components/SeriesModal/SeriesModal'
import styles from './series.module.css'

interface SeriesData {
  id: string
  title: string
  poster_url: string | null
  backdrop_url: string | null
  rating: number
  first_air_date: string
  genres: string[]
  overview: string
  episodeCount?: number
  created_at?: string
}

export default function SeriesPage() {
  const [series, setSeries] = useState<SeriesData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSeries, setSelectedSeries] = useState<SeriesData | null>(null)
  const [heroSeries, setHeroSeries] = useState<SeriesData | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  
  useEffect(() => {
    async function loadSeries() {
      try {
        setLoading(true)
        
        const response = await fetch('/api/series/list')
        const result = await response.json()
        
        if (!response.ok || !result.success) {
          throw new Error('Erreur chargement séries')
        }
        
        const seriesList: SeriesData[] = result.series || []
        console.log(`✅ ${seriesList.length} séries chargées`)
        
        setSeries(seriesList)
        
        // Sélectionner une série aléatoire avec backdrop pour le hero
        const withBackdrop = seriesList.filter(s => s.backdrop_url)
        if (withBackdrop.length > 0) {
          const randomIndex = Math.floor(Math.random() * withBackdrop.length)
          setHeroSeries(withBackdrop[randomIndex])
        }
      } catch (error) {
        console.error('❌ Erreur chargement séries:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadSeries()
  }, [refreshKey])
  
  // Fonction de mélange aléatoire
  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
  
  const validSeries = series.filter(s => s.title)
  
  // Séries VRAIMENT récemment ajoutées (par created_at)
  // Tri par date de création décroissante (les plus récentes d'abord)
  const recentSeries = [...validSeries]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 30)
  
  // Séries les mieux notées
  const topRated = shuffleArray(
    [...validSeries].filter(s => s.rating && s.rating >= 7).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 40)
  ).slice(0, 30)
  
  // Grouper par genres
  const genreGroups: Record<string, SeriesData[]> = {}
  validSeries.forEach(serie => {
    if (serie.genres && Array.isArray(serie.genres)) {
      serie.genres.forEach(genre => {
        if (!genreGroups[genre]) {
          genreGroups[genre] = []
        }
        genreGroups[genre].push(serie)
      })
    }
  })
  
  // Mélanger et sélectionner les top genres
  const topGenres = Object.entries(genreGroups)
    .filter(([_, series]) => series.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([genre, seriesList]) => ({
      genre,
      series: shuffleArray(seriesList).slice(0, 30)
    }))
  
  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Chargement des séries...</p>
      </div>
    )
  }
  
  if (validSeries.length === 0) {
    return (
      <>
        <Header />
        <div className={styles.empty}>
          <h1>Aucune série disponible</h1>
          <p>Scannez vos séries pour les voir apparaître ici</p>
          <a href="/admin" className={styles.adminLink}>
            Aller à l'admin
          </a>
        </div>
      </>
    )
  }
  
  return (
    <>
      <Header series={validSeries as any} onSeriesClick={setSelectedSeries as any} />
      
      <main className={styles.main}>
        {heroSeries && (
          <HeroSection 
            movie={{
              ...heroSeries,
              tmdb_id: 0,
              original_title: heroSeries.title,
              release_date: heroSeries.first_air_date,
              pcloud_fileid: null,
              created_at: '',
              year: heroSeries.first_air_date ? new Date(heroSeries.first_air_date).getFullYear() : undefined
            } as any}
            onInfoClick={() => setSelectedSeries(heroSeries)}
            showPlayButton={false}
          />
        )}
        
        <div className={styles.content}>
          {/* Bouton refresh discret */}
          <button 
            onClick={() => setRefreshKey(k => k + 1)}
            className={styles.refreshButton}
            title="Recharger et mélanger les séries"
          >
            ↻
          </button>
        
          <div className={styles.rows}>
            {recentSeries.length > 0 && (
              <>
                <MovieRow
                  title="Récemment ajoutées"
                  movies={recentSeries.map(s => ({
                    ...s,
                    tmdb_id: 0,
                    original_title: s.title,
                    release_date: s.first_air_date,
                    pcloud_fileid: null,
                    created_at: '',
                    year: s.first_air_date ? new Date(s.first_air_date).getFullYear() : undefined
                  })) as any}
                  onMovieClick={(movie) => {
                    const serie = series.find(s => s.id === movie.id)
                    if (serie) setSelectedSeries(serie)
                  }}
                />
                <div className={styles.separator}></div>
              </>
            )}
            
            {topRated.length > 0 && (
              <>
                <MovieRow
                  title="Mieux notées"
                  movies={topRated.map(s => ({
                    ...s,
                    tmdb_id: 0,
                    original_title: s.title,
                    release_date: s.first_air_date,
                    pcloud_fileid: null,
                    created_at: '',
                    year: s.first_air_date ? new Date(s.first_air_date).getFullYear() : undefined
                  })) as any}
                  onMovieClick={(movie) => {
                    const serie = series.find(s => s.id === movie.id)
                    if (serie) setSelectedSeries(serie)
                  }}
                />
                <div className={styles.separator}></div>
              </>
            )}
            
            {topGenres.map(({ genre, series: genreSeries }) => (
              <div key={genre}>
                <MovieRow
                  title={genre}
                  movies={genreSeries.map(s => ({
                    ...s,
                    tmdb_id: 0,
                    original_title: s.title,
                    release_date: s.first_air_date,
                    pcloud_fileid: null,
                    created_at: '',
                    year: s.first_air_date ? new Date(s.first_air_date).getFullYear() : undefined
                  })) as any}
                  onMovieClick={(movie) => {
                    const serie = series.find(s => s.id === movie.id)
                    if (serie) setSelectedSeries(serie)
                  }}
                />
                <div className={styles.separator}></div>
              </div>
            ))}
            
            {/* Toutes les séries */}
            {validSeries.length > 0 && (
              <MovieRow
                title="Toutes les séries"
                movies={validSeries.map(s => ({
                  ...s,
                  tmdb_id: 0,
                  original_title: s.title,
                  release_date: s.first_air_date,
                  pcloud_fileid: null,
                  created_at: '',
                  year: s.first_air_date ? new Date(s.first_air_date).getFullYear() : undefined
                })) as any}
                onMovieClick={(movie) => {
                  const serie = series.find(s => s.id === movie.id)
                  if (serie) setSelectedSeries(serie)
                }}
              />
            )}
          </div>
        </div>
        
        {selectedSeries && (
          <SeriesModal
            series={selectedSeries}
            onClose={() => setSelectedSeries(null)}
          />
        )}
      </main>
    </>
  )
}
