/**
 * API temporaire pour nettoyer les séries dupliquées
 * DELETE /api/admin/cleanup-duplicate?seriesId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(request: NextRequest) {
  const seriesId = request.nextUrl.searchParams.get('seriesId')
  
  if (!seriesId) {
    return NextResponse.json({ error: 'seriesId requis' }, { status: 400 })
  }
  
  try {
    // Supprimer les épisodes d'abord
    const { error: delEpError } = await supabase
      .from('episodes')
      .delete()
      .eq('series_id', seriesId)
    
    if (delEpError) {
      console.error('Erreur suppression épisodes:', delEpError)
    }
    
    // Puis supprimer la série
    const { error: delSeriesError } = await supabase
      .from('series')
      .delete()
      .eq('id', seriesId)
    
    if (delSeriesError) {
      return NextResponse.json({ error: delSeriesError.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, message: 'Série et épisodes supprimés' })
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
