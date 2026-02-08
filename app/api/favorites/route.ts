/**
 * API Route: Gestion des favoris (Ma liste)
 * GET - Récupérer les favoris
 * POST - Ajouter un favori
 * DELETE - Supprimer un favori
 * 
 * Supporte le tracking multi-utilisateurs via user_id
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/api-auth'
import { createSupabaseAdmin } from '@/lib/supabase'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

// Interface pour les données média de la jointure Supabase
// Types alignés avec database.types.ts
interface MediaData {
  id?: string
  title?: string
  original_title?: string
  year?: number | null
  duration?: number | null
  formatted_runtime?: string | null
  file_size?: string | null  // string dans la DB
  quality?: string | null
  tmdb_id?: number | null
  poster_url?: string | null
  backdrop_url?: string | null
  overview?: string | null
  genres?: string[] | null  // array dans la DB
  release_date?: string | null
  rating?: number | null
  vote_count?: number | null
  tagline?: string | null
  trailer_url?: string | null
  pcloud_fileid?: string | null
}

/**
 * GET - Récupérer tous les favoris (avec infos média)
 * Utilise la vue favorites_with_media pour éviter les problèmes de jointure
 */
export async function GET(request: NextRequest) {
  const { user: authUser, error: authError } = await requireAuth(request)
  if (authError || !authUser) return authErrorResponse(authError || 'Non authentifié')
  
  try {
    const supabase = createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams
    const mediaType = searchParams.get('type') || 'movie'
    const userId = authUser.id // Utiliser l'ID du token, pas le query param
    
    // Essayer d'abord la vue favorites_with_media
    let query = supabase
      .from('favorites_with_media')
      .select('*')
      .eq('media_type', mediaType)
    
    // Filtrer par utilisateur
    if (userId) {
      query = query.eq('user_id', userId)
    } else {
      query = query.is('user_id', null)
    }
    
    let { data: favorites, error } = await query.order('created_at', { ascending: false })
    
    // Fallback: si la vue n'existe pas, utiliser deux requêtes
    if (error && error.message.includes('does not exist')) {
      console.log('[FAVORITES] Vue favorites_with_media non trouvée, fallback sur requêtes séparées')
      
      // Requête 1: récupérer les favoris
      let favQuery = supabase
        .from('favorites')
        .select('id, media_id, media_type, user_id, created_at')
        .eq('media_type', mediaType)
      
      if (userId) {
        favQuery = favQuery.eq('user_id', userId)
      } else {
        favQuery = favQuery.is('user_id', null)
      }
      
      const { data: favs, error: favError } = await favQuery.order('created_at', { ascending: false })
      
      if (favError) {
        console.error('[FAVORITES] Erreur récupération:', favError.message)
        return NextResponse.json(
          { error: `Erreur base de données: ${favError.message}` },
          { status: 500 }
        )
      }
      
      if (!favs || favs.length === 0) {
        return NextResponse.json({ success: true, favorites: [] })
      }
      
      // Requête 2: récupérer les médias correspondants (transcodés uniquement)
      const mediaIds = favs.map(f => f.media_id).filter(Boolean)
      const { data: medias } = await supabase
        .from('media')
        .select('*')
        .in('id', mediaIds)
      
      // Combiner les résultats
      const mediaMap = new Map((medias || []).map(m => [m.id, m]))
      favorites = favs.map(fav => ({
        ...fav,
        ...(mediaMap.get(fav.media_id) || {}),
        favorite_id: fav.id
      }))
      error = null
    }
    
    if (error) {
      console.error('[FAVORITES] Erreur récupération:', error.message, error.details, error.hint)
      return NextResponse.json(
        { error: `Erreur base de données: ${error.message}`, details: error.details },
        { status: 500 }
      )
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
      .filter(fav => fav.title) // Filtrer les médias non trouvés
      .map(fav => ({
        id: fav.id || fav.media_id || '',
        title: fav.title || '',
        original_title: fav.original_title || null,
        year: fav.year || null,
        duration: fav.duration || null,
        formatted_runtime: fav.formatted_runtime || null,
        file_size: fav.file_size || null,
        quality: fav.quality || null,
        tmdb_id: fav.tmdb_id || null,
        poster_url: fav.poster_url || null,
        backdrop_url: fav.backdrop_url || null,
        overview: fav.overview || null,
        genres: fav.genres || [],
        release_date: fav.release_date || null,
        rating: fav.rating || null,
        vote_count: fav.vote_count || null,
        tagline: fav.tagline || null,
        trailer_url: fav.trailer_url || null,
        pcloud_fileid: fav.pcloud_fileid || '',
        favorite_id: fav.favorite_id || fav.id,
        favorited_at: fav.created_at
      }))
    
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
  const { user: authUser, error: authError } = await requireAuth(request)
  if (authError || !authUser) return authErrorResponse(authError || 'Non authentifié')
  
  try {
    const body = await request.json()
    const { mediaId, mediaType = 'movie' } = body
    const userId = authUser.id // Utiliser l'ID du token
    
    if (!mediaId) {
      return NextResponse.json(
        { error: 'mediaId requis' },
        { status: 400 }
      )
    }
    
    const supabase = createSupabaseAdmin()
    
    // Vérifier si déjà en favori pour cet utilisateur
    const existingQuery = supabase
      .from('favorites')
      .select('id')
      .eq('media_id', mediaId)
      .eq('media_type', mediaType)
      .eq('user_id', userId)
    
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
  const { user: authUser, error: authError } = await requireAuth(request)
  if (authError || !authUser) return authErrorResponse(authError || 'Non authentifié')
  
  try {
    const searchParams = request.nextUrl.searchParams
    const mediaId = searchParams.get('mediaId')
    const mediaType = searchParams.get('mediaType') || 'movie'
    const userId = authUser.id // Utiliser l'ID du token
    
    if (!mediaId) {
      return NextResponse.json(
        { error: 'mediaId requis' },
        { status: 400 }
      )
    }
    
    const supabase = createSupabaseAdmin()
    
    const deleteQuery = supabase
      .from('favorites')
      .delete()
      .eq('media_id', mediaId)
      .eq('media_type', mediaType)
      .eq('user_id', userId)
    
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
