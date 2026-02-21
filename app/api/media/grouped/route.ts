/**
 * API Route: Récupération des médias (films uniquement)
 * Optimisé avec cache côté serveur
 */

import { NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { getLastInvalidation } from '@/lib/cache-invalidation'

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
  trailer_url: string | null
  // Champs optionnels pour la compatibilité avec les séries
  type?: 'movie' | 'tv'
  series_name?: string | null
  media_type?: string | null
  season_count?: number | null
  episode_count?: number | null
}

// Cache en mémoire côté serveur (5 minutes)
let cachedMovies: GroupedMedia[] | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sortBy = searchParams.get('sort') || 'recent'
    const limit = parseInt(searchParams.get('limit') || '0', 10)
    const noCache = searchParams.get('nocache') === 'true'
    
    const allMedia = searchParams.get('all') === 'true'
    const now = Date.now()
    
    // Utiliser le cache si valide (invalidé par actions admin)
    const cacheValid = !noCache && !allMedia && cachedMovies 
      && (now - cacheTimestamp) < CACHE_DURATION
      && cacheTimestamp > getLastInvalidation()
    if (cacheValid) {
      let results = [...cachedMovies]
      
      // Trier si nécessaire
      if (sortBy === 'rating') {
        results.sort((a, b) => (b.rating || 0) - (a.rating || 0))
      } else if (sortBy === 'title') {
        results.sort((a, b) => a.title.localeCompare(b.title))
      }
      
      if (limit > 0) {
        results = results.slice(0, limit)
      }
      
      return NextResponse.json({
        success: true,
        count: results.length,
        media: results,
        cached: true
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    }
    
    // Requête optimisée : seulement les colonnes nécessaires pour l'affichage
    // Filtre is_transcoded : n'affiche que les médias transcodés (sauf si all=true pour l'admin)
    const query = supabase
      .from('media')
      .select('id, title, original_title, year, poster_url, backdrop_url, overview, rating, tmdb_id, release_date, genres, pcloud_fileid, duration, formatted_runtime, movie_cast, director, subtitles, quality, created_at, trailer_url')

    if (!allMedia) {
      query.eq('is_transcoded', true)
    }
    
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
      trailer_url: movie.trailer_url,
    })) || []
    
    // Mettre à jour le cache (trié par date récente par défaut)
    cachedMovies = results.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      return dateB - dateA
    })
    cacheTimestamp = now
    
    let finalResults = [...results]
    if (limit > 0) {
      finalResults = finalResults.slice(0, limit)
    }
    
    return NextResponse.json({
      success: true,
      count: finalResults.length,
      media: finalResults,
      cached: false
    }, {
      headers: {
        // 🔧 FIX: Si nocache=true, désactiver complètement le cache HTTP
        'Cache-Control': noCache 
          ? 'no-cache, no-store, must-revalidate'
          : 'public, s-maxage=300, stale-while-revalidate=60'
      }
    })
    
  } catch (error) {
    console.error('Erreur API grouped media:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des médias' },
      { status: 500 }
    )
  }
}
