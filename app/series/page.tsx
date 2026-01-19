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
import ContinueWatchingRow from '@/components/ContinueWatchingRow/ContinueWatchingRow'
import SearchResultsGrid from '@/components/SearchResultsGrid/SearchResultsGrid'
import { normalizeString, similarity } from '@/components/SmartSearch/searchUtils'
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
  tmdb_id?: number | null // 🎬 Pour récupérer les trailers
}

export default function SeriesPage() {
  const [series, setSeries] = useState<SeriesData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSeries, setSelectedSeries] = useState<SeriesData | null>(null)
  const [heroSeries, setHeroSeries] = useState<SeriesData | null>(null)
  const [heroTrailerKey, setHeroTrailerKey] = useState<string | null>(null) // 🎬 Trailer YouTube
  const [refreshKey, setRefreshKey] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredSeries, setFilteredSeries] = useState<SeriesData[]>([])
  
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
  }, [])

  // 🎬 Charger le trailer de la série hero
  useEffect(() => {
    async function loadTrailer() {
      if (!heroSeries?.tmdb_id) {
        setHeroTrailerKey(null)
        return
      }
      
      try {
        const response = await fetch(`/api/trailer?tmdb_id=${heroSeries.tmdb_id}&type=tv`)
        const result = await response.json()
        
        if (result.success && result.trailer?.key) {
          console.log(`🎬 Trailer trouvé pour ${heroSeries.title}: ${result.trailer.key}`)
          setHeroTrailerKey(result.trailer.key)
        } else {
          setHeroTrailerKey(null)
        }
      } catch (error) {
        console.error('❌ Erreur chargement trailer:', error)
        setHeroTrailerKey(null)
      }
    }
    
    loadTrailer()
  }, [heroSeries])
  
  // Fonction de mélange aléatoire
  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Recherche intelligente (Titre, Genre)
  function handleSearch(query: string) {
    setSearchQuery(query)
    
    if (!query || query.length < 2) {
      setFilteredSeries([])
      return
    }

    const normalizedQuery = normalizeString(query)
    const queryWords = normalizedQuery.split(/\s+/)

    const scoredResults = series.map(serie => {
      let score = 0

      // 1. Titre (Priorité absolue)
      const normalizedTitle = normalizeString(serie.title)
      const titleSimilarity = similarity(normalizedQuery, normalizedTitle)
      if (titleSimilarity > 0.6) score += titleSimilarity * 20
      if (normalizedTitle.includes(normalizedQuery)) score += 15

      // 2. Mots clés dans le titre
      queryWords.forEach(word => {
        if (word.length >= 3 && normalizedTitle.includes(word)) score += 5
      })

      // 3. Genre
      if (serie.genres && Array.isArray(serie.genres)) {
        serie.genres.forEach((genre: string) => {
          const normalizedGenre = normalizeString(genre)
          if (normalizedGenre.includes(normalizedQuery)) score += 5
        })
      }

      // 4. Année
      if (serie.first_air_date) {
        const year = new Date(serie.first_air_date).getFullYear().toString()
        if (year === normalizedQuery) score += 10
      }

      return { serie, score }
    })

    const filtered = scoredResults
      .filter(r => r.score > 1)
      .sort((a, b) => b.score - a.score)
      .map(r => r.serie)

    setFilteredSeries(filtered)
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
            Aller à l&apos;admin
          </a>
        </div>
      </>
    )
  }
  
  return (
    <>
      <Header 
        series={validSeries as any} 
        onSeriesClick={setSelectedSeries as any}
        onSearch={handleSearch}
      />
      
      <main className={styles.main}>
        {searchQuery.length >= 2 ? (
          <SearchResultsGrid 
            movies={filteredSeries.map(s => ({
              ...s,
              tmdb_id: s.tmdb_id || 0,
              original_title: s.title,
              release_date: s.first_air_date,
              pcloud_fileid: null,
              created_at: s.created_at || '',
              year: s.first_air_date ? new Date(s.first_air_date).getFullYear() : undefined
            })) as any}
            query={searchQuery}
            onMovieClick={(movie) => {
              const serie = series.find(s => s.id === movie.id)
              if (serie) setSelectedSeries(serie)
            }}
          />
        ) : (
          <>
        {heroSeries && (
          <HeroSection 
            movie={{
              ...heroSeries,
              tmdb_id: heroSeries.tmdb_id || 0,
              original_title: heroSeries.title,
              release_date: heroSeries.first_air_date,
              pcloud_fileid: null,
              created_at: '',
              year: heroSeries.first_air_date ? new Date(heroSeries.first_air_date).getFullYear() : undefined,
              trailerKey: heroTrailerKey // 🎬 Passer le trailer
            } as any}
            onInfoClick={() => setSelectedSeries(heroSeries)}
            showPlayButton={false}
          />
        )}
        
        <div className={styles.content}>
          {/* Carrousel: Continuer le visionnage (EPISODES uniquement) */}
          <ContinueWatchingRow
            onMovieClick={() => {}}
            onEpisodeClick={(episode) => {
              console.log('[SERIES] Episode cliqué:', episode.title, 'series_id:', episode.series_id)
              // Trouver la série correspondante via series_id
              if (episode.series_id) {
                // Comparaison avec String() pour éviter les problèmes de type
                const serie = series.find(s => String(s.id) === String(episode.series_id))
                console.log('[SERIES] Série trouvée:', serie?.title || 'NON TROUVÉE')
                if (serie) {
                  setSelectedSeries(serie)
                } else {
                  // Fallback: créer un objet série minimal pour charger les détails
                  console.log('[SERIES] Fallback: création objet série minimal')
                  setSelectedSeries({
                    id: episode.series_id,
                    title: episode.title || 'Série',
                    poster_url: episode.poster_url || null,
                    backdrop_url: episode.backdrop_url || null,
                    rating: 0,
                    first_air_date: '',
                    genres: [],
                    overview: ''
                  })
                }
              }
            }}
            onRefresh={() => setRefreshKey(k => k + 1)}
            refreshKey={refreshKey}
            filter="episodes"
          />

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
          </>
        )}
        
        {selectedSeries && (
          <SeriesModal
            series={selectedSeries}
            onClose={() => {
              setSelectedSeries(null)
              setRefreshKey(k => k + 1) // Rafraîchir le carrousel
            }}
          />
        )}
      </main>
    </>
  )
}
