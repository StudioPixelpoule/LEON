/**
 * API Admin: Recherche manuelle sur TMDB
 * POST /api/admin/search-tmdb
 * Body: { query: string, year?: number, type: 'movie' | 'tv' }
 */

import { NextResponse } from 'next/server'
import { searchMovie, searchTVShow, type TMDBMovie, type TMDBTVShow } from '@/lib/tmdb'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { query, year, type } = body
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query manquante' },
        { status: 400 }
      )
    }
    
    const mediaType = type || 'movie'
    
    let results: any[] = []
    
    if (mediaType === 'movie') {
      const movies = await searchMovie(query, year)
      results = movies.map((movie: TMDBMovie) => ({
        id: movie.id,
        type: 'movie' as const,
        title: movie.title,
        original_title: movie.original_title,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
        poster_path: movie.poster_path,
        backdrop_path: movie.backdrop_path,
        overview: movie.overview,
        rating: movie.vote_average,
        genres: movie.genre_ids, // IDs uniquement pour la recherche
        popularity: movie.popularity,
      }))
    } else {
      const shows = await searchTVShow(query, year)
      results = shows.map((show: TMDBTVShow) => ({
        id: show.id,
        type: 'tv' as const,
        title: show.name,
        original_title: show.original_name,
        year: show.first_air_date ? new Date(show.first_air_date).getFullYear() : null,
        poster_path: show.poster_path,
        backdrop_path: show.backdrop_path,
        overview: show.overview,
        rating: show.vote_average,
        genres: show.genre_ids,
        popularity: show.popularity,
      }))
    }
    
    return NextResponse.json({
      success: true,
      count: results.length,
      results: results.slice(0, 10) // Limiter à 10 résultats
    })
    
  } catch (error) {
    console.error('Erreur recherche TMDB:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recherche TMDB' },
      { status: 500 }
    )
  }
}


