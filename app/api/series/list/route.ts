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
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    }

    // Requête optimisée : récupérer séries ET épisodes transcodés en une seule requête
    const { data: series, error: seriesError } = await supabase
      .from('series')
      .select(`
        *,
        episodes (
          season_number,
          episode_number,
          is_transcoded
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

    // Transformer les données - ne garder que les épisodes transcodés
    const seriesWithEpisodes = (series || [])
      .map((serie: any) => {
        const allEpisodes = serie.episodes || []
        // Ne garder que les épisodes transcodés ou sans flag (pré-migration)
        const episodes = allEpisodes.filter((ep: any) => 
          ep.is_transcoded === true || ep.is_transcoded === null
        )
        
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
      // Ne garder que les séries qui ont au moins un épisode transcodé
      .filter((serie: any) => serie.totalEpisodes > 0)
    
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
        // 🔧 FIX: Si nocache=true, désactiver complètement le cache HTTP
        'Cache-Control': noCache
          ? 'no-cache, no-store, must-revalidate'
          : 'public, s-maxage=300, stale-while-revalidate=60'
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




