/**
 * API Route: Récupération/mise à jour des métadonnées TMDB
 * Permet de rafraîchir manuellement les infos d'un film
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getMovieDetails, getTMDBImageUrl, getYearFromDate } from '@/lib/tmdb'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mediaId, tmdbId } = body
    
    if (!mediaId || !tmdbId) {
      return NextResponse.json(
        { error: 'mediaId et tmdbId requis' },
        { status: 400 }
      )
    }
    
    // Récupérer les détails depuis TMDB
    const movieDetails = await getMovieDetails(tmdbId)
    
    if (!movieDetails) {
      return NextResponse.json(
        { error: 'Film introuvable sur TMDB' },
        { status: 404 }
      )
    }
    
    // Mettre à jour dans Supabase
    const { data, error } = await supabase
      .from('media')
      .update({
        title: movieDetails.title,
        original_title: movieDetails.original_title,
        year: getYearFromDate(movieDetails.release_date),
        duration: movieDetails.runtime,
        tmdb_id: movieDetails.id,
        poster_url: getTMDBImageUrl(movieDetails.poster_path, 'w500'),
        backdrop_url: getTMDBImageUrl(movieDetails.backdrop_path, 'original'),
        overview: movieDetails.overview,
        genres: movieDetails.genres.map(g => g.name),
        movie_cast: movieDetails.credits?.cast || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', mediaId)
      .select()
      .single()
    
    if (error) {
      console.error('Erreur mise à jour Supabase:', error)
      return NextResponse.json(
        { error: 'Erreur mise à jour base de données' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      media: data
    })
    
  } catch (error) {
    console.error('Erreur metadata:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

