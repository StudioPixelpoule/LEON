/**
 * API Route: Mettre à jour les métadonnées d'un média
 * PATCH /api/admin/update-media-info
 * 
 * Permet de modifier:
 * - Titre
 * - Année
 * - Poster (URL)
 * - TMDB ID (pour relancer l'enrichissement)
 * - Synopsis (overview)
 * 
 * ⚠️ Route admin - Authentification requise
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { createSupabaseAdmin } from '@/lib/supabase'
import { getMovieDetails, getTVShowDetails, getTMDBImageUrl, formatRuntime } from '@/lib/tmdb'

export const dynamic = 'force-dynamic'

interface UpdatePayload {
  id: string
  type: 'movie' | 'series'
  title?: string
  year?: number | null
  poster_url?: string | null
  backdrop_url?: string | null
  trailer_url?: string | null
  tmdb_id?: number | null
  overview?: string | null
  refreshFromTmdb?: boolean
}

export async function PATCH(request: NextRequest) {
  // Vérification admin OBLIGATOIRE
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

  try {
    const body: UpdatePayload = await request.json()
    const { id, type, refreshFromTmdb, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'ID du média requis' }, { status: 400 })
    }

    if (!type || !['movie', 'series'].includes(type)) {
      return NextResponse.json({ error: 'Type invalide (movie ou series)' }, { status: 400 })
    }

    console.log(`[UPDATE-MEDIA-INFO] ✏️ Mise à jour ${type} ID: ${id} par ${user.email}`)

    const supabase = createSupabaseAdmin()
    const table = type === 'series' ? 'series' : 'media'

    // Données enrichies TMDB (objets complexes : cast, director, genres)
    let tmdbEnrichedData: Record<string, unknown> = {}

    // Si refreshFromTmdb est true et qu'on a un tmdb_id, récupérer TOUTES les infos TMDB
    if (refreshFromTmdb && updates.tmdb_id) {
      console.log(`[UPDATE-MEDIA-INFO] 🔄 Récupération complète TMDB pour ID: ${updates.tmdb_id}`)
      
      try {
        if (type === 'series') {
          const tmdbData = await getTVShowDetails(updates.tmdb_id)
          if (tmdbData) {
            updates.title = tmdbData.name
            updates.poster_url = tmdbData.poster_path ? getTMDBImageUrl(tmdbData.poster_path, 'w500') : null
            updates.backdrop_url = tmdbData.backdrop_path ? getTMDBImageUrl(tmdbData.backdrop_path, 'original') : null
            updates.overview = tmdbData.overview || null
            tmdbEnrichedData = {
              first_air_date: tmdbData.first_air_date || null,
              genres: tmdbData.genres?.map((g: { name: string }) => g.name) || null,
              rating: tmdbData.vote_average || null,
              vote_count: tmdbData.vote_count || null,
              tagline: tmdbData.tagline || null,
            }
          }
        } else {
          const tmdbData = await getMovieDetails(updates.tmdb_id)
          if (tmdbData) {
            updates.title = tmdbData.title
            updates.year = tmdbData.release_date ? parseInt(tmdbData.release_date.substring(0, 4), 10) : null
            updates.poster_url = tmdbData.poster_path ? getTMDBImageUrl(tmdbData.poster_path, 'w500') : null
            updates.backdrop_url = tmdbData.backdrop_path ? getTMDBImageUrl(tmdbData.backdrop_path, 'original') : null
            updates.overview = tmdbData.overview || null
            tmdbEnrichedData = {
              original_title: tmdbData.original_title || null,
              release_date: tmdbData.release_date || null,
              genres: tmdbData.genres?.map((g: { name: string }) => g.name) || null,
              duration: tmdbData.runtime || null,
              formatted_runtime: formatRuntime(tmdbData.runtime),
              rating: tmdbData.vote_average || null,
              vote_count: tmdbData.vote_count || null,
              tagline: tmdbData.tagline || null,
              movie_cast: tmdbData.credits?.cast?.slice(0, 10).map((c: { name: string; character: string; profile_path: string | null }) => ({
                name: c.name,
                character: c.character,
                profile_path: c.profile_path,
              })) || null,
              director: tmdbData.credits?.crew?.find((c: { job: string }) => c.job === 'Director') || null,
              trailer_url: tmdbData.videos?.results?.find((v: { type: string; site: string }) => v.type === 'Trailer' && v.site === 'YouTube')?.key
                ? `https://youtube.com/watch?v=${tmdbData.videos.results.find((v: { type: string; site: string }) => v.type === 'Trailer' && v.site === 'YouTube')!.key}`
                : undefined,
            }
          }
        }
      } catch (tmdbError) {
        console.error('[UPDATE-MEDIA-INFO] ⚠️ Erreur TMDB:', tmdbError)
      }
    }

    // Préparer les données
    const updateData: Record<string, unknown> = {}
    
    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.poster_url !== undefined) updateData.poster_url = updates.poster_url
    if (updates.backdrop_url !== undefined) updateData.backdrop_url = updates.backdrop_url
    if (updates.trailer_url !== undefined) updateData.trailer_url = updates.trailer_url
    if (updates.tmdb_id !== undefined) updateData.tmdb_id = updates.tmdb_id
    if (updates.overview !== undefined) updateData.overview = updates.overview

    if (type === 'series') {
      if (tmdbEnrichedData.first_air_date) updateData.first_air_date = tmdbEnrichedData.first_air_date
    } else {
      if (updates.year !== undefined) updateData.year = updates.year
    }

    // Ajouter les données enrichies TMDB (cast, director, genres, etc.)
    for (const [key, value] of Object.entries(tmdbEnrichedData)) {
      if (key === 'first_air_date') continue
      if (value !== undefined) updateData[key] = value
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Aucune donnée à mettre à jour' 
      }, { status: 400 })
    }

    // Mettre à jour dans Supabase
    const { data, error } = await supabase
      .from(table)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[UPDATE-MEDIA-INFO] ❌ Erreur Supabase:', error)
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 })
    }

    console.log(`[UPDATE-MEDIA-INFO] ✅ Mis à jour:`, updateData)

    return NextResponse.json({
      success: true,
      message: `"${data.title}" mis à jour avec succès`,
      media: data,
      updated: Object.keys(updateData)
    })

  } catch (error) {
    console.error('[UPDATE-MEDIA-INFO] ❌ Erreur:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}

/**
 * GET: Récupérer les infos actuelles d'un média
 */
export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type') || 'movie'

    if (!id) {
      return NextResponse.json({ error: 'ID du média requis' }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()
    const table = type === 'series' ? 'series' : 'media'

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      media: data
    })

  } catch (error) {
    console.error('[UPDATE-MEDIA-INFO] ❌ Erreur GET:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}
