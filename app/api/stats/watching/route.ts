/**
 * API Route: Statistiques de visionnage en temps réel
 * GET /api/stats/watching - Qui regarde quoi en ce moment
 *
 * Définition unifiée :
 *  - "actif" = mis à jour il y a moins de 5 minutes
 *  - "récent" = entre 5 minutes et 24 heures
 *
 * Performance : enrichissement (films, épisodes, séries, profils)
 * exécuté en parallèle via Promise.all().
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { createSupabaseAdmin } from '@/lib/supabase'
import type { ActiveSession, ActivityLiveData } from '@/types/admin'

export const dynamic = 'force-dynamic'

// Seuil unique pour la définition "actif" — 5 minutes
const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authErrorResponse(authError, 403)

  try {
    const supabase = createSupabaseAdmin()

    // Récupérer TOUTES les positions actives des 24 dernières heures
    // (sans .limit() — la contrainte position > 30 filtre suffisamment)
    const cutoff24h = new Date(Date.now() - ONE_DAY_MS).toISOString()
    const { data: allPositions, error: positionsError } = await supabase
      .from('playback_positions')
      .select('*')
      .gt('position', 30)
      .gt('updated_at', cutoff24h)
      .order('updated_at', { ascending: false })

    if (positionsError) {
      console.error('[STATS/WATCHING] Erreur positions:', positionsError)
      return NextResponse.json({ error: 'Erreur récupération positions' }, { status: 500 })
    }

    const positions = allPositions || []

    // Collecter les IDs pour l'enrichissement
    const movieIds = [...new Set(positions.filter(p => p.media_type === 'movie').map(p => p.media_id))]
    const episodeIds = [...new Set(positions.filter(p => p.media_type === 'episode').map(p => p.media_id))]
    const userIds = [...new Set(positions.filter(p => p.user_id).map(p => p.user_id))]

    // Enrichissement en parallèle — 3 requêtes simultanées max
    const [moviesResult, episodesResult, profilesResult] = await Promise.all([
      movieIds.length > 0
        ? supabase.from('media').select('id, title, poster_url, year').in('id', movieIds)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string; poster_url: string | null; year: number | null }> }),
      episodeIds.length > 0
        ? supabase.from('episodes').select('id, title, still_url, season_number, episode_number, series_id').in('id', episodeIds)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string; still_url: string | null; season_number: number; episode_number: number; series_id: string }> }),
      userIds.length > 0
        ? supabase.from('profiles').select('id, display_name, username').in('id', userIds)
        : Promise.resolve({ data: [] as Array<{ id: string; display_name: string | null; username: string | null }> })
    ])

    // Construire les Maps pour un accès O(1)
    const mediaMap = new Map<string, { title: string; poster_url: string | null; year: number | null }>()
    moviesResult.data?.forEach(m => {
      mediaMap.set(m.id, { title: m.title, poster_url: m.poster_url, year: m.year })
    })

    const userMap = new Map<string, { name: string; email: string }>()
    profilesResult.data?.forEach(p => {
      userMap.set(p.id, {
        name: p.display_name || p.username?.split('@')[0] || 'Utilisateur',
        email: p.username || ''
      })
    })

    // Enrichir les épisodes avec leur série (requête séries uniquement si nécessaire)
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

    // Formater les sessions
    const now = Date.now()
    const fiveMinutesAgo = new Date(now - ACTIVE_THRESHOLD_MS)

    const formattedSessions: ActiveSession[] = positions.map(position => {
      const isMovie = position.media_type === 'movie'
      const updatedAt = new Date(position.updated_at)
      const isActive = updatedAt > fiveMinutesAgo
      const userInfo = position.user_id ? userMap.get(position.user_id) : null

      let title = 'Contenu inconnu'
      let posterUrl: string | null = null
      let year: number | null = null
      let seriesTitle: string | undefined
      let seasonNumber: number | undefined
      let episodeNumber: number | undefined

      if (isMovie) {
        const media = mediaMap.get(position.media_id)
        title = media?.title || 'Film inconnu'
        posterUrl = media?.poster_url || null
        year = media?.year || null
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
        position: position.position,
        duration: position.duration,
        progress: position.duration ? Math.round((position.position / position.duration) * 100) : 0,
        updatedAt: position.updated_at,
        isActive,
        seriesTitle,
        seasonNumber,
        episodeNumber
      }
    })

    // Séparer sessions actives (< 5min) et historique récent (5min à 24h)
    const activeSessions = formattedSessions.filter(s => s.isActive)
    const recentHistory = formattedSessions.filter(s => !s.isActive).slice(0, 20)

    // Calculer les stats des dernières 24h
    const uniqueViewers = new Set(formattedSessions.map(s => s.userId || 'anonymous')).size
    const totalWatchTime = formattedSessions.reduce((acc, s) => acc + (s.position || 0), 0)

    // Médias les plus regardés — regrouper par mediaId (pas par titre)
    const watchCounts = new Map<string, { mediaId: string; count: number; title: string; posterUrl: string | null }>()
    formattedSessions.forEach(s => {
      const key = s.mediaId
      const existing = watchCounts.get(key)
      if (existing) {
        existing.count++
      } else {
        watchCounts.set(key, { mediaId: s.mediaId, count: 1, title: s.title, posterUrl: s.posterUrl })
      }
    })

    const mostWatchedToday = Array.from(watchCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(data => ({
        mediaId: data.mediaId,
        title: data.title,
        posterUrl: data.posterUrl,
        watchCount: data.count
      }))

    const response: ActivityLiveData = {
      activeSessions,
      recentHistory,
      stats: {
        totalWatches: formattedSessions.length,
        uniqueViewers,
        totalWatchTimeMinutes: Math.round(totalWatchTime / 60),
        mostWatchedToday
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[STATS/WATCHING] Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur récupération statistiques de visionnage' },
      { status: 500 }
    )
  }
}
