/**
 * Page Films - Catalogue complet des films
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/Header/Header'
import HeroSection from '@/components/HeroSection/HeroSection'
import MovieRow from '@/components/MovieRow/MovieRow'
import MovieModal from '@/components/MovieModal/MovieModalWithTV'
import ContinueWatchingRow from '@/components/ContinueWatchingRow/ContinueWatchingRow'
import FavoritesRow from '@/components/FavoritesRow/FavoritesRow'
import RandomMoviesRow from '@/components/RandomMoviesRow/RandomMoviesRow'
import SearchResultsGrid from '@/components/SearchResultsGrid/SearchResultsGrid'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import { groupMoviesByCategories, selectTopCategories } from '@/lib/genreClassification'
import { normalizeString, similarity } from '@/components/SmartSearch/searchUtils'
import styles from './films.module.css'

export default function FilmsPage() {
  const [movies, setMovies] = useState<GroupedMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMovie, setSelectedMovie] = useState<GroupedMedia | null>(null)
  const [autoPlay, setAutoPlay] = useState(false) // Pour lancer la lecture directement
  const [heroMovie, setHeroMovie] = useState<GroupedMedia | null>(null)
  const [refreshKey, setRefreshKey] = useState(0) // Pour forcer le re-render
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredMovies, setFilteredMovies] = useState<GroupedMedia[]>([])
  
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
        
        // Hero: Sélectionner parmi les 10 derniers films ajoutés
        const recentWithBackdrop = movieList
          .filter(m => m.backdrop_url)
          .sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime()
            const dateB = new Date(b.created_at || 0).getTime()
            return dateB - dateA // Plus récent en premier
          })
          .slice(0, 10) // Top 10 derniers ajouts
        
        if (recentWithBackdrop.length > 0) {
          const randomIndex = Math.floor(Math.random() * recentWithBackdrop.length)
          setHeroMovie(recentWithBackdrop[randomIndex])
        }
      } catch (error) {
        console.error('❌ Erreur chargement films:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadMovies()
  }, []) // Charger une seule fois au montage
  
  // Fonction de mélange aléatoire (shuffle)
  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Recherche intelligente (Titre, Acteurs, Réalisateur, Genre)
  function handleSearch(query: string) {
    setSearchQuery(query)
    
    if (!query || query.length < 2) {
      setFilteredMovies([])
      return
    }

    const normalizedQuery = normalizeString(query)
    const queryWords = normalizedQuery.split(/\s+/)

    const scoredResults = movies.map(movie => {
      let score = 0

      // 1. Titre (Priorité absolue)
      const normalizedTitle = normalizeString(movie.title)
      const titleSimilarity = similarity(normalizedQuery, normalizedTitle)
      if (titleSimilarity > 0.6) score += titleSimilarity * 20
      if (normalizedTitle.includes(normalizedQuery)) score += 15

      // 2. Titre original
      if (movie.original_title) {
        const normalizedOriginal = normalizeString(movie.original_title)
        if (normalizedOriginal.includes(normalizedQuery)) score += 10
      }

      // 3. Mots clés dans le titre
      queryWords.forEach(word => {
        if (word.length >= 3 && normalizedTitle.includes(word)) score += 5
      })

      // 4. Acteurs (Cast)
      if (movie.movie_cast && Array.isArray(movie.movie_cast)) {
        movie.movie_cast.slice(0, 10).forEach((actor: any) => {
          if (actor.name) {
            const normalizedActor = normalizeString(actor.name)
            if (normalizedActor.includes(normalizedQuery)) score += 8
          }
        })
      }

      // 5. Réalisateur
      if (movie.director) {
        const directorName = typeof movie.director === 'string' ? movie.director : movie.director.name
        if (directorName) {
          const normalizedDirector = normalizeString(directorName)
          if (normalizedDirector.includes(normalizedQuery)) score += 8
        }
      }

      // 6. Genre
      if (movie.genres) {
        movie.genres.forEach((genre: any) => {
          const genreName = typeof genre === 'string' ? genre : genre.name
          if (genreName) {
            const normalizedGenre = normalizeString(genreName)
            if (normalizedGenre.includes(normalizedQuery)) score += 5
          }
        })
      }

      // 7. Année
      if (movie.year && movie.year.toString() === normalizedQuery) {
        score += 10
      }

      return { movie, score }
    })

    const filtered = scoredResults
      .filter(r => r.score > 1)
      .sort((a, b) => b.score - a.score)
      .map(r => r.movie)

    setFilteredMovies(filtered)
  }
  
  // Afficher TOUS les films, même sans poster (placeholder utilisé)
  const validMovies = useMemo(() => 
    movies.filter(m => m.tmdb_id), // Uniquement ceux identifiés sur TMDB
    [movies]
  )
  
  // Films VRAIMENT récemment ajoutés dans LEON (par created_at)
  // Tri par date de création décroissante (les plus récents d'abord)
  const recentMovies = useMemo(() => 
    [...validMovies]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 30),
    [validMovies]
  )
  
  // Mélanger les films les mieux notés (une seule fois quand movies change)
  const topRated = useMemo(() => {
    const allTopRated = [...validMovies]
      .filter(m => m.rating && m.rating >= 7)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 60)
    return shuffleArray(allTopRated).slice(0, 30)
  }, [validMovies])
  
  // Utiliser le système de classification intelligent (mémorisé)
  // Chaque film sera dans maximum 2 catégories
  const topGenres = useMemo(() => {
    const genreGroups = groupMoviesByCategories(validMovies)
    
    // Mélanger les films dans chaque catégorie
    Object.keys(genreGroups).forEach(genre => {
      genreGroups[genre] = shuffleArray(genreGroups[genre])
    })
    
    // Sélectionner TOUTES les catégories qui ont au moins 3 films
    return selectTopCategories(genreGroups, 99) // Pas de limite sur le nombre de catégories
  }, [validMovies])
  
  // Compter les films uniques affichés
  const notDisplayedCount = useMemo(() => {
    const displayedMovieIds = new Set<string>()
    recentMovies.forEach(m => displayedMovieIds.add(m.id))
    topRated.forEach(m => displayedMovieIds.add(m.id))
    topGenres.forEach(({ movies: genreMovies }) => genreMovies.forEach(m => displayedMovieIds.add(m.id)))
    return validMovies.length - displayedMovieIds.size
  }, [validMovies, recentMovies, topRated, topGenres])
  
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
      <Header 
        movies={validMovies} 
        onMovieClick={setSelectedMovie} 
        onSearch={handleSearch}
      />
      
      <main className={styles.main}>
        {searchQuery.length >= 2 ? (
          <SearchResultsGrid 
            movies={filteredMovies} 
            query={searchQuery}
            onMovieClick={setSelectedMovie}
          />
        ) : (
          <>
            {heroMovie && (
              <HeroSection 
                movie={heroMovie} 
                onPlayClick={() => setSelectedMovie(heroMovie)}
                onInfoClick={() => setSelectedMovie(heroMovie)}
              />
            )}
            
            <div className={styles.content}>
              {/* Carrousel: Continuer le visionnage */}
              <ContinueWatchingRow 
                onMovieClick={setSelectedMovie}
                onMoviePlay={(movie) => {
                  setSelectedMovie(movie)
                  setAutoPlay(true)
                }}
                onRefresh={() => setRefreshKey(k => k + 1)}
                refreshKey={refreshKey}
              />
              
              {/* Carrousel: Ma liste (favoris) */}
              <FavoritesRow 
                onMovieClick={setSelectedMovie}
                refreshKey={refreshKey}
              />
              
              {/* Bouton refresh discret */}
              <button 
                onClick={() => setRefreshKey(k => k + 1)}
                className={styles.refreshButton}
                title="Recharger et mélanger les films"
              >
                ↻
              </button>
            
            <div className={styles.rows}>
            {/* Carrousel: À découvrir (aléatoire) */}
            <RandomMoviesRow 
              movies={validMovies}
              onMovieClick={setSelectedMovie}
            />
            
            {recentMovies.length > 0 && (
              <MovieRow
                title="Derniers ajouts"
                movies={recentMovies}
                onMovieClick={setSelectedMovie}
              />
            )}
            
            {topRated.length > 0 && (
              <MovieRow
                title="Mieux notés"
                movies={topRated}
                onMovieClick={setSelectedMovie}
              />
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
          </>
        )}
      
      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => {
            setSelectedMovie(null)
            setAutoPlay(false) // Réinitialiser l'autoplay
            setRefreshKey(k => k + 1) // 🔄 Rafraîchir le carrousel "Continuer le visionnage"
          }}
          onPlayClick={() => {}} // Non utilisé, géré en interne par la modale
          autoPlay={autoPlay} // Passer l'état autoPlay à la modale
        />
      )}
      </main>
    </>
  )
}