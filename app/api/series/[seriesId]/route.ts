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

    // Récupérer TOUS les épisodes pour vérifier le statut de transcodage
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

    // 🔑 Vérifier si la série est en cours de transcodage
    const notTranscodedCount = (allEpisodes || []).filter(
      (ep: any) => ep.is_transcoded === false
    ).length

    if (notTranscodedCount > 0) {
      // Série en cours de transcodage - accès refusé
      return NextResponse.json(
        { 
          error: 'Série en cours de transcodage',
          message: `${notTranscodedCount} épisode(s) en cours de traitement`,
          transcoding: true
        },
        { status: 503 }
      )
    }

    // Filtrer pour ne garder que les épisodes transcodés
    const episodes = (allEpisodes || []).filter(
      (ep: any) => ep.is_transcoded === true || ep.is_transcoded === null
    )

    // Grouper par saison
    const seasonMap: Record<number, any[]> = {}
    episodes?.forEach(ep => {
      if (!seasonMap[ep.season_number]) {
        seasonMap[ep.season_number] = []
      }
      seasonMap[ep.season_number].push(ep)
    })

    const seasons = Object.entries(seasonMap).map(([season, eps]) => ({
      season: parseInt(season),
      episodes: eps
    }))

    return NextResponse.json({
      success: true,
      serie: {
        ...serie,
        seasons,
        totalEpisodes: episodes?.length || 0
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




