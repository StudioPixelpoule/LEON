/**
 * API Route: Statistiques de la bibliothèque
 * GET /api/stats - Retourne les stats sur les films indexés
 * ⚠️ Route admin - Authentification requise
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Vérification admin OBLIGATOIRE (manquait dans l'ancienne version)
  const { error: authError } = await requireAdmin(request)
  if (authError) return authErrorResponse(authError, 403)

  try {
    // Tous les films
    const { data: allMedia, error: allError } = await supabase
      .from('media')
      .select('id, title, poster_url, tmdb_id')

    if (allError) {
      console.error('[STATS] Erreur récupération média:', allError)
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
      .slice(0, 50)

    // Protection division par zéro
    const percentageWithPosters = total > 0 ? Math.round((withPosters / total) * 100) : 0

    return NextResponse.json({
      total,
      withPosters,
      withoutPosters,
      withTmdbId,
      withoutTmdbId,
      missingPosters,
      percentageWithPosters
    })
  } catch (error) {
    console.error('[STATS] Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
