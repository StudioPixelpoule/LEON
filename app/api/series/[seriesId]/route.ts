/**
 * API: Détails d'une série avec tous ses épisodes
 * GET /api/series/[seriesId]
 */

import { NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: Request,
  { params }: { params: { seriesId: string } }
) {
  try {
    const { seriesId } = params

    // Récupérer la série
    const { data: serie, error: seriesError } = await supabase
      .from('series')
      .select('*')
      .eq('id', seriesId)
      .single()

    if (seriesError || !serie) {
      return NextResponse.json(
        { error: 'Série introuvable' },
        { status: 404 }
      )
    }

    // Récupérer TOUS les épisodes pour filtrer par saison
    const { data: allEpisodes, error: episodesError } = await supabase
      .from('episodes')
      .select('*')
      .eq('series_id', seriesId)
      .order('season_number', { ascending: true })
      .order('episode_number', { ascending: true })

    if (episodesError) {
      console.error('Erreur récupération épisodes:', episodesError)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des épisodes' },
        { status: 500 }
      )
    }

    // Grouper par saison et déterminer le statut de chaque saison
    const seasonGrouped: Record<number, { episodes: any[]; allTranscoded: boolean }> = {}
    for (const ep of (allEpisodes || [])) {
      const s = ep.season_number
      if (!seasonGrouped[s]) {
        seasonGrouped[s] = { episodes: [], allTranscoded: true }
      }
      seasonGrouped[s].episodes.push(ep)
      if (ep.is_transcoded !== true) {
        seasonGrouped[s].allTranscoded = false
      }
    }

    // Ne retourner que les saisons entièrement transcodées
    const readySeasons = Object.entries(seasonGrouped)
      .filter(([, data]) => data.allTranscoded && data.episodes.length > 0)
      .map(([season, data]) => ({
        season: parseInt(season),
        episodes: data.episodes
      }))
      .sort((a, b) => a.season - b.season)

    // Info sur les saisons en cours de transcodage
    const pendingSeasons = Object.entries(seasonGrouped)
      .filter(([, data]) => !data.allTranscoded)
      .map(([season, data]) => ({
        season: parseInt(season),
        ready: data.episodes.filter((ep: any) => ep.is_transcoded === true).length,
        total: data.episodes.length
      }))

    // Si aucune saison n'est prête, renvoyer 503
    if (readySeasons.length === 0) {
      const totalPending = pendingSeasons.reduce((acc, s) => acc + (s.total - s.ready), 0)
      return NextResponse.json(
        { 
          error: 'Série en cours de transcodage',
          message: `${totalPending} épisode(s) en cours de traitement`,
          transcoding: true,
          pendingSeasons
        },
        { status: 503 }
      )
    }

    const totalReadyEpisodes = readySeasons.reduce((acc, s) => acc + s.episodes.length, 0)

    return NextResponse.json({
      success: true,
      serie: {
        ...serie,
        seasons: readySeasons,
        totalEpisodes: totalReadyEpisodes,
        ...(pendingSeasons.length > 0 ? { pendingSeasons } : {})
      }
    })

  } catch (error) {
    console.error('Erreur API series details:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}




