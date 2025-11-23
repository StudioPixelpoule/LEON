/**
 * API Route: Films en cours de visionnage
 * GET /api/media/in-progress
 * Retourne les films avec position sauvegardée
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createClient()
    
    // Utiliser la vue créée dans la migration
    const { data, error } = await supabase
      .from('media_in_progress')
      .select('*')
      .order('last_watched', { ascending: false })
      .limit(20) // Max 20 films en cours

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      media: data || [],
      count: data?.length || 0
    })
  } catch (error: any) {
    console.error('[API] Erreur récupération films en cours:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Erreur serveur', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}

