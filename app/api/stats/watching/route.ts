/**
 * API Route: Statistiques de visionnage en temps réel
 * GET /api/stats/watching - Qui regarde quoi en ce moment
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface ActiveSession {
  id: string
  userId: string | null
  userName: string
  mediaId: string
  title: string
  posterUrl: string | null
  year: number | null
  position: number
  duration: number | null
  progress: number
  updatedAt: string
  isActive: boolean
}

interface WatchHistoryEntry {
  id: string
  userId: string | null
  userName: string
  mediaId: string
  title: string
  posterUrl: string | null
  year: number | null
  watchedAt: string
  watchDuration: number | null
  completed: boolean
}

interface WatchingStats {
  activeSessions: ActiveSession[]
  recentHistory: WatchHistoryEntry[]
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
    // Récupérer les sessions actives (mise à jour dans les 10 dernières minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    
    const { data: activeSessions, error: activeError } = await supabase
      .from('playback_positions')
      .select(`
        id,
        user_id,
        media_id,
        position,
        duration,
        updated_at
      `)
      .gt('updated_at', tenMinutesAgo)
      .gt('position', 30)
      .order('updated_at', { ascending: false })

    if (activeError) {
      console.error('Erreur sessions actives:', activeError)
    }

    // Récupérer les infos des médias pour les sessions actives
    const mediaIds = activeSessions?.map(s => s.media_id) || []
    const { data: mediaData } = await supabase
      .from('media')
      .select('id, title, poster_url, year')
      .in('id', mediaIds.length > 0 ? mediaIds : ['none'])

    const mediaMap = new Map(mediaData?.map(m => [m.id, m]) || [])

    // Récupérer les infos utilisateurs
    const userIds = activeSessions?.filter(s => s.user_id).map(s => s.user_id) || []
    let userMap = new Map<string, string>()
    
    if (userIds.length > 0) {
      const { data: userData } = await supabase
        .from('auth.users')
        .select('id, email, raw_user_meta_data')
      
      if (userData) {
        userData.forEach(u => {
          const name = u.raw_user_meta_data?.name || u.email || 'Utilisateur'
          userMap.set(u.id, name)
        })
      }
    }

    // Formater les sessions actives
    const formattedSessions: ActiveSession[] = (activeSessions || []).map(session => {
      const media = mediaMap.get(session.media_id)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      const isActive = new Date(session.updated_at) > fiveMinutesAgo
      
      return {
        id: session.id,
        userId: session.user_id,
        userName: session.user_id ? (userMap.get(session.user_id) || 'Utilisateur') : 'Anonyme',
        mediaId: session.media_id,
        title: media?.title || 'Film inconnu',
        posterUrl: media?.poster_url || null,
        year: media?.year || null,
        position: session.position,
        duration: session.duration,
        progress: session.duration ? Math.round((session.position / session.duration) * 100) : 0,
        updatedAt: session.updated_at,
        isActive
      }
    })

    // Récupérer l'historique récent (dernières 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: historyData, error: historyError } = await supabase
      .from('watch_history')
      .select('*')
      .gt('watched_at', oneDayAgo)
      .order('watched_at', { ascending: false })
      .limit(50)

    if (historyError) {
      console.error('Erreur historique:', historyError)
    }

    // Récupérer les infos médias pour l'historique
    const historyMediaIds = historyData?.map(h => h.media_id) || []
    const { data: historyMediaData } = await supabase
      .from('media')
      .select('id, title, poster_url, year')
      .in('id', historyMediaIds.length > 0 ? historyMediaIds : ['none'])

    const historyMediaMap = new Map(historyMediaData?.map(m => [m.id, m]) || [])

    // Formater l'historique
    const formattedHistory: WatchHistoryEntry[] = (historyData || []).map(entry => {
      const media = historyMediaMap.get(entry.media_id)
      return {
        id: entry.id,
        userId: entry.user_id,
        userName: entry.user_id ? (userMap.get(entry.user_id) || 'Utilisateur') : 'Anonyme',
        mediaId: entry.media_id,
        title: media?.title || 'Film inconnu',
        posterUrl: media?.poster_url || null,
        year: media?.year || null,
        watchedAt: entry.watched_at,
        watchDuration: entry.watch_duration,
        completed: entry.completed
      }
    })

    // Calculer les stats
    const uniqueViewers = new Set(historyData?.map(h => h.user_id || 'anonymous')).size
    const totalWatchTime = historyData?.reduce((acc, h) => acc + (h.watch_duration || 0), 0) || 0

    // Films les plus regardés aujourd'hui
    const watchCounts = new Map<string, number>()
    historyData?.forEach(h => {
      watchCounts.set(h.media_id, (watchCounts.get(h.media_id) || 0) + 1)
    })

    const mostWatchedToday = Array.from(watchCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([mediaId, count]) => {
        const media = historyMediaMap.get(mediaId)
        return {
          mediaId,
          title: media?.title || 'Film inconnu',
          posterUrl: media?.poster_url || null,
          watchCount: count
        }
      })

    const response: WatchingStats = {
      activeSessions: formattedSessions,
      recentHistory: formattedHistory.slice(0, 20),
      stats: {
        totalWatches: historyData?.length || 0,
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

