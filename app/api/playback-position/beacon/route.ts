/**
 * API Route: Sauvegarde de position via sendBeacon
 * POST uniquement — reçoit un JSON blob envoyé par navigator.sendBeacon()
 *
 * sendBeacon() envoie les cookies de la même origine, donc l'auth
 * fonctionne normalement. Le corps est un Blob JSON.
 *
 * Cette route est optimisée pour la vitesse : pas de réponse complexe,
 * pas de select(), juste un upsert et une réponse 204.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Vérifier l'authentification (les cookies sont envoyés par sendBeacon)
  const { user: authUser, error: authError } = await requireAuth(request)
  if (authError || !authUser) {
    return new NextResponse(null, { status: 401 })
  }

  try {
    const body = await request.json()
    const { mediaId, position, duration, media_type, userId } = body

    // Validation minimale pour la rapidité
    if (!mediaId || typeof position !== 'number' || position < 0) {
      return new NextResponse(null, { status: 400 })
    }

    const mediaType = media_type === 'episode' ? 'episode' : 'movie'
    const supabase = createSupabaseClient()
    const now = new Date().toISOString()

    const insertData: Record<string, unknown> = {
      media_id: mediaId,
      media_type: mediaType,
      position: Math.floor(position),
      duration: duration != null && duration > 0 ? Math.floor(duration) : null,
      updated_at: now
    }
    if (userId) insertData.user_id = userId

    // Upsert rapide : INSERT puis UPDATE si conflit
    const { error: insertError } = await supabase
      .from('playback_positions')
      .insert(insertData)

    if (insertError && insertError.code === '23505') {
      // Conflit unique — faire un UPDATE
      let updateQuery = supabase
        .from('playback_positions')
        .update({
          position: Math.floor(position),
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

      await updateQuery
    }

    // 204 No Content — réponse minimale pour la rapidité
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[BEACON] Erreur sauvegarde position:', error)
    return new NextResponse(null, { status: 500 })
  }
}
