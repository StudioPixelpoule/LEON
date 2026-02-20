/**
 * API Route: Recherche dans la bibliothèque locale
 * GET /api/admin/library-search?q=query&type=movie|series|all
 * 
 * Recherche dans les films et séries de la base de données locale
 * 
 * ⚠️ Route admin - Authentification requise
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { createSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Vérification admin OBLIGATOIRE
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const type = searchParams.get('type') || 'all' // movie, series, all
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        results: { movies: [], series: [] }
      })
    }

    const supabase = createSupabaseAdmin()
    const searchPattern = `%${query}%`
    
    const results: {
      movies: any[]
      series: any[]
    } = {
      movies: [],
      series: []
    }

    // Recherche dans les films
    if (type === 'all' || type === 'movie') {
      const { data: movies, error: moviesError } = await supabase
        .from('media')
        .select('id, title, year, poster_url, pcloud_fileid')
        .ilike('title', searchPattern)
        .order('title')
        .limit(limit)

      if (moviesError) {
        console.error('[LIBRARY-SEARCH] Erreur films:', moviesError)
      } else {
        results.movies = movies || []
      }
    }

    // Recherche dans les séries — episodes comptés via JOIN pour éviter les N+1
    if (type === 'all' || type === 'series') {
      const { data: series, error: seriesError } = await supabase
        .from('series')
        .select('id, title, first_air_date, poster_url, episodes(count)')
        .ilike('title', searchPattern)
        .order('title')
        .limit(limit)

      if (seriesError) {
        console.error('[LIBRARY-SEARCH] Erreur séries:', seriesError)
      } else {
        results.series = (series || []).map((s) => {
          const { episodes, ...rest } = s as typeof s & { episodes: { count: number }[] }
          return {
            ...rest,
            episode_count: episodes?.[0]?.count ?? 0
          }
        })
      }
    }

    console.log(`[LIBRARY-SEARCH] Query "${query}" - ${results.movies.length} films, ${results.series.length} séries`)

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('[LIBRARY-SEARCH] ❌ Erreur:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}
