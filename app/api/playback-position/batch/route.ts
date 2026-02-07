/**
 * API Route: Récupérer les positions de lecture en batch
 * GET /api/playback-position/batch?mediaIds=id1,id2,id3&userId=xxx
 * Retourne toutes les positions en une seule requête
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/api-auth'
import { createSupabaseClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { user: authUser, error: authError } = await requireAuth(request)
  if (authError || !authUser) return authErrorResponse(authError || 'Non authentifié')
  
  const searchParams = request.nextUrl.searchParams
  const mediaIdsRaw = searchParams.get('mediaIds')
  const userId = searchParams.get('userId')

  if (!mediaIdsRaw) {
    return NextResponse.json({ error: 'mediaIds requis' }, { status: 400 })
  }

  const mediaIds = mediaIdsRaw.split(',').filter(Boolean)
  
  if (mediaIds.length === 0 || mediaIds.length > 50) {
    return NextResponse.json({ error: 'Entre 1 et 50 mediaIds acceptés' }, { status: 400 })
  }

  try {
    const supabase = createSupabaseClient()
    
    let query = supabase
      .from('playback_positions')
      .select('media_id, position, duration, updated_at')
      .in('media_id', mediaIds)
    
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[API] Erreur batch positions:', error)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    // Convertir en map pour accès rapide côté client
    const positions: Record<string, { currentTime: number; duration: number | null; updatedAt: string }> = {}
    for (const pos of (data || [])) {
      positions[pos.media_id] = {
        currentTime: pos.position,
        duration: pos.duration,
        updatedAt: pos.updated_at || '',
      }
    }

    return NextResponse.json({ success: true, positions })
  } catch (error) {
    console.error('[API] Erreur batch positions:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
