/**
 * API Admin: Liste les séries pour validation
 * GET /api/admin/series/list
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') // 'no_tmdb', 'no_poster', 'all'
    
    let query = supabase
      .from('series')
      .select(`
        id, 
        title, 
        tmdb_id, 
        poster_url, 
        backdrop_url, 
        local_folder_path,
        episodes:episodes(count)
      `)
      .order('created_at', { ascending: false })
    
    // Appliquer les filtres
    if (filter === 'no_tmdb') {
      query = query.is('tmdb_id', null)
    } else if (filter === 'no_poster') {
      query = query.or('poster_url.is.null,poster_url.eq./placeholder-poster.png')
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Erreur récupération séries:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des séries' },
        { status: 500 }
      )
    }
    
    // Transformer les données pour inclure le compte d'épisodes
    const seriesWithCount = data?.map(series => ({
      ...series,
      episodeCount: Array.isArray(series.episodes) ? series.episodes.length : 0,
      episodes: undefined // Retirer le champ episodes brut
    })) || []
    
    return NextResponse.json(seriesWithCount)
    
  } catch (error) {
    console.error('Erreur API series list:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}




