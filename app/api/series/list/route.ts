/**
 * API: Liste toutes les séries avec leurs épisodes
 * GET /api/series/list
 * Optimisé avec cache et requête unique
 */

import { NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { getLastInvalidation } from '@/lib/cache-invalidation'

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
    
    // Utiliser le cache si valide (invalidé par actions admin)
    const cacheValid = !noCache && seriesCache 
      && (now - seriesCache.timestamp) < CACHE_DURATION
      && seriesCache.timestamp > getLastInvalidation()
    if (cacheValid) {
      return NextResponse.json({
        success: true,
        count: seriesCache?.data.length ?? 0,
        series: seriesCache?.data ?? [],
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

    // Transformer les données — affichage par saison complète
    // Une saison est visible seulement quand TOUS ses épisodes sont transcodés
    // La série reste visible tant qu'au moins une saison est complète
    const seriesWithEpisodes = (series || [])
      .map((serie: any) => {
        const allEpisodes = serie.episodes || []
        if (allEpisodes.length === 0) return null

        // Grouper par saison
        const seasonMap: Record<number, { transcoded: number; total: number }> = {}
        allEpisodes.forEach((ep: any) => {
          const s = ep.season_number
          if (!seasonMap[s]) seasonMap[s] = { transcoded: 0, total: 0 }
          seasonMap[s].total++
          if (ep.is_transcoded === true) {
            seasonMap[s].transcoded++
          }
        })

        // Ne garder que les saisons entièrement transcodées
        const readySeasons = Object.entries(seasonMap)
          .filter(([, counts]) => counts.transcoded === counts.total && counts.total > 0)
          .map(([season, counts]) => ({
            season: parseInt(season),
            episodeCount: counts.transcoded
          }))
          .sort((a, b) => a.season - b.season)

        // Saisons en cours de transcodage (au moins un épisode non transcodé)
        const pendingSeasons = Object.entries(seasonMap)
          .filter(([, counts]) => counts.transcoded < counts.total)
          .map(([season, counts]) => ({
            season: parseInt(season),
            ready: counts.transcoded,
            total: counts.total
          }))

        // Si aucune saison n'est prête, cacher la série
        if (readySeasons.length === 0) return null

        const totalReadyEpisodes = readySeasons.reduce((acc, s) => acc + s.episodeCount, 0)

        // Supprimer les épisodes détaillés pour alléger la réponse
        const { episodes: _, ...serieWithoutEpisodes } = serie

        return {
          ...serieWithoutEpisodes,
          seasons: readySeasons,
          totalEpisodes: totalReadyEpisodes,
          // Info optionnelle pour l'interface (saisons en préparation)
          ...(pendingSeasons.length > 0 ? { pendingSeasons } : {})
        }
      })
      .filter((serie: any) => serie !== null)
    
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
        'Cache-Control': 'no-cache, no-store, must-revalidate'
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




