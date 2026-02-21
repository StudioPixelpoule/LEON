/**
 * API Route: Vérifier si un média est en favori
 * GET /api/favorites/check?mediaId=xxx&userId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/api-auth'
import { createSupabaseAdmin } from '@/lib/supabase'

// Forcer le rendu dynamique
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { user: authUser, error: authError } = await requireAuth(request)
  if (authError || !authUser) return authErrorResponse(authError || 'Non authentifié')
  
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
    
    const supabase = createSupabaseAdmin()
    
    const query = supabase
      .from('favorites')
      .select('id')
      .eq('media_id', mediaId)
      .eq('media_type', mediaType)
      .eq('user_id', authUser.id)
    
    const { data, error } = await query.limit(1).maybeSingle()
    
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found, ce n'est pas une erreur
      throw error
    }
    
    return NextResponse.json({
      success: true,
      isFavorite: !!data
    })
  } catch (error: unknown) {
    console.error('[API] Erreur check favori:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
