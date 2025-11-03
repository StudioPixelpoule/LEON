/**
 * Page Films - Catalogue complet des films
 */

'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header/Header'
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
  const [refreshKey, setRefreshKey] = useState(0) // Pour forcer le re-render
  
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
        
        // Sélectionner un film COMPLÈTEMENT aléatoire pour le hero parmi tous les films avec backdrop
        const withBackdrop = movieList.filter(m => m.backdrop_url)
        if (withBackdrop.length > 0) {
          const randomIndex = Math.floor(Math.random() * withBackdrop.length)
          setHeroMovie(withBackdrop[randomIndex])
        }
      } catch (error) {
        console.error('❌ Erreur chargement films:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadMovies()
  }, [refreshKey]) // Re-mélanger quand refreshKey change
  
  // Fonction de mélange aléatoire (shuffle)
  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
  
  // Afficher TOUS les films, même sans poster (placeholder utilisé)
  const validMovies = movies.filter(m => m.tmdb_id) // Uniquement ceux identifiés sur TMDB
  
  // Films VRAIMENT récemment ajoutés dans LEON (par created_at)
  // Tri par date de création décroissante (les plus récents d'abord)
  const recentMovies = [...validMovies]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 30)
  
  // Mélanger les films les mieux notés
  const allTopRated = [...validMovies]
    .filter(m => m.rating && m.rating >= 7)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 60)
  const topRated = shuffleArray(allTopRated).slice(0, 30)
  
  // Utiliser le système de classification intelligent
  // Chaque film sera dans maximum 2 catégories
  const genreGroups = groupMoviesByCategories(validMovies)
  
  // Mélanger les films dans chaque catégorie
  Object.keys(genreGroups).forEach(genre => {
    genreGroups[genre] = shuffleArray(genreGroups[genre])
  })
  
  // Sélectionner TOUTES les catégories qui ont au moins 3 films
  const topGenres = selectTopCategories(genreGroups, 99) // Pas de limite sur le nombre de catégories
  
  // Compter les films uniques affichés
  const displayedMovieIds = new Set<string>()
  recentMovies.forEach(m => displayedMovieIds.add(m.id))
  topRated.forEach(m => displayedMovieIds.add(m.id))
  topGenres.forEach(({ movies }) => movies.forEach(m => displayedMovieIds.add(m.id)))
  
  const notDisplayedCount = validMovies.length - displayedMovieIds.size
  
  // La lecture est maintenant gérée directement par la modale MovieModal
  // qui ouvre le lecteur vidéo intégré
  
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
    <>
      <Header movies={validMovies} onMovieClick={setSelectedMovie} />
      
      <main className={styles.main}>
        {heroMovie && (
          <HeroSection 
            movie={heroMovie} 
            onPlayClick={() => setSelectedMovie(heroMovie)}
            onInfoClick={() => setSelectedMovie(heroMovie)}
          />
        )}
        
        <div className={styles.content}>
          {/* Bouton refresh discret */}
          <button 
            onClick={() => setRefreshKey(k => k + 1)}
            className={styles.refreshButton}
            title="Recharger et mélanger les films"
          >
            ↻
          </button>
        
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
          onPlayClick={() => {}} // Non utilisé, géré en interne par la modale
        />
      )}
      </main>
    </>
  )
}

