/**
 * API: Liste toutes les séries avec leurs épisodes
 * GET /api/series/list
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Récupérer toutes les séries
    const { data: series, error: seriesError } = await supabase
      .from('series')
      .select('*')
      .order('title', { ascending: true })

    if (seriesError) {
      console.error('Erreur récupération séries:', seriesError)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des séries' },
        { status: 500 }
      )
    }

    // Pour chaque série, récupérer le nombre d'épisodes par saison
    const seriesWithEpisodes = await Promise.all(
      (series || []).map(async (serie) => {
        const { data: episodes } = await supabase
          .from('episodes')
          .select('season_number, episode_number')
          .eq('series_id', serie.id)
          .order('season_number', { ascending: true })
          .order('episode_number', { ascending: true })

        // Grouper par saison
        const seasonMap: Record<number, number> = {}
        episodes?.forEach(ep => {
          seasonMap[ep.season_number] = (seasonMap[ep.season_number] || 0) + 1
        })

        const seasons = Object.entries(seasonMap).map(([season, count]) => ({
          season: parseInt(season),
          episodeCount: count
        }))

        return {
          ...serie,
          seasons,
          totalEpisodes: episodes?.length || 0
        }
      })
    )

    return NextResponse.json({
      success: true,
      count: seriesWithEpisodes.length,
      series: seriesWithEpisodes
    })

  } catch (error) {
    console.error('Erreur API series list:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}




