/**
 * API Route: Gestion des positions de lecture
 * POST - Sauvegarder la position (upsert robuste)
 * GET - Récupérer la position d'un film
 * DELETE - Supprimer la position (film terminé) + historique optionnel
 *
 * Supporte le tracking multi-utilisateurs via user_id
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
import { createSupabaseClient } from '@/lib/supabase'

const COMPLETION_THRESHOLD = 0.95

// ─── Validation ──────────────────────────────────────────────────────────────

function validateMediaId(mediaId: string | null): mediaId is string {
  return typeof mediaId === 'string' && mediaId.length > 0
}

function validatePosition(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function validateMediaType(value: unknown): value is 'movie' | 'episode' {
  return value === 'movie' || value === 'episode'
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { user: authUser, error: authError } = await requireAuth(request)
  if (authError || !authUser) return authErrorResponse(authError || 'Non authentifié')

  const searchParams = request.nextUrl.searchParams
  const mediaId = searchParams.get('mediaId')
  const userId = searchParams.get('userId')

  if (!validateMediaId(mediaId)) {
    return NextResponse.json({ error: 'mediaId requis' }, { status: 400 })
  }

  try {
    const supabase = createSupabaseClient()

    let query = supabase
      .from('playback_positions')
      .select('position, duration, updated_at, user_id')
      .eq('media_id', mediaId)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw error

    if (!data) {
      return NextResponse.json({ currentTime: null })
    }

    return NextResponse.json({
      currentTime: data.position,
      duration: data.duration,
      lastWatched: data.updated_at,
      userId: data.user_id
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[API] Erreur récupération position:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: errorMessage },
      { status: 500 }
    )
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

/**
 * Upsert robuste : INSERT d'abord, UPDATE si conflit.
 * Évite la race condition du SELECT+INSERT/UPDATE séparé.
 */
async function upsertPosition(
  mediaId: string,
  time: number,
  duration: number | null,
  mediaType: string,
  userId: string | null
) {
  const supabase = createSupabaseClient()
  const now = new Date().toISOString()

  const insertData: Record<string, unknown> = {
    media_id: mediaId,
    media_type: mediaType,
    position: Math.floor(time),
    duration: duration != null && duration > 0 ? Math.floor(duration) : null,
    updated_at: now
  }
  if (userId) insertData.user_id = userId

  // Tenter l'INSERT
  const { error: insertError } = await supabase
    .from('playback_positions')
    .insert(insertData)

  // Si succès, terminé
  if (!insertError) return { success: true }

  // Si conflit (23505 = unique_violation), faire un UPDATE
  if (insertError.code === '23505') {
    let updateQuery = supabase
      .from('playback_positions')
      .update({
        position: Math.floor(time),
        duration: duration != null && duration > 0 ? Math.floor(duration) : null,
        media_type: mediaType,
        updated_at: now
      })
      .eq('media_id', mediaId)

    if (userId) {
      updateQuery = updateQuery.eq('user_id', userId)
    } else {
      updateQuery = updateQuery.is('user_id', null)
    }

    const { error: updateError } = await updateQuery

    if (updateError) throw updateError
    return { success: true }
  }

  // Autre erreur
  throw insertError
}

export async function POST(request: NextRequest) {
  const { user: authUser, error: authError } = await requireAuth(request)
  if (authError || !authUser) return authErrorResponse(authError || 'Non authentifié')

  try {
    const body = await request.json()
    const { mediaId, currentTime, position, duration, userId, media_type } = body

    // Accepter soit currentTime soit position
    const time = currentTime !== undefined ? currentTime : position
    const mediaType = validateMediaType(media_type) ? media_type : 'movie'

    if (!validateMediaId(mediaId)) {
      return NextResponse.json({ error: 'mediaId requis' }, { status: 400 })
    }
    if (!validatePosition(time)) {
      return NextResponse.json({ error: 'position invalide (nombre >= 0 requis)' }, { status: 400 })
    }

    const supabase = createSupabaseClient()

    // Film terminé (> 95%) : historique + suppression
    if (duration && validatePosition(duration) && time >= duration * COMPLETION_THRESHOLD) {
      if (userId) {
        await supabase
          .from('watch_history')
          .insert({
            user_id: userId,
            media_id: mediaId,
            media_type: mediaType,
            watch_duration: Math.round(time),
            completed: true
          })
      }

      let deleteQuery = supabase
        .from('playback_positions')
        .delete()
        .eq('media_id', mediaId)

      if (userId) {
        deleteQuery = deleteQuery.eq('user_id', userId)
      }

      await deleteQuery

      return NextResponse.json({ success: true, action: 'completed', recorded: !!userId })
    }

    // Position à 0 : suppression
    if (time === 0) {
      let deleteQuery = supabase
        .from('playback_positions')
        .delete()
        .eq('media_id', mediaId)

      if (userId) {
        deleteQuery = deleteQuery.eq('user_id', userId)
      }

      await deleteQuery

      return NextResponse.json({ success: true, action: 'deleted' })
    }

    // Upsert robuste (INSERT puis UPDATE si conflit)
    await upsertPosition(
      mediaId,
      time,
      duration ?? null,
      mediaType,
      userId ?? null
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[API] Erreur sauvegarde position:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: errorMessage },
      { status: 500 }
    )
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const { user: authUser, error: authError } = await requireAuth(request)
  if (authError || !authUser) return authErrorResponse(authError || 'Non authentifié')

  const searchParams = request.nextUrl.searchParams
  const mediaId = searchParams.get('mediaId')
  const userId = searchParams.get('userId')
  const recordHistory = searchParams.get('recordHistory') === 'true'
  const mediaType = searchParams.get('mediaType') || 'movie'

  if (!validateMediaId(mediaId)) {
    return NextResponse.json({ error: 'mediaId requis' }, { status: 400 })
  }
  if (!userId) {
    return NextResponse.json({ error: 'userId requis' }, { status: 400 })
  }

  try {
    const supabase = createSupabaseClient()

    // Enregistrer dans l'historique si demandé
    if (recordHistory) {
      const { data: posData } = await supabase
        .from('playback_positions')
        .select('position, duration, media_type')
        .eq('media_id', mediaId)
        .eq('user_id', userId)
        .maybeSingle()

      if (posData) {
        await supabase
          .from('watch_history')
          .insert({
            user_id: userId,
            media_id: mediaId,
            media_type: posData.media_type || mediaType,
            watch_duration: posData.position ? Math.round(posData.position) : null,
            completed: posData.duration ? posData.position >= posData.duration * 0.9 : false
          })
      }
    }

    const { error, count } = await supabase
      .from('playback_positions')
      .delete()
      .eq('media_id', mediaId)
      .eq('user_id', userId)

    if (error) throw error

    console.log(`[API] Position supprimée: mediaId=${mediaId}, userId=${userId}, count=${count}`)
    return NextResponse.json({ success: true, deleted: count })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[API] Erreur suppression position:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: errorMessage },
      { status: 500 }
    )
  }
}
