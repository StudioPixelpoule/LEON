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
    
    // Pour l'instant, utiliser une requête séparée car le JOIN Supabase est complexe
    // 1. Récupérer les positions de lecture
    const DUMMY_USER_ID = '00000000-0000-0000-0000-000000000000'
    
    const { data: positions, error: posError } = await supabase
      .from('playback_positions')
      .select('*')
      .eq('user_id', DUMMY_USER_ID)
      .gt('position', 30) // Au moins 30s regardées
      .order('updated_at', { ascending: false })
      .limit(20)

    if (posError) {
      throw posError
    }

    if (!positions || positions.length === 0) {
      return NextResponse.json({
        success: true,
        media: [],
        count: 0
      })
    }

    // 2. Récupérer les infos des films correspondants
    const mediaIds = positions.map(p => p.media_id)
    const { data: mediaList, error: mediaError } = await supabase
      .from('media')
      .select('*')
      .in('id', mediaIds)

    if (mediaError) {
      throw mediaError
    }

    // 3. Fusionner les données
    const formattedData = positions
      .map(pos => {
        // Convertir m.id en string pour la comparaison
        const media = mediaList?.find(m => String(m.id) === pos.media_id)
        if (!media) return null
        
        const progressPercent = pos.duration > 0 
          ? Math.floor((pos.position / pos.duration) * 100) 
          : 0
        
        return {
          ...media,
          position: pos.position,
          saved_duration: pos.duration,
          playback_updated_at: pos.updated_at,
          progress_percent: progressPercent
        }
      })
      .filter(item => item !== null && item.progress_percent < 95) // Pas fini

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

