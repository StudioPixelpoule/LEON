/**
 * API Route: Gestion des positions de lecture
 * POST - Sauvegarder la position
 * GET - Récupérer la position d'un film
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

/**
 * GET - Récupérer la position sauvegardée d'un film
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mediaId = searchParams.get('mediaId')

  if (!mediaId) {
    return NextResponse.json({ error: 'mediaId requis' }, { status: 400 })
  }

  try {
    const supabase = createClient()
    const DUMMY_USER_ID = '00000000-0000-0000-0000-000000000000'
    
    const { data, error } = await supabase
      .from('playback_positions')
      .select('position, duration, updated_at')
      .eq('user_id', DUMMY_USER_ID)
      .eq('media_id', mediaId)
      .single()

    if (error) {
      // Pas de position sauvegardée = pas une erreur
      if (error.code === 'PGRST116') {
        return NextResponse.json({ currentTime: null })
      }
      throw error
    }

    return NextResponse.json({
      currentTime: data.position,
      duration: data.duration,
      lastWatched: data.updated_at
    })
  } catch (error: any) {
    console.error('[API] Erreur récupération position:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST - Sauvegarder ou mettre à jour la position
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mediaId, currentTime, duration } = body

    if (!mediaId || currentTime === undefined) {
      return NextResponse.json(
        { error: 'mediaId et currentTime requis' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    const DUMMY_USER_ID = '00000000-0000-0000-0000-000000000000'

    // Upsert: créer ou mettre à jour
    const { data, error } = await supabase
      .from('playback_positions')
      .upsert({
        user_id: DUMMY_USER_ID,
        media_id: mediaId,
        position: currentTime,
        duration: duration || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,media_id' // Conflit sur (user_id, media_id) = update
      })
      .select()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: any) {
    console.error('[API] Erreur sauvegarde position:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Supprimer la position (marquer comme terminé)
 */
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mediaId = searchParams.get('mediaId')

  if (!mediaId) {
    return NextResponse.json({ error: 'mediaId requis' }, { status: 400 })
  }

  try {
    const supabase = createClient()
    const DUMMY_USER_ID = '00000000-0000-0000-0000-000000000000'
    
    const { error } = await supabase
      .from('playback_positions')
      .delete()
      .eq('user_id', DUMMY_USER_ID)
      .eq('media_id', mediaId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API] Erreur suppression position:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    )
  }
}

