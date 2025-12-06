/**
 * API Route: Gestion des positions de lecture
 * POST - Sauvegarder la position
 * GET - Récupérer la position d'un film
 * DELETE - Supprimer la position (film terminé)
 * 
 * Supporte le tracking multi-utilisateurs via user_id
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { createSupabaseClient } from '@/lib/supabase'

/**
 * GET - Récupérer la position sauvegardée d'un film
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mediaId = searchParams.get('mediaId')
  const userId = searchParams.get('userId')

  if (!mediaId) {
    return NextResponse.json({ error: 'mediaId requis' }, { status: 400 })
  }

  try {
    const supabase = createSupabaseClient()
    
    let query = supabase
      .from('playback_positions')
      .select('position, duration, updated_at, user_id')
      .eq('media_id', mediaId)
    
    // Filtrer par utilisateur si fourni
    if (userId) {
      query = query.eq('user_id', userId)
    }
    
    const { data, error } = await query.maybeSingle()

    if (error) {
      throw error
    }

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

/**
 * POST - Sauvegarder ou mettre à jour la position
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mediaId, currentTime, position, duration, userId, media_type } = body
    
    // Accepter soit currentTime soit position
    const time = currentTime !== undefined ? currentTime : position
    // Type de média: 'movie' ou 'episode'
    const mediaType = media_type || 'movie'

    if (!mediaId || time === undefined) {
      return NextResponse.json(
        { error: 'mediaId et currentTime (ou position) requis' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseClient()

    // Si le film/épisode est terminé (> 95%), enregistrer dans l'historique et supprimer la position
    if (duration && time >= duration * 0.95) {
      // Enregistrer dans l'historique
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
      
      // Supprimer la position de lecture
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

    // Si time est 0, supprimer l'entrée
    if (time === 0) {
      let deleteQuery = supabase
        .from('playback_positions')
        .delete()
        .eq('media_id', mediaId)
      
      if (userId) {
        deleteQuery = deleteQuery.eq('user_id', userId)
      }
      
      const { error: deleteError } = await deleteQuery
      
      if (deleteError && deleteError.code !== 'PGRST116') {
        throw deleteError
      }
      
      return NextResponse.json({ success: true, action: 'deleted' })
    }

    // Upsert: créer ou mettre à jour
    // Note: On utilise une approche différente pour gérer le cas sans userId
    // car la contrainte unique est sur (media_id, user_id) avec COALESCE
    
    const supabaseData: Record<string, unknown> = {
      media_id: mediaId,
      media_type: mediaType,
      position: time,
      duration: duration || null,
      updated_at: new Date().toISOString()
    }
    
    // Ajouter user_id si fourni
    if (userId) {
      supabaseData.user_id = userId
    }

    // Vérifier si une entrée existe déjà
    let existingQuery = supabase
      .from('playback_positions')
      .select('id')
      .eq('media_id', mediaId)
    
    if (userId) {
      existingQuery = existingQuery.eq('user_id', userId)
    } else {
      existingQuery = existingQuery.is('user_id', null)
    }
    
    const { data: existing } = await existingQuery.maybeSingle()
    
    let data, error
    
    if (existing) {
      // Update
      let updateQuery = supabase
        .from('playback_positions')
        .update({
          position: time,
          duration: duration || null,
          media_type: mediaType,
          updated_at: new Date().toISOString()
        })
        .eq('media_id', mediaId)
      
      if (userId) {
        updateQuery = updateQuery.eq('user_id', userId)
      } else {
        updateQuery = updateQuery.is('user_id', null)
      }
      
      const result = await updateQuery.select()
      data = result.data
      error = result.error
    } else {
      // Insert
      const result = await supabase
        .from('playback_positions')
        .insert(supabaseData)
        .select()
      data = result.data
      error = result.error
    }

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[API] Erreur sauvegarde position:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: errorMessage },
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
  const userId = searchParams.get('userId')
  const recordHistory = searchParams.get('recordHistory') === 'true'

  if (!mediaId) {
    return NextResponse.json({ error: 'mediaId requis' }, { status: 400 })
  }

  try {
    const supabase = createSupabaseClient()
    
    // Enregistrer dans l'historique si demandé
    if (recordHistory && userId) {
      // Récupérer la position actuelle pour la durée regardée
      let posQuery = supabase
        .from('playback_positions')
        .select('position, duration')
        .eq('media_id', mediaId)
      
      if (userId) {
        posQuery = posQuery.eq('user_id', userId)
      }
      
      const { data: posData } = await posQuery.maybeSingle()
      
      await supabase
        .from('watch_history')
        .insert({
          user_id: userId,
          media_id: mediaId,
          media_type: 'movie',
          watch_duration: posData?.position ? Math.round(posData.position) : null,
          completed: posData?.duration ? posData.position >= posData.duration * 0.9 : false
        })
    }
    
    // Supprimer la position
    let deleteQuery = supabase
      .from('playback_positions')
      .delete()
      .eq('media_id', mediaId)
    
    if (userId) {
      deleteQuery = deleteQuery.eq('user_id', userId)
    }
    
    const { error } = await deleteQuery

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[API] Erreur suppression position:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: errorMessage },
      { status: 500 }
    )
  }
}
