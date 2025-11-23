/**
 * API Route: Gestion des positions de lecture
 * POST - Sauvegarder la position
 * GET - Récupérer la position d'un film
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'

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
    const supabase = createSupabaseClient()
    
    const { data, error } = await supabase
      .from('playback_positions')
      .select('position, duration, updated_at')
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
    const { mediaId, currentTime, position, duration } = body
    
    // Accepter soit currentTime soit position
    const time = currentTime !== undefined ? currentTime : position

    if (!mediaId || time === undefined) {
      return NextResponse.json(
        { error: 'mediaId et currentTime (ou position) requis' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseClient()

    // Si time est 0, supprimer l'entrée (film terminé)
    if (time === 0) {
      const { error: deleteError } = await supabase
        .from('playback_positions')
        .delete()
        .eq('media_id', mediaId)
      
      if (deleteError && deleteError.code !== 'PGRST116') {
        throw deleteError
      }
      
      return NextResponse.json({ success: true, action: 'deleted' })
    }

    // Upsert: créer ou mettre à jour
    const { data, error } = await supabase
      .from('playback_positions')
      .upsert({
        media_id: mediaId,
        media_type: 'movie', // Par défaut "movie" (sera "episode" pour les séries)
        position: time, // Utiliser 'time' au lieu de 'currentTime'
        duration: duration || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'media_id,media_type' // Spécifier les colonnes pour le conflit
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
    const supabase = createSupabaseClient()
    
    const { error } = await supabase
      .from('playback_positions')
      .delete()
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

