/**
 * API: Liste tous les médias
 * GET /api/media/list
 * Utilisé pour l'outil de validation manuelle
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') // 'no_tmdb', 'no_poster', 'movie', 'tv', 'all'
    
    let query = supabase
      .from('media')
      .select('id, title, pcloud_fileid, media_type, tmdb_id, poster_url, year')
      .order('created_at', { ascending: false })
    
    // Appliquer les filtres
    if (filter === 'no_tmdb') {
      query = query.is('tmdb_id', null)
    } else if (filter === 'no_poster') {
      query = query.or('poster_url.is.null,poster_url.eq./placeholder-poster.png')
    } else if (filter === 'movie') {
      query = query.eq('media_type', 'movie')
    } else if (filter === 'tv') {
      query = query.eq('media_type', 'tv')
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Erreur récupération médias:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des médias' },
        { status: 500 }
      )
    }
    
    // S'assurer que media_type a une valeur par défaut
    const mediaList = (data || []).map(media => ({
      ...media,
      media_type: media.media_type || 'movie' // Valeur par défaut si null
    }))
    
    return NextResponse.json(mediaList)
    
  } catch (error) {
    console.error('Erreur API media list:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}


