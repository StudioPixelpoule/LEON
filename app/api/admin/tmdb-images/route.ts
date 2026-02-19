/**
 * API Route: Récupérer les images TMDB d'un média
 * GET /api/admin/tmdb-images?tmdbId=123&type=movie
 * 
 * Retourne tous les backdrops et posters disponibles sur TMDB
 * pour permettre la sélection manuelle dans l'admin.
 * 
 * ⚠️ Route admin - Authentification requise
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { getMovieImages, getTVShowImages, getTMDBImageUrl } from '@/lib/tmdb'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

  try {
    const { searchParams } = new URL(request.url)
    const tmdbId = searchParams.get('tmdbId')
    const type = searchParams.get('type') || 'movie'

    if (!tmdbId) {
      return NextResponse.json({ error: 'tmdbId requis' }, { status: 400 })
    }

    const id = parseInt(tmdbId, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'tmdbId invalide' }, { status: 400 })
    }

    console.log(`[TMDB-IMAGES] Récupération images ${type} ID: ${id}`)

    const images = type === 'series'
      ? await getTVShowImages(id)
      : await getMovieImages(id)

    const backdrops = images.backdrops.map(img => ({
      url: getTMDBImageUrl(img.file_path, 'original'),
      thumbnail: getTMDBImageUrl(img.file_path, 'w780'),
      width: img.width,
      height: img.height,
      voteAverage: img.vote_average,
      language: img.iso_639_1,
    }))

    console.log(`[TMDB-IMAGES] ${backdrops.length} backdrops trouvés`)

    return NextResponse.json({
      success: true,
      backdrops,
      total: backdrops.length,
    })
  } catch (error) {
    console.error('[TMDB-IMAGES] Erreur:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}
