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
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Client Supabase avec service role pour contourner RLS
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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

    const supabase = getSupabaseAdmin()
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

    // Recherche dans les séries
    if (type === 'all' || type === 'series') {
      const { data: series, error: seriesError } = await supabase
        .from('series')
        .select('id, title, year, poster_url')
        .ilike('title', searchPattern)
        .order('title')
        .limit(limit)

      if (seriesError) {
        console.error('[LIBRARY-SEARCH] Erreur séries:', seriesError)
      } else {
        // Compter les épisodes pour chaque série
        const seriesWithCount = await Promise.all(
          (series || []).map(async (s) => {
            const { count } = await supabase
              .from('episodes')
              .select('*', { count: 'exact', head: true })
              .eq('series_id', s.id)
            
            return {
              ...s,
              episode_count: count || 0
            }
          })
        )
        results.series = seriesWithCount
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
