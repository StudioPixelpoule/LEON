/**
 * API Route: Gestion des favoris (Ma liste)
 * GET - Récupérer les favoris
 * POST - Ajouter un favori
 * DELETE - Supprimer un favori
 * 
 * Supporte le tracking multi-utilisateurs via user_id
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

/**
 * GET - Récupérer tous les favoris (avec infos média)
 * 🚀 OPTIMISÉ: Utilise une jointure Supabase pour éviter les requêtes N+1
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams
    const mediaType = searchParams.get('type') || 'movie'
    const userId = searchParams.get('userId')
    
    // 🚀 OPTIMISATION: Une seule requête avec jointure
    // La syntaxe media:media_id(*) fait une jointure sur la table media
    let query = supabase
      .from('favorites')
      .select(`
        id,
        media_id,
        media_type,
        user_id,
        created_at,
        media:media_id (
          id,
          title,
          original_title,
          year,
          duration,
          formatted_runtime,
          file_size,
          quality,
          tmdb_id,
          poster_url,
          backdrop_url,
          overview,
          genres,
          release_date,
          rating,
          vote_count,
          tagline,
          trailer_url,
          pcloud_fileid
        )
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
      console.error('[FAVORITES] Erreur récupération:', error)
      throw error
    }
    
    // Si pas de favoris, retourner liste vide
    if (!favorites || favorites.length === 0) {
      return NextResponse.json({
        success: true,
        favorites: []
      })
    }
    
    // Transformer les données pour le format attendu par le front
    const favoritesWithMedia = favorites
      .filter(fav => fav.media) // Filtrer les médias non trouvés (supprimés)
      .map(fav => {
        const media = fav.media as {
          id: string
          title: string
          original_title?: string
          year?: number
          duration?: number
          formatted_runtime?: string
          file_size?: number
          quality?: string
          tmdb_id?: number
          poster_url?: string
          backdrop_url?: string
          overview?: string
          genres?: string
          release_date?: string
          rating?: number
          vote_count?: number
          tagline?: string
          trailer_url?: string
          pcloud_fileid?: string
        }
        return {
          ...media,
          favorite_id: fav.id,
          favorited_at: fav.created_at
        }
      })
    
    return NextResponse.json({
      success: true,
      favorites: favoritesWithMedia
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[FAVORITES] Erreur GET:', errorMessage)
    return NextResponse.json(
      { error: 'Erreur serveur', details: errorMessage },
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
    
    const supabase = createSupabaseAdmin()
    
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[FAVORITES] Erreur POST:', errorMessage)
    return NextResponse.json(
      { error: 'Erreur serveur', details: errorMessage },
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
    
    const supabase = createSupabaseAdmin()
    
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[FAVORITES] Erreur DELETE:', errorMessage)
    return NextResponse.json(
      { error: 'Erreur serveur', details: errorMessage },
      { status: 500 }
    )
  }
}
