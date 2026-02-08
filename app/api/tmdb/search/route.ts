/**
 * API Route: Recherche TMDB (proxy)
 * GET - Recherche films et séries sur TMDB
 * Proxy nécessaire pour ne pas exposer la clé TMDB côté client
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/api-auth'
import { searchMedia, getTMDBImageUrl } from '@/lib/tmdb'
import type { TMDBMovie, TMDBTVShow } from '@/lib/tmdb'

export const dynamic = 'force-dynamic'

/**
 * GET - Recherche TMDB films + séries
 * Query params: ?query=inception
 */
export async function GET(request: NextRequest) {
  const { user: authUser, error: authError } = await requireAuth(request)
  if (authError || !authUser) return authErrorResponse(authError || 'Non authentifié')

  try {
    const query = request.nextUrl.searchParams.get('query')

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] })
    }

    const rawResults = await searchMedia(query.trim())

    // Formater les résultats pour le client (limite à 20)
    const results = rawResults.slice(0, 20).map(item => {
      const isMovie = item.type === 'movie'
      const movie = item.data as TMDBMovie
      const show = item.data as TMDBTVShow

      return {
        tmdb_id: item.data.id,
        media_type: item.type,
        title: isMovie ? movie.title : show.name,
        year: isMovie
          ? (movie.release_date ? parseInt(movie.release_date.split('-')[0]) : null)
          : (show.first_air_date ? parseInt(show.first_air_date.split('-')[0]) : null),
        poster_url: getTMDBImageUrl(item.data.poster_path, 'w185'),
        overview: item.data.overview || null
      }
    })

    return NextResponse.json({ results })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[TMDB-SEARCH] Erreur:', msg)
    return NextResponse.json({ error: 'Erreur recherche TMDB' }, { status: 500 })
  }
}
