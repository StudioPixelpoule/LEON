/**
 * API Route: Récupération des médias (films uniquement)
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export interface GroupedMedia {
  id: string
  title: string
  original_title: string | null
  year: number | null
  poster_url: string | null
  backdrop_url: string | null
  overview: string | null
  rating: number | null
  tmdb_id: number | null
  release_date: string | null
  genres: string[] | null
  pcloud_fileid: string
  duration: number | null
  formatted_runtime: string | null
  movie_cast: any[] | null
  director: any | null
  subtitles: any | null
  quality: string | null
  created_at: string | null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sortBy = searchParams.get('sort') || 'recent' // 'recent', 'rating', 'title'
    const limit = parseInt(searchParams.get('limit') || '0', 10)
    
    // Récupérer tous les films
    const query = supabase
      .from('media')
      .select('*')
      .not('poster_url', 'is', null) // Uniquement ceux avec poster
    
    if (sortBy === 'recent') {
      query.order('created_at', { ascending: false })
    } else if (sortBy === 'rating') {
      query.order('rating', { ascending: false, nullsFirst: false })
    } else if (sortBy === 'title') {
      query.order('title', { ascending: true })
    }
    
    if (limit > 0) {
      query.limit(limit)
    }
    
    const { data: movies, error } = await query
    
    if (error) {
      console.error('Erreur récupération films:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des films' },
        { status: 500 }
      )
    }
    
    const results: GroupedMedia[] = movies?.map(movie => ({
      id: movie.id,
      title: movie.title,
      original_title: movie.original_title,
      year: movie.year,
      poster_url: movie.poster_url,
      backdrop_url: movie.backdrop_url,
      overview: movie.overview,
      rating: movie.rating,
      tmdb_id: movie.tmdb_id,
      release_date: movie.release_date,
      genres: movie.genres,
      pcloud_fileid: movie.pcloud_fileid,
      duration: movie.duration,
      formatted_runtime: movie.formatted_runtime,
      movie_cast: movie.movie_cast,
      director: movie.director,
      subtitles: movie.subtitles,
      quality: movie.quality,
      created_at: movie.created_at,
    })) || []
    
    return NextResponse.json({
      success: true,
      count: results.length,
      media: results,
    })
    
  } catch (error) {
    console.error('Erreur API grouped media:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des médias' },
      { status: 500 }
    )
  }
}
