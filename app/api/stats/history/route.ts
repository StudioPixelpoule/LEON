/**
 * API Route: Historique complet de visionnage
 * GET /api/stats/history - Historique par utilisateur avec pagination
 *
 * Optimisations par rapport à la version précédente :
 *  - Une seule requête playback_positions (au lieu de deux)
 *  - Enrichissement (films, épisodes, séries, profils) en parallèle
 *  - Validation des paramètres d'entrée
 *  - Protection du calcul "completed" quand duration est null
 *  - Pagination en mémoire pour éliminer la double requête
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { createSupabaseAdmin } from '@/lib/supabase'
import type { HistoryEntry, UserActivityStats, HistoryData } from '@/types/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authErrorResponse(authError, 403)

  try {
    const supabase = createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams

    // Validation des paramètres
    const rawPage = parseInt(searchParams.get('page') || '1')
    const rawLimit = parseInt(searchParams.get('limit') || '50')
    const rawDays = parseInt(searchParams.get('days') || '30')
    const userId = searchParams.get('userId')

    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage)
    const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit))
    const days = Math.min(365, Math.max(1, isNaN(rawDays) ? 30 : rawDays))

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Une seule requête — on charge TOUTES les positions de la période
    // puis on pagine en mémoire (la table est petite : quelques centaines max)
    let positionsQuery = supabase
      .from('playback_positions')
      .select('*')
      .gt('updated_at', cutoffDate)
      .gt('position', 30)
      .order('updated_at', { ascending: false })

    // Filtrer par utilisateur si spécifié
    if (userId && userId !== 'all') {
      positionsQuery = positionsQuery.eq('user_id', userId)
    }

    const { data: allPositions, error: positionsError } = await positionsQuery

    if (positionsError) {
      console.error('[STATS/HISTORY] Erreur positions:', positionsError)
      return NextResponse.json({ error: 'Erreur récupération historique' }, { status: 500 })
    }

    const positions = allPositions || []
    const total = positions.length

    // Collecter les IDs pour l'enrichissement
    const movieIds = [...new Set(positions.filter(p => p.media_type === 'movie').map(p => p.media_id))]
    const episodeIds = [...new Set(positions.filter(p => p.media_type === 'episode').map(p => p.media_id))]
    const userIds = [...new Set(positions.filter(p => p.user_id).map(p => p.user_id))]

    // Enrichissement en parallèle
    const [moviesResult, episodesResult, profilesResult] = await Promise.all([
      movieIds.length > 0
        ? supabase.from('media').select('id, title, poster_url, year, duration').in('id', movieIds)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string; poster_url: string | null; year: number | null; duration: number | null }> }),
      episodeIds.length > 0
        ? supabase.from('episodes').select('id, title, still_url, season_number, episode_number, series_id').in('id', episodeIds)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string; still_url: string | null; season_number: number; episode_number: number; series_id: string }> }),
      userIds.length > 0
        ? supabase.from('profiles').select('id, display_name, username').in('id', userIds)
        : Promise.resolve({ data: [] as Array<{ id: string; display_name: string | null; username: string | null }> })
    ])

    // Construire les Maps
    const mediaMap = new Map<string, { title: string; poster_url: string | null; year: number | null; duration: number | null }>()
    moviesResult.data?.forEach(m => {
      mediaMap.set(m.id, {
        title: m.title,
        poster_url: m.poster_url,
        year: m.year,
        duration: m.duration ? m.duration * 60 : null // minutes → secondes
      })
    })

    const userMap = new Map<string, { name: string; email: string }>()
    profilesResult.data?.forEach(p => {
      userMap.set(p.id, {
        name: p.display_name || p.username?.split('@')[0] || 'Utilisateur',
        email: p.username || ''
      })
    })

    // Enrichir les épisodes avec leur série
    const episodeMap = new Map<string, {
      title: string; poster_url: string | null
      season_number: number; episode_number: number
      series_title?: string; series_poster?: string
    }>()

    if (episodesResult.data && episodesResult.data.length > 0) {
      const seriesIds = [...new Set(episodesResult.data.map(e => e.series_id))]
      const seriesMap = new Map<string, { title: string; poster_url: string | null }>()

      if (seriesIds.length > 0) {
        const { data: seriesData } = await supabase
          .from('series')
          .select('id, title, poster_url')
          .in('id', seriesIds)

        seriesData?.forEach(s => {
          seriesMap.set(s.id, { title: s.title, poster_url: s.poster_url })
        })
      }

      episodesResult.data.forEach(e => {
        const series = seriesMap.get(e.series_id)
        episodeMap.set(e.id, {
          title: e.title || `Épisode ${e.episode_number}`,
          poster_url: e.still_url,
          season_number: e.season_number,
          episode_number: e.episode_number,
          series_title: series?.title ?? undefined,
          series_poster: series?.poster_url ?? undefined
        })
      })
    }

    // Formater TOUT l'historique (pour les stats utilisateurs)
    const fullHistory: HistoryEntry[] = positions.map(position => {
      const isMovie = position.media_type === 'movie'
      const userInfo = position.user_id ? userMap.get(position.user_id) : null

      let title = 'Contenu inconnu'
      let posterUrl: string | null = null
      let year: number | null = null
      let mediaDuration: number | null = position.duration
      let seriesTitle: string | undefined
      let seasonNumber: number | undefined
      let episodeNumber: number | undefined

      if (isMovie) {
        const media = mediaMap.get(position.media_id)
        title = media?.title || 'Film inconnu'
        posterUrl = media?.poster_url || null
        year = media?.year || null
        if (media?.duration) mediaDuration = media.duration
      } else {
        const episode = episodeMap.get(position.media_id)
        if (episode) {
          seriesTitle = episode.series_title
          seasonNumber = episode.season_number
          episodeNumber = episode.episode_number
          title = episode.series_title
            ? `${episode.series_title} - S${episode.season_number}E${episode.episode_number}`
            : `S${episode.season_number}E${episode.episode_number}`
          posterUrl = episode.series_poster || episode.poster_url
        }
      }

      // Protection : ne considérer "completed" que si duration est connue et > 0
      const progress = mediaDuration && mediaDuration > 0
        ? Math.round((position.position / mediaDuration) * 100)
        : 0
      const completed = mediaDuration && mediaDuration > 0 ? progress >= 90 : false

      return {
        id: position.id,
        userId: position.user_id,
        userName: userInfo?.name || 'Anonyme',
        userEmail: userInfo?.email || null,
        mediaId: position.media_id,
        mediaType: position.media_type as 'movie' | 'episode',
        title,
        posterUrl,
        year,
        watchedAt: position.updated_at,
        watchDuration: position.position,
        progress: Math.min(100, progress),
        completed,
        seriesTitle,
        seasonNumber,
        episodeNumber
      }
    })

    // Calculer les stats par utilisateur (sur TOUTES les positions)
    const userStatsMap = new Map<string, {
      totalWatches: number
      totalWatchTime: number
      completedCount: number
      lastActivity: string
    }>()

    fullHistory.forEach(entry => {
      const id = entry.userId || 'anonymous'
      const existing = userStatsMap.get(id) || {
        totalWatches: 0,
        totalWatchTime: 0,
        completedCount: 0,
        lastActivity: entry.watchedAt
      }

      existing.totalWatches++
      existing.totalWatchTime += entry.watchDuration || 0
      if (entry.completed) existing.completedCount++
      if (entry.watchedAt > existing.lastActivity) {
        existing.lastActivity = entry.watchedAt
      }

      userStatsMap.set(id, existing)
    })

    const userStats: UserActivityStats[] = Array.from(userStatsMap.entries())
      .map(([id, stats]) => {
        const userInfo = id !== 'anonymous' ? userMap.get(id) : null
        return {
          userId: id,
          userName: userInfo?.name || (id === 'anonymous' ? 'Anonyme' : 'Utilisateur'),
          userEmail: userInfo?.email || null,
          totalWatches: stats.totalWatches,
          totalWatchTimeMinutes: Math.round(stats.totalWatchTime / 60),
          completedCount: stats.completedCount,
          lastActivity: stats.lastActivity
        }
      })
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())

    // Pagination en mémoire
    const offset = (page - 1) * limit
    const paginatedHistory = fullHistory.slice(offset, offset + limit)

    // Liste des utilisateurs pour le filtre
    const users = Array.from(userMap.entries()).map(([id, info]) => ({
      id,
      name: info.name,
      email: info.email
    }))

    const response: HistoryData = {
      history: paginatedHistory,
      userStats,
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[STATS/HISTORY] Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur récupération historique' },
      { status: 500 }
    )
  }
}
