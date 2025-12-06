/**
 * API Route: Médias en cours de visionnage (films + épisodes)
 * GET /api/media/in-progress
 * Retourne les films ET épisodes avec position sauvegardée
 */

import { NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { createSupabaseClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createSupabaseClient()
    
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

    // Séparer les IDs par type (movie vs episode)
    const moviePositions = positions.filter(p => p.media_type === 'movie' || !p.media_type)
    const episodePositions = positions.filter(p => p.media_type === 'episode')
    
    const movieIds = moviePositions.map(p => p.media_id)
    const episodeIds = episodePositions.map(p => p.media_id)

    // 2. Récupérer les films
    let mediaList: any[] = []
    if (movieIds.length > 0) {
      const { data: movies, error: mediaError } = await supabase
        .from('media')
        .select('*')
        .in('id', movieIds)

      if (!mediaError && movies) {
        mediaList = movies.map(m => ({ ...m, content_type: 'movie' }))
      }
    }

    // 3. Récupérer les épisodes avec infos de la série
    if (episodeIds.length > 0) {
      const { data: episodes, error: epError } = await supabase
        .from('episodes')
        .select(`
          id,
          title,
          season_number,
          episode_number,
          filepath,
          still_url,
          series:series_id (
            id,
            title,
            poster_url,
            backdrop_url
          )
        `)
        .in('id', episodeIds)

      if (!epError && episodes) {
        const formattedEpisodes = episodes.map(ep => ({
          id: ep.id,
          title: (ep.series as any)?.title || 'Série',
          subtitle: `S${ep.season_number}E${ep.episode_number} · ${ep.title}`,
          poster_url: (ep.series as any)?.poster_url,
          backdrop_url: (ep.series as any)?.backdrop_url,
          filepath: ep.filepath,
          still_url: ep.still_url,
          series_id: (ep.series as any)?.id,
          season_number: ep.season_number,
          episode_number: ep.episode_number,
          content_type: 'episode'
        }))
        mediaList = [...mediaList, ...formattedEpisodes]
      }
    }

    // 4. Fusionner avec les positions
    const formattedData = positions
      .map(pos => {
        const media = mediaList?.find(m => String(m.id) === String(pos.media_id))
        if (!media) {
          console.warn(`[API] Media non trouvé pour position media_id=${pos.media_id}`)
          return null
        }
        
        // Utiliser la durée sauvegardée (les épisodes n'ont pas de durée en base)
        const durationSeconds = pos.duration || 0
        
        // Calculer le pourcentage
        let progressPercent = 0
        if (durationSeconds > 0) {
          progressPercent = Math.round((pos.position / durationSeconds) * 100)
        } else if (pos.position > 0) {
          progressPercent = 10 // Fallback si pas de durée
        }
        
        return {
          ...media,
          position: pos.position,
          saved_duration: pos.duration,
          playback_updated_at: pos.updated_at,
          progress_percent: Math.min(progressPercent, 99)
        }
      })
      .filter(item => item !== null && item.progress_percent > 0 && item.progress_percent < 95)

    return NextResponse.json({
      success: true,
      media: formattedData,
      count: formattedData.length
    })
  } catch (error: any) {
    console.error('[API] Erreur récupération médias en cours:', error)
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

