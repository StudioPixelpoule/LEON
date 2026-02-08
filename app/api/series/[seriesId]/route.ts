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

    // Récupérer tous les épisodes transcodés groupés par saison
    const { data: episodes, error: episodesError } = await supabase
      .from('episodes')
      .select('*')
      .eq('series_id', seriesId)
      // Afficher tous les épisodes — syncTranscodedStatus gère le marquage
      .order('season_number', { ascending: true })
      .order('episode_number', { ascending: true })

    if (episodesError) {
      console.error('Erreur récupération épisodes:', episodesError)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des épisodes' },
        { status: 500 }
      )
    }

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




