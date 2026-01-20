/**
 * API: Liste toutes les séries avec leurs épisodes
 * GET /api/series/list
 * Optimisé avec cache et requête unique
 */

import { NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'

// Cache en mémoire côté serveur (5 minutes)
interface CachedSeries {
  data: any[]
  timestamp: number
}
let seriesCache: CachedSeries | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const noCache = searchParams.get('nocache') === 'true'
    const now = Date.now()
    
    // Utiliser le cache si valide
    if (!noCache && seriesCache && (now - seriesCache.timestamp) < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        count: seriesCache.data.length,
        series: seriesCache.data,
        cached: true
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60'
        }
      })
    }

    // Requête optimisée : récupérer séries ET épisodes en une seule requête
    const { data: series, error: seriesError } = await supabase
      .from('series')
      .select(`
        *,
        episodes (
          season_number,
          episode_number
        )
      `)
      .order('title', { ascending: true })

    if (seriesError) {
      console.error('Erreur récupération séries:', seriesError)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des séries' },
        { status: 500 }
      )
    }

    // Transformer les données
    const seriesWithEpisodes = (series || []).map((serie: any) => {
      const episodes = serie.episodes || []
      
      // Grouper par saison
      const seasonMap: Record<number, number> = {}
      episodes.forEach((ep: any) => {
        seasonMap[ep.season_number] = (seasonMap[ep.season_number] || 0) + 1
      })

      const seasons = Object.entries(seasonMap)
        .map(([season, count]) => ({
          season: parseInt(season),
          episodeCount: count
        }))
        .sort((a, b) => a.season - b.season)

      // Supprimer les épisodes détaillés pour alléger la réponse
      const { episodes: _, ...serieWithoutEpisodes } = serie

      return {
        ...serieWithoutEpisodes,
        seasons,
        totalEpisodes: episodes.length
      }
    })
    
    // Mettre à jour le cache
    seriesCache = {
      data: seriesWithEpisodes,
      timestamp: now
    }

    return NextResponse.json({
      success: true,
      count: seriesWithEpisodes.length,
      series: seriesWithEpisodes,
      cached: false
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60'
      }
    })

  } catch (error) {
    console.error('Erreur API series list:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}




