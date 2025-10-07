/**
 * Page Films - Catalogue complet des films
 */

'use client'

import { useState, useEffect } from 'react'
import HeroSection from '@/components/HeroSection/HeroSection'
import MovieRow from '@/components/MovieRow/MovieRow'
import MovieModal from '@/components/MovieModal/MovieModalWithTV'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
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
    .slice(0, 20)
  
  const topRated = [...validMovies]
    .filter(m => m.rating && m.rating >= 7)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 20)
  
  const genreGroups = validMovies.reduce((acc, movie) => {
    if (movie.genres) {
      movie.genres.forEach(genre => {
        if (!acc[genre]) acc[genre] = []
        acc[genre].push(movie)
      })
    }
    return acc
  }, {} as Record<string, GroupedMedia[]>)
  
  const topGenres = Object.entries(genreGroups)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6)
    .map(([genre, movies]) => ({
      genre,
      movies: movies.slice(0, 20)
    }))
  
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
            {index < topGenres.length - 1 && <div className={styles.separator}></div>}
          </div>
        ))}
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

