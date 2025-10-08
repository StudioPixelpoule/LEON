/**
 * Page Films - Catalogue complet des films
 */

'use client'

import { useState, useEffect } from 'react'
import HeroSection from '@/components/HeroSection/HeroSection'
import MovieRow from '@/components/MovieRow/MovieRow'
import MovieModal from '@/components/MovieModal/MovieModalWithTV'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import { groupMoviesByCategories, selectTopCategories } from '@/lib/genreClassification'
import styles from './films.module.css'

export default function FilmsPage() {
  const [movies, setMovies] = useState<GroupedMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMovie, setSelectedMovie] = useState<GroupedMedia | null>(null)
  const [heroMovie, setHeroMovie] = useState<GroupedMedia | null>(null)
  
  useEffect(() => {
    async function loadMovies() {
      try {
        setLoading(true)
        
        const response = await fetch('/api/media/grouped?type=movie')
        const result = await response.json()
        
        if (!response.ok || !result.success) {
          throw new Error('Erreur chargement films')
        }
        
        const movieList: GroupedMedia[] = result.media || []
        console.log(`✅ ${movieList.length} films chargés`)
        
        setMovies(movieList)
        
        // Sélectionner un film aléatoire pour le hero
        const withBackdrop = movieList.filter(m => m.backdrop_url)
        if (withBackdrop.length > 0) {
          const randomIndex = Math.floor(Math.random() * Math.min(20, withBackdrop.length))
          setHeroMovie(withBackdrop[randomIndex])
        }
      } catch (error) {
        console.error('❌ Erreur chargement films:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadMovies()
  }, [])
  
  const validMovies = movies.filter(m => 
    m.poster_url && 
    m.poster_url !== '/placeholder-poster.png' &&
    m.tmdb_id
  )
  
  const recentMovies = [...validMovies]
    .sort((a, b) => new Date(b.release_date || 0).getTime() - new Date(a.release_date || 0).getTime())
    .slice(0, 30) // Augmenté à 30 films
  
  const topRated = [...validMovies]
    .filter(m => m.rating && m.rating >= 7)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 30) // Augmenté à 30 films
  
  // Utiliser le système de classification intelligent
  // Chaque film sera dans maximum 2 catégories
  const genreGroups = groupMoviesByCategories(validMovies)
  
  // Sélectionner TOUTES les catégories qui ont au moins 3 films
  const topGenres = selectTopCategories(genreGroups, 99) // Pas de limite sur le nombre de catégories
  
  // Compter les films uniques affichés
  const displayedMovieIds = new Set<string>()
  recentMovies.forEach(m => displayedMovieIds.add(m.id))
  topRated.forEach(m => displayedMovieIds.add(m.id))
  topGenres.forEach(({ movies }) => movies.forEach(m => displayedMovieIds.add(m.id)))
  
  const notDisplayedCount = validMovies.length - displayedMovieIds.size
  
  async function handlePlayClick(filepath: string) {
    try {
      const response = await fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath }),
      })
      
      if (!response.ok) {
        throw new Error('Erreur ouverture fichier')
      }
      
      console.log('✅ Lecture lancée')
    } catch (error) {
      console.error('❌ Erreur lecture:', error)
      alert('Impossible d\'ouvrir le fichier')
    }
  }
  
  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Chargement des films...</p>
      </div>
    )
  }
  
  if (validMovies.length === 0) {
    return (
      <div className={styles.empty}>
        <h1>Aucun film trouvé</h1>
        <p>Lancez un scan depuis la page Admin.</p>
      </div>
    )
  }
  
  return (
    <main className={styles.main}>
      {heroMovie && (
        <HeroSection 
          movie={heroMovie} 
          onPlayClick={() => heroMovie.pcloud_fileid && handlePlayClick(heroMovie.pcloud_fileid)}
          onInfoClick={() => setSelectedMovie(heroMovie)}
        />
      )}
      
      <div className={styles.content}>
        <div className={styles.header}>
          <h1>Films</h1>
          <p>{validMovies.length} films disponibles</p>
          {notDisplayedCount > 0 && (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
              ({displayedMovieIds.size} affichés dans les catégories, {notDisplayedCount} dans "Tous les films")
            </p>
          )}
        </div>
        
        <div className={styles.rows}>
        {recentMovies.length > 0 && (
          <>
            <MovieRow
              title="Récemment ajoutés"
              movies={recentMovies}
              onMovieClick={setSelectedMovie}
            />
            <div className={styles.separator}></div>
          </>
        )}
        
        {topRated.length > 0 && (
          <>
            <MovieRow
              title="Mieux notés"
              movies={topRated}
              onMovieClick={setSelectedMovie}
            />
            <div className={styles.separator}></div>
          </>
        )}
        
        {topGenres.map(({ genre, movies }, index) => (
          <div key={genre}>
            <MovieRow
              title={genre}
              movies={movies}
              onMovieClick={setSelectedMovie}
            />
            <div className={styles.separator}></div>
          </div>
        ))}
        
        {/* Section "Tous les films" pour afficher TOUS les films */}
        {validMovies.length > 0 && (
          <MovieRow
            title="Tous les films"
            movies={validMovies}
            onMovieClick={setSelectedMovie}
          />
        )}
        </div>
      </div>
      
      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onPlayClick={(filepath) => handlePlayClick(filepath)}
        />
      )}
    </main>
  )
}

