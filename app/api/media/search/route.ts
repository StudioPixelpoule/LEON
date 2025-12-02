/**
 * API Route: Recherche manuelle de films sur TMDB
 * Utilisé par MediaValidator pour les corrections manuelles
 */

import { NextRequest, NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { searchMovie, getTMDBImageUrl, getYearFromDate } from '@/lib/tmdb'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query } = body
    
    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Query trop courte (minimum 2 caractères)' },
        { status: 400 }
      )
    }
    
    // Rechercher sur TMDB
    const results = await searchMovie(query)
    
    if (!results || results.length === 0) {
      return NextResponse.json({
        success: true,
        suggestions: []
      })
    }
    
    // Formater les résultats
    const suggestions = results.slice(0, 10).map(movie => ({
      tmdbId: movie.id,
      title: movie.title,
      originalTitle: movie.original_title,
      year: getYearFromDate(movie.release_date) || 0,
      posterPath: movie.poster_path,
      overview: movie.overview,
      confidence: -1 // Pas de calcul de confiance pour recherche manuelle
    }))
    
    return NextResponse.json({
      success: true,
      suggestions
    })
    
  } catch (error) {
    console.error('Erreur recherche manuelle:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la recherche' },
      { status: 500 }
    )
  }
}




