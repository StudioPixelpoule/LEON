/**
 * API Route: Statistiques de visionnage en temps réel
 * GET /api/stats/watching - Qui regarde quoi en ce moment
 * Utilise playback_positions pour les données réelles
 */

import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface ActiveSession {
  id: string
  userId: string | null
  userName: string
  userEmail: string | null
  mediaId: string
  mediaType: 'movie' | 'episode'
  title: string
  posterUrl: string | null
  year: number | null
  position: number
  duration: number | null
  progress: number
  updatedAt: string
  isActive: boolean
  // Info supplémentaire pour les épisodes
  seriesTitle?: string
  seasonNumber?: number
  episodeNumber?: number
}

interface WatchingStats {
  activeSessions: ActiveSession[]
  recentHistory: ActiveSession[]
  stats: {
    totalWatches: number
    uniqueViewers: number
    totalWatchTimeMinutes: number
    mostWatchedToday: Array<{
      mediaId: string
      title: string
      posterUrl: string | null
      watchCount: number
    }>
  }
}

export async function GET() {
  try {
    const supabase = createSupabaseAdmin()
    
    // Récupérer TOUTES les positions de lecture (pas seulement les 10 dernières minutes)
    // On trie par updated_at DESC pour avoir les plus récentes en premier
    const { data: allPositions, error: positionsError } = await supabase
      .from('playback_positions')
      .select('*')
      .gt('position', 30) // Au moins 30 secondes regardées
      .order('updated_at', { ascending: false })
      .limit(100)

    if (positionsError) {
      console.error('Erreur positions:', positionsError)
      return NextResponse.json({ error: 'Erreur récupération positions' }, { status: 500 })
    }

    // Séparer les films et les épisodes
    const movieIds = allPositions?.filter(p => p.media_type === 'movie').map(p => p.media_id) || []
    const episodeIds = allPositions?.filter(p => p.media_type === 'episode').map(p => p.media_id) || []
    const userIds = [...new Set(allPositions?.filter(p => p.user_id).map(p => p.user_id) || [])]

    // Récupérer les infos des films
    let mediaMap = new Map<string, { title: string; poster_url: string | null; year: number | null }>()
    if (movieIds.length > 0) {
      const { data: mediaData } = await supabase
        .from('media')
        .select('id, title, poster_url, year')
        .in('id', movieIds)
      
      mediaData?.forEach(m => {
        mediaMap.set(m.id, { title: m.title, poster_url: m.poster_url, year: m.year })
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
      
      // Récupérer les séries liées
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
          series_title: series?.title,
          series_poster: series?.poster_url || null
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

    // Formater les sessions
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    const formattedSessions: ActiveSession[] = (allPositions || []).map(position => {
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

    // Séparer sessions actives et historique récent
    const activeSessions = formattedSessions.filter(s => new Date(s.updatedAt) > tenMinutesAgo)
    const recentHistory = formattedSessions.filter(s => {
      const date = new Date(s.updatedAt)
      return date <= tenMinutesAgo && date > oneDayAgo
    })

    // Calculer les stats des dernières 24h
    const last24h = formattedSessions.filter(s => new Date(s.updatedAt) > oneDayAgo)
    const uniqueViewers = new Set(last24h.map(s => s.userId || 'anonymous')).size
    const totalWatchTime = last24h.reduce((acc, s) => acc + (s.position || 0), 0)

    // Médias les plus regardés
    const watchCounts = new Map<string, { count: number; title: string; posterUrl: string | null }>()
    last24h.forEach(s => {
      const key = s.mediaType === 'episode' && s.seriesTitle ? s.seriesTitle : s.title
      const existing = watchCounts.get(key)
      if (existing) {
        existing.count++
      } else {
        watchCounts.set(key, { count: 1, title: key, posterUrl: s.posterUrl })
      }
    })

    const mostWatchedToday = Array.from(watchCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([_, data]) => ({
        mediaId: '',
        title: data.title,
        posterUrl: data.posterUrl,
        watchCount: data.count
      }))

    const response: WatchingStats = {
      activeSessions,
      recentHistory: recentHistory.slice(0, 20),
      stats: {
        totalWatches: last24h.length,
        uniqueViewers,
        totalWatchTimeMinutes: Math.round(totalWatchTime / 60),
        mostWatchedToday
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Erreur stats watching:', error)
    return NextResponse.json(
      { error: 'Erreur récupération statistiques de visionnage' },
      { status: 500 }
    )
  }
}
