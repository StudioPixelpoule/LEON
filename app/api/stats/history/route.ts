/**
 * API Route: Historique complet de visionnage
 * GET /api/stats/history - Historique par utilisateur avec pagination
 * Utilise playback_positions pour les données réelles
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { createSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface HistoryEntry {
  id: string
  userId: string | null
  userName: string
  userEmail: string | null
  mediaId: string
  mediaType: 'movie' | 'episode'
  title: string
  posterUrl: string | null
  year: number | null
  watchedAt: string
  watchDuration: number
  progress: number
  completed: boolean
  // Info supplémentaire pour les épisodes
  seriesTitle?: string
  seasonNumber?: number
  episodeNumber?: number
}

interface UserStats {
  userId: string
  userName: string
  userEmail: string | null
  totalWatches: number
  totalWatchTimeMinutes: number
  completedCount: number
  lastActivity: string
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authErrorResponse(authError, 403)
  
  try {
    const supabase = createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const userId = searchParams.get('userId')
    const days = parseInt(searchParams.get('days') || '30')
    
    const offset = (page - 1) * limit
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    
    // Construire la requête de base
    let positionsQuery = supabase
      .from('playback_positions')
      .select('*', { count: 'exact' })
      .gt('updated_at', cutoffDate)
      .gt('position', 30) // Au moins 30 secondes regardées
      .order('updated_at', { ascending: false })
    
    // Filtrer par utilisateur si spécifié
    if (userId && userId !== 'all') {
      positionsQuery = positionsQuery.eq('user_id', userId)
    }
    
    // Pagination
    positionsQuery = positionsQuery.range(offset, offset + limit - 1)
    
    const { data: positionsData, error: positionsError, count } = await positionsQuery

    if (positionsError) {
      console.error('Erreur positions:', positionsError)
      return NextResponse.json({ error: 'Erreur récupération historique' }, { status: 500 })
    }

    // Séparer les films et les épisodes
    const movieIds = positionsData?.filter(p => p.media_type === 'movie').map(p => p.media_id) || []
    const episodeIds = positionsData?.filter(p => p.media_type === 'episode').map(p => p.media_id) || []
    const userIds = [...new Set(positionsData?.filter(p => p.user_id).map(p => p.user_id) || [])]

    // Récupérer les infos des films
    let mediaMap = new Map<string, { title: string; poster_url: string | null; year: number | null; duration: number | null }>()
    if (movieIds.length > 0) {
      const { data: mediaData } = await supabase
        .from('media')
        .select('id, title, poster_url, year, duration')
        .in('id', movieIds)
      
      mediaData?.forEach(m => {
        mediaMap.set(m.id, { 
          title: m.title, 
          poster_url: m.poster_url, 
          year: m.year,
          duration: m.duration ? m.duration * 60 : null // Convertir minutes en secondes
        })
      })
    }

    // Récupérer les infos des épisodes avec leur série
    let episodeMap = new Map<string, { 
      title: string; 
      poster_url: string | null; 
      season_number: number; 
      episode_number: number;
      series_id: string;
      series_title?: string;
      series_poster?: string;
    }>()
    
    if (episodeIds.length > 0) {
      const { data: episodeData } = await supabase
        .from('episodes')
        .select('id, title, still_url, season_number, episode_number, series_id')
        .in('id', episodeIds)
      
      const seriesIds = [...new Set(episodeData?.map(e => e.series_id) || [])]
      let seriesMap = new Map<string, { title: string; poster_url: string | null }>()
      
      if (seriesIds.length > 0) {
        const { data: seriesData } = await supabase
          .from('series')
          .select('id, title, poster_url')
          .in('id', seriesIds)
        
        seriesData?.forEach(s => {
          seriesMap.set(s.id, { title: s.title, poster_url: s.poster_url })
        })
      }
      
      episodeData?.forEach(e => {
        const series = seriesMap.get(e.series_id)
        episodeMap.set(e.id, {
          title: e.title || `Épisode ${e.episode_number}`,
          poster_url: e.still_url,
          season_number: e.season_number,
          episode_number: e.episode_number,
          series_id: e.series_id,
          series_title: series?.title ?? undefined,
          series_poster: series?.poster_url ?? undefined
        })
      })
    }

    // Récupérer les infos utilisateurs
    let userMap = new Map<string, { name: string; email: string }>()
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', userIds)
      
      profilesData?.forEach(p => {
        userMap.set(p.id, {
          name: p.display_name || p.username?.split('@')[0] || 'Utilisateur',
          email: p.username || ''
        })
      })
    }

    // Formater l'historique
    const history: HistoryEntry[] = (positionsData || []).map(position => {
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
      
      const progress = mediaDuration ? Math.round((position.position / mediaDuration) * 100) : 0
      const completed = progress >= 90 // Considéré comme terminé si >= 90%
      
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

    // Récupérer TOUS les positions pour calculer les stats utilisateurs
    const { data: allPositionsForStats } = await supabase
      .from('playback_positions')
      .select('user_id, position, duration, updated_at')
      .gt('updated_at', cutoffDate)
      .gt('position', 30)

    // Récupérer les infos utilisateurs manquants pour les stats
    const allUserIdsForStats = [...new Set(allPositionsForStats?.filter(p => p.user_id).map(p => p.user_id) || [])]
    const missingUserIds = allUserIdsForStats.filter(id => !userMap.has(id))
    
    if (missingUserIds.length > 0) {
      const { data: additionalProfiles } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', missingUserIds)
      
      additionalProfiles?.forEach(p => {
        userMap.set(p.id, {
          name: p.display_name || p.username?.split('@')[0] || 'Utilisateur',
          email: p.username || ''
        })
      })
    }

    // Calculer les stats par utilisateur
    const userStatsMap = new Map<string, {
      totalWatches: number
      totalWatchTime: number
      completedCount: number
      lastActivity: string
    }>()

    allPositionsForStats?.forEach(position => {
      const id = position.user_id || 'anonymous'
      const existing = userStatsMap.get(id) || {
        totalWatches: 0,
        totalWatchTime: 0,
        completedCount: 0,
        lastActivity: position.updated_at
      }
      
      existing.totalWatches++
      existing.totalWatchTime += position.position || 0
      
      const progress = position.duration ? (position.position / position.duration) * 100 : 0
      if (progress >= 90) existing.completedCount++
      
      if (position.updated_at > existing.lastActivity) {
        existing.lastActivity = position.updated_at
      }
      
      userStatsMap.set(id, existing)
    })

    // Formater les stats utilisateurs
    const userStats: UserStats[] = Array.from(userStatsMap.entries())
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

    // Liste des utilisateurs pour le filtre
    const users = Array.from(userMap.entries()).map(([id, info]) => ({
      id,
      name: info.name,
      email: info.email
    }))

    return NextResponse.json({
      history,
      userStats,
      users,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      filters: {
        days,
        userId: userId || 'all'
      }
    })

  } catch (error) {
    console.error('Erreur stats history:', error)
    return NextResponse.json(
      { error: 'Erreur récupération historique' },
      { status: 500 }
    )
  }
}
