/**
 * API Route: Statistiques de la bibliothèque
 * GET /api/stats - Retourne les stats sur les films indexés
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Tous les films
    const { data: allMedia, error: allError } = await supabase
      .from('media')
      .select('id, title, poster_url, tmdb_id')
    
    if (allError) {
      return NextResponse.json({ error: allError.message }, { status: 500 })
    }
    
    const total = allMedia?.length || 0
    const withPosters = allMedia?.filter(m => m.poster_url && m.poster_url !== '/placeholder-poster.png').length || 0
    const withoutPosters = total - withPosters
    const withTmdbId = allMedia?.filter(m => m.tmdb_id).length || 0
    const withoutTmdbId = total - withTmdbId
    
    // Films sans poster
    const missingPosters = allMedia?.filter(m => !m.poster_url || m.poster_url === '/placeholder-poster.png')
      .map(m => ({ id: m.id, title: m.title, tmdb_id: m.tmdb_id }))
      .slice(0, 50) // Limiter à 50 pour l'affichage
    
    return NextResponse.json({
      total,
      withPosters,
      withoutPosters,
      withTmdbId,
      withoutTmdbId,
      missingPosters,
      percentageWithPosters: Math.round((withPosters / total) * 100)
    })
    
  } catch (error) {
    console.error('Erreur stats:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

