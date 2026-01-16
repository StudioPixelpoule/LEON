/**
 * API Route: Historique complet de visionnage
 * GET /api/stats/history - Historique par utilisateur avec pagination
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface HistoryEntry {
  id: string
  userId: string | null
  userName: string
  userEmail: string | null
  mediaId: string
  title: string
  posterUrl: string | null
  year: number | null
  watchedAt: string
  watchDuration: number | null
  completed: boolean
  progress: number
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
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const userId = searchParams.get('userId')
    const days = parseInt(searchParams.get('days') || '30')
    
    const offset = (page - 1) * limit
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    
    // Construire la requête de base
    let historyQuery = supabase
      .from('watch_history')
      .select('*', { count: 'exact' })
      .gt('watched_at', cutoffDate)
      .order('watched_at', { ascending: false })
    
    // Filtrer par utilisateur si spécifié
    if (userId && userId !== 'all') {
      historyQuery = historyQuery.eq('user_id', userId)
    }
    
    // Pagination
    historyQuery = historyQuery.range(offset, offset + limit - 1)
    
    const { data: historyData, error: historyError, count } = await historyQuery

    if (historyError) {
      console.error('Erreur historique:', historyError)
      return NextResponse.json({ error: 'Erreur récupération historique' }, { status: 500 })
    }

    // Récupérer tous les user_ids uniques
    const allUserIds = [...new Set(historyData?.filter(h => h.user_id).map(h => h.user_id) || [])]
    const userMap = new Map<string, { name: string; email: string }>()
    
    if (allUserIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', allUserIds)
      
      if (profilesData) {
        profilesData.forEach(p => {
          userMap.set(p.id, { 
            name: p.display_name || p.username?.split('@')[0] || 'Utilisateur',
            email: p.username || ''
          })
        })
      }
    }

    // Récupérer les infos médias
    const mediaIds = [...new Set(historyData?.map(h => h.media_id) || [])]
    const { data: mediaData } = await supabase
      .from('media')
      .select('id, title, poster_url, year, duration')
      .in('id', mediaIds.length > 0 ? mediaIds : ['none'])

    const mediaMap = new Map(mediaData?.map(m => [m.id, m]) || [])

    // Formater l'historique
    const history: HistoryEntry[] = (historyData || []).map(entry => {
      const media = mediaMap.get(entry.media_id)
      const userInfo = entry.user_id ? userMap.get(entry.user_id) : null
      const mediaDuration = media?.duration ? media.duration * 60 : null // Convertir minutes en secondes
      
      return {
        id: entry.id,
        userId: entry.user_id,
        userName: userInfo?.name || 'Anonyme',
        userEmail: userInfo?.email || null,
        mediaId: entry.media_id,
        title: media?.title || 'Film inconnu',
        posterUrl: media?.poster_url || null,
        year: media?.year || null,
        watchedAt: entry.watched_at,
        watchDuration: entry.watch_duration,
        completed: entry.completed,
        progress: mediaDuration && entry.watch_duration 
          ? Math.min(100, Math.round((entry.watch_duration / mediaDuration) * 100)) 
          : (entry.completed ? 100 : 0)
      }
    })

    // Récupérer les stats par utilisateur (pour les 30 derniers jours)
    const { data: allHistoryForStats } = await supabase
      .from('watch_history')
      .select('user_id, watch_duration, completed, watched_at')
      .gt('watched_at', cutoffDate)

    // Calculer les stats par utilisateur
    const userStatsMap = new Map<string, {
      totalWatches: number
      totalWatchTime: number
      completedCount: number
      lastActivity: string
    }>()

    allHistoryForStats?.forEach(entry => {
      const id = entry.user_id || 'anonymous'
      const existing = userStatsMap.get(id) || {
        totalWatches: 0,
        totalWatchTime: 0,
        completedCount: 0,
        lastActivity: entry.watched_at
      }
      
      existing.totalWatches++
      existing.totalWatchTime += entry.watch_duration || 0
      if (entry.completed) existing.completedCount++
      if (entry.watched_at > existing.lastActivity) {
        existing.lastActivity = entry.watched_at
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
