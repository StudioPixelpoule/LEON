/**
 * API: Liste tous les médias
 * GET /api/media/list
 * Utilisé pour l'outil de validation manuelle
 */

import { NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') // 'no_tmdb', 'no_poster', 'all'
    
    let query = supabase
      .from('media')
      .select('id, title, pcloud_fileid, tmdb_id, poster_url, year')
      .order('created_at', { ascending: false })
    
    // Appliquer les filtres
    if (filter === 'no_tmdb') {
      query = query.is('tmdb_id', null)
    } else if (filter === 'no_poster') {
      query = query.or('poster_url.is.null,poster_url.eq./placeholder-poster.png')
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Erreur récupération médias:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des médias' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(data || [])
    
  } catch (error) {
    console.error('Erreur API media list:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}


