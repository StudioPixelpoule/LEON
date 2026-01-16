/**
 * API Route: Vérifier si un média est en favori
 * GET /api/favorites/check?mediaId=xxx&userId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'

// Forcer le rendu dynamique
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
    
    let query = supabase
      .from('favorites')
      .select('id')
      .eq('media_id', mediaId)
      .eq('media_type', mediaType)
    
    // Filtrer par utilisateur
    if (userId) {
      query = query.eq('user_id', userId)
    } else {
      query = query.is('user_id', null)
    }
    
    const { data, error } = await query.single()
    
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found, ce n'est pas une erreur
      throw error
    }
    
    return NextResponse.json({
      success: true,
      isFavorite: !!data
    })
  } catch (error: any) {
    console.error('[API] Erreur check favori:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    )
  }
}
