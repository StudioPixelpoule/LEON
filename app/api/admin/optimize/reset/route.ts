/**
 * API: Réinitialiser un film en échec
 * POST /api/admin/optimize/reset
 * 
 * Body: { mediaId: string }
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { mediaId } = await request.json()
    
    if (!mediaId) {
      return NextResponse.json({ error: 'mediaId requis' }, { status: 400 })
    }
    
    // Réinitialiser le statut du film
    const { error } = await supabase
      .from('media_optimization')
      .update({
        status: 'pending',
        error_message: null,
        progress_percent: 0,
        current_progress_time: null,
        speed: null,
        estimated_time_remaining: null,
        started_at: null,
        completed_at: null
      })
      .eq('media_id', mediaId)
    
    if (error) {
      console.error('Erreur réinitialisation:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }
    
    console.log(`🔄 Film réinitialisé: ${mediaId}`)
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Erreur reset:', error)
    return NextResponse.json({ 
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}


