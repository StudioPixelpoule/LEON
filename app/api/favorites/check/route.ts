/**
 * API Route: Vérifier si un média est en favori
 * GET /api/favorites/check?mediaId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'

// Forcer le rendu dynamique
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const mediaId = searchParams.get('mediaId')
    const mediaType = searchParams.get('mediaType') || 'movie'
    
    if (!mediaId) {
      return NextResponse.json(
        { error: 'mediaId requis' },
        { status: 400 }
      )
    }
    
    const supabase = createSupabaseClient()
    
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('media_id', mediaId)
      .eq('media_type', mediaType)
      .single()
    
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
















