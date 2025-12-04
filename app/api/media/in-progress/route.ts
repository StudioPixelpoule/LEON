/**
 * API Route: Films en cours de visionnage
 * GET /api/media/in-progress
 * Retourne les films avec position sauvegardée
 */

import { NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { createSupabaseClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createSupabaseClient()
    
    // Pour l'instant, utiliser une requête séparée car le JOIN Supabase est complexe
    // 1. Récupérer les positions de lecture
    const { data: positions, error: posError } = await supabase
      .from('playback_positions')
      .select('*')
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
        // Convertir m.id en string pour la comparaison (gère UUID vs TEXT)
        const media = mediaList?.find(m => String(m.id) === String(pos.media_id))
        if (!media) {
          console.warn(`[API] Media non trouvé pour position media_id=${pos.media_id}`)
          return null
        }
        
        // Utiliser la duration du MEDIA (en minutes) OU celle sauvegardée dans playback_positions
        const mediaDurationSeconds = media.duration 
          ? media.duration * 60 
          : (pos.duration || 0)
        
        // Calculer le pourcentage (avec fallback si pas de durée)
        let progressPercent = 0
        if (mediaDurationSeconds > 0) {
          progressPercent = Math.round((pos.position / mediaDurationSeconds) * 100)
        } else if (pos.position > 0) {
          // Si pas de durée mais position > 0, afficher quand même (estimé à 10%)
          progressPercent = 10
        }
        
        return {
          ...media,
          position: pos.position,
          saved_duration: pos.duration,
          playback_updated_at: pos.updated_at,
          progress_percent: Math.min(progressPercent, 99) // Plafonner à 99%
        }
      })
      .filter(item => item !== null && item.progress_percent > 0 && item.progress_percent < 95)

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

