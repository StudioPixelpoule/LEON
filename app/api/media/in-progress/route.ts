/**
 * API Route: Médias en cours de visionnage (films + épisodes)
 * GET /api/media/in-progress?userId=xxx
 * Retourne les films ET épisodes avec position sauvegardée pour un utilisateur
 *
 * Robustesse :
 * - Filtre is_transcoded sur les films ET les épisodes
 * - Résilience : si la requête épisodes échoue, retourne quand même les films
 * - Nettoyage des positions orphelines (média supprimé)
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { createSupabaseClient } from '@/lib/supabase'

// Types internes pour la fusion
interface MediaItem {
  id: string
  title: string
  subtitle?: string
  poster_url?: string
  backdrop_url?: string
  filepath?: string
  still_url?: string
  series_id?: string
  season_number?: number
  episode_number?: number
  content_type: 'movie' | 'episode'
  year?: number
  formatted_runtime?: string
  [key: string]: unknown
}

interface PositionRow {
  id: string
  media_id: string
  media_type: string | null
  position: number
  duration: number | null
  updated_at: string | null
  user_id: string | null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // 1. Récupérer les positions de lecture
    let query = supabase
      .from('playback_positions')
      .select('*')
      .gt('position', 30)
      .order('updated_at', { ascending: false })
      .limit(20)

    if (userId) {
      query = query.eq('user_id', userId)
    } else {
      query = query.is('user_id', null)
    }

    const { data: positions, error: posError } = await query

    if (posError) throw posError

    if (!positions || positions.length === 0) {
      return NextResponse.json({ success: true, media: [], count: 0 })
    }

    const typedPositions = positions as PositionRow[]

    // Séparer par type
    const moviePositions = typedPositions.filter(p => p.media_type === 'movie' || !p.media_type)
    const episodePositions = typedPositions.filter(p => p.media_type === 'episode')

    const movieIds = moviePositions.map(p => p.media_id)
    const episodeIds = episodePositions.map(p => p.media_id)

    const mediaList: MediaItem[] = []
    const orphanedPositionIds: string[] = []

    // 2. Récupérer les films (transcodés uniquement)
    if (movieIds.length > 0) {
      try {
        const { data: movies, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .in('id', movieIds)
          .eq('is_transcoded', true)

        if (!mediaError && movies) {
          for (const m of movies) {
            mediaList.push({ ...m, content_type: 'movie' } as MediaItem)
          }
          // Identifier les positions orphelines (film supprimé ou non transcodé)
          const foundMovieIds = new Set(movies.map(m => String(m.id)))
          for (const pos of moviePositions) {
            if (!foundMovieIds.has(String(pos.media_id))) {
              orphanedPositionIds.push(pos.id)
            }
          }
        }
      } catch (movieError) {
        console.error('[API] Erreur récupération films in-progress:', movieError)
        // Continuer avec les épisodes même si les films échouent
      }
    }

    // 3. Récupérer les épisodes (transcodés uniquement) avec infos série
    if (episodeIds.length > 0) {
      try {
        const { data: episodes, error: epError } = await supabase
          .from('episodes')
          .select(`
            id,
            title,
            season_number,
            episode_number,
            filepath,
            still_url,
            is_transcoded,
            series:series_id (
              id,
              title,
              poster_url,
              backdrop_url
            )
          `)
          .in('id', episodeIds)
          .eq('is_transcoded', true)

        if (!epError && episodes) {
          for (const ep of episodes) {
            // Supabase retourne la relation comme un objet ou un tableau
            const seriesRaw = ep.series as unknown
            const series = (Array.isArray(seriesRaw) ? seriesRaw[0] : seriesRaw) as
              { id?: string; title?: string; poster_url?: string; backdrop_url?: string } | null

            mediaList.push({
              id: ep.id,
              title: series?.title || 'Série',
              subtitle: `S${ep.season_number}E${ep.episode_number} · ${ep.title}`,
              poster_url: series?.poster_url,
              backdrop_url: series?.backdrop_url,
              filepath: ep.filepath,
              still_url: ep.still_url,
              series_id: series?.id,
              season_number: ep.season_number,
              episode_number: ep.episode_number,
              content_type: 'episode'
            })
          }
          // Identifier les positions orphelines (épisode supprimé ou non transcodé)
          const foundEpisodeIds = new Set(episodes.map(e => String(e.id)))
          for (const pos of episodePositions) {
            if (!foundEpisodeIds.has(String(pos.media_id))) {
              orphanedPositionIds.push(pos.id)
            }
          }
        }
      } catch (epError) {
        console.error('[API] Erreur récupération épisodes in-progress:', epError)
        // Continuer avec les films même si les épisodes échouent
      }
    }

    // 4. Nettoyage asynchrone des positions orphelines (fire-and-forget)
    if (orphanedPositionIds.length > 0) {
      console.warn(`[API] Nettoyage de ${orphanedPositionIds.length} position(s) orpheline(s)`)
      supabase
        .from('playback_positions')
        .delete()
        .in('id', orphanedPositionIds)
        .then(({ error }) => {
          if (error) console.error('[API] Erreur nettoyage orphelins:', error)
        })
    }

    // 5. Fusionner positions + médias
    const formattedData = typedPositions
      .map(pos => {
        const media = mediaList.find(m => String(m.id) === String(pos.media_id))
        if (!media) return null

        const durationSeconds = pos.duration || 0

        let progressPercent = 0
        if (durationSeconds > 0) {
          progressPercent = Math.round((pos.position / durationSeconds) * 100)
        } else if (pos.position > 0) {
          progressPercent = 10
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
  } catch (error: unknown) {
    console.error('[API] Erreur récupération médias en cours:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
