/**
 * API Route: Gestion des favoris (Ma liste)
 * GET - Récupérer les favoris
 * POST - Ajouter un favori
 * DELETE - Supprimer un favori
 * 
 * Supporte le tracking multi-utilisateurs via user_id
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

/**
 * GET - Récupérer tous les favoris (avec infos média)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()
    const searchParams = request.nextUrl.searchParams
    const mediaType = searchParams.get('type') || 'movie'
    const userId = searchParams.get('userId')
    
    // Construire la requête de base
    let query = supabase
      .from('favorites')
      .select(`
        id,
        media_id,
        media_type,
        user_id,
        created_at
      `)
      .eq('media_type', mediaType)
    
    // Filtrer par utilisateur
    if (userId) {
      query = query.eq('user_id', userId)
    } else {
      query = query.is('user_id', null)
    }
    
    const { data: favorites, error } = await query.order('created_at', { ascending: false })
    
    if (error) {
      console.error('[API] Erreur récupération favoris:', error)
      throw error
    }
    
    // Si pas de favoris, retourner liste vide
    if (!favorites || favorites.length === 0) {
      return NextResponse.json({
        success: true,
        favorites: []
      })
    }
    
    // Récupérer les infos des médias
    const mediaIds = favorites.map(f => f.media_id)
    
    const { data: mediaList, error: mediaError } = await supabase
      .from('media')
      .select('*')
      .in('id', mediaIds)
    
    if (mediaError) {
      console.error('[API] Erreur récupération médias:', mediaError)
      throw mediaError
    }
    
    // Fusionner les données
    const favoritesWithMedia = favorites.map(fav => {
      const media = mediaList?.find(m => m.id === fav.media_id)
      return {
        ...media,
        favorite_id: fav.id,
        favorited_at: fav.created_at
      }
    }).filter(f => f.id) // Filtrer les médias non trouvés
    
    return NextResponse.json({
      success: true,
      favorites: favoritesWithMedia
    })
  } catch (error: any) {
    console.error('[API] Erreur favoris GET:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST - Ajouter un média aux favoris
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mediaId, mediaType = 'movie', userId } = body
    
    if (!mediaId) {
      return NextResponse.json(
        { error: 'mediaId requis' },
        { status: 400 }
      )
    }
    
    const supabase = createSupabaseClient()
    
    // Vérifier si déjà en favori pour cet utilisateur
    let existingQuery = supabase
      .from('favorites')
      .select('id')
      .eq('media_id', mediaId)
      .eq('media_type', mediaType)
    
    if (userId) {
      existingQuery = existingQuery.eq('user_id', userId)
    } else {
      existingQuery = existingQuery.is('user_id', null)
    }
    
    const { data: existing } = await existingQuery.single()
    
    if (existing) {
      return NextResponse.json({
        success: true,
        action: 'already_exists',
        message: 'Déjà dans les favoris'
      })
    }
    
    // Ajouter aux favoris
    const insertData: Record<string, unknown> = {
      media_id: mediaId,
      media_type: mediaType
    }
    
    if (userId) {
      insertData.user_id = userId
    }
    
    const { data, error } = await supabase
      .from('favorites')
      .insert(insertData)
      .select()
      .single()
    
    if (error) {
      console.error('[API] Erreur ajout favori:', error)
      throw error
    }
    
    console.log(`[FAVORITES] ❤️ Ajouté aux favoris: ${mediaId} (user: ${userId || 'anonymous'})`)
    
    return NextResponse.json({
      success: true,
      action: 'added',
      data
    })
  } catch (error: any) {
    console.error('[API] Erreur favoris POST:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Supprimer un média des favoris
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const mediaId = searchParams.get('mediaId')
    const mediaType = searchParams.get('mediaType') || 'movie'
    const userId = searchParams.get('userId')
    
    if (!mediaId) {
      return NextResponse.json(
        { error: 'mediaId requis' },
        { status: 400 }
      )
    }
    
    const supabase = createSupabaseClient()
    
    let deleteQuery = supabase
      .from('favorites')
      .delete()
      .eq('media_id', mediaId)
      .eq('media_type', mediaType)
    
    if (userId) {
      deleteQuery = deleteQuery.eq('user_id', userId)
    } else {
      deleteQuery = deleteQuery.is('user_id', null)
    }
    
    const { error } = await deleteQuery
    
    if (error) {
      console.error('[API] Erreur suppression favori:', error)
      throw error
    }
    
    console.log(`[FAVORITES] 💔 Retiré des favoris: ${mediaId} (user: ${userId || 'anonymous'})`)
    
    return NextResponse.json({
      success: true,
      action: 'removed'
    })
  } catch (error: any) {
    console.error('[API] Erreur favoris DELETE:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    )
  }
}
