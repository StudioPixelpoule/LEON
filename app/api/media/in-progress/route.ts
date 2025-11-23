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
    
    // Requête directe avec JOIN au lieu de la vue (plus compatible)
    const { data, error } = await supabase
      .from('playback_positions')
      .select(`
        position,
        duration,
        updated_at,
        media:media_id (*)
      `)
      .gt('position', 30) // Au moins 30s
      .order('updated_at', { ascending: false })
      .limit(20)

    if (error) {
      throw error
    }

    // Reformater les données pour avoir la structure attendue
    const formattedData = (data || [])
      .filter(item => item.media) // Filtrer les items sans media
      .map(item => ({
        ...(Array.isArray(item.media) ? item.media[0] : item.media),
        current_time: item.position,
        saved_duration: item.duration,
        last_watched: item.updated_at,
        progress_percent: item.duration && item.duration > 0 
          ? Math.floor((item.position / item.duration) * 100)
          : 0
      }))
      .filter(item => item.progress_percent < 95) // Pas fini

    return NextResponse.json({
      success: true,
      media: formattedData,
      count: formattedData.length
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

