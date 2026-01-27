/**
 * API Route: Gestion des utilisateurs
 * GET - Liste tous les utilisateurs avec leurs statistiques de visionnage
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface UserWithStats {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  // Statistiques de visionnage
  in_progress_count: number
  completed_count: number
  total_watch_time_minutes: number
  in_progress_items: Array<{
    media_id: string
    title: string
    poster_url: string | null
    media_type: 'movie' | 'episode'
    position: number
    duration: number | null
    progress_percent: number
    updated_at: string
    // Pour les épisodes
    season_number?: number
    episode_number?: number
    series_title?: string
  }>
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()
    const { searchParams } = new URL(request.url)
    const includeInProgress = searchParams.get('includeInProgress') === 'true'

    // 1. Récupérer tous les utilisateurs depuis auth.users (via admin API)
    // Note: On utilise une approche différente car on n'a pas accès direct à auth.users
    // On récupère les utilisateurs depuis les positions de lecture (qui ont un user_id)
    
    // Récupérer les positions de lecture avec user_id
    const { data: positions, error: posError } = await supabase
      .from('playback_positions')
      .select('user_id, media_id, media_type, position, duration, updated_at')
      .not('user_id', 'is', null)
      .order('updated_at', { ascending: false })

    if (posError) {
      console.error('[API] Erreur récupération positions:', posError)
    }

    // Récupérer l'historique de visionnage
    const { data: history, error: histError } = await supabase
      .from('watch_history')
      .select('user_id, media_id, media_type, watch_duration, completed, created_at')
      .not('user_id', 'is', null)

    if (histError) {
      console.error('[API] Erreur récupération historique:', histError)
    }

    // Construire la liste des utilisateurs uniques
    const userIds = new Set<string>()
    positions?.forEach(p => p.user_id && userIds.add(p.user_id))
    history?.forEach(h => h.user_id && userIds.add(h.user_id))

    // Pour chaque utilisateur, calculer les stats
    const users: UserWithStats[] = []

    for (const userId of userIds) {
      const userPositions = positions?.filter(p => p.user_id === userId) || []
      const userHistory = history?.filter(h => h.user_id === userId) || []

      // Récupérer les infos des médias en cours
      let inProgressItems: UserWithStats['in_progress_items'] = []
      
      if (includeInProgress && userPositions.length > 0) {
        const movieIds = userPositions.filter(p => p.media_type === 'movie' || !p.media_type).map(p => p.media_id)
        const episodeIds = userPositions.filter(p => p.media_type === 'episode').map(p => p.media_id)

        // Récupérer les films
        if (movieIds.length > 0) {
          const { data: movies } = await supabase
            .from('media')
            .select('id, title, poster_url')
            .in('id', movieIds)

          movies?.forEach(movie => {
            const pos = userPositions.find(p => p.media_id === movie.id)
            if (pos) {
              const progressPercent = pos.duration && pos.duration > 0 
                ? Math.round((pos.position / pos.duration) * 100)
                : 0
              inProgressItems.push({
                media_id: movie.id,
                title: movie.title,
                poster_url: movie.poster_url,
                media_type: 'movie',
                position: pos.position,
                duration: pos.duration,
                progress_percent: Math.min(progressPercent, 99),
                updated_at: pos.updated_at
              })
            }
          })
        }

        // Récupérer les épisodes
        if (episodeIds.length > 0) {
          const { data: episodes } = await supabase
            .from('episodes')
            .select(`
              id, title, season_number, episode_number,
              series:series_id (id, title, poster_url)
            `)
            .in('id', episodeIds)

          episodes?.forEach(ep => {
            const pos = userPositions.find(p => p.media_id === ep.id)
            if (pos) {
              const progressPercent = pos.duration && pos.duration > 0 
                ? Math.round((pos.position / pos.duration) * 100)
                : 0
              inProgressItems.push({
                media_id: ep.id,
                title: ep.title,
                poster_url: (ep.series as any)?.poster_url || null,
                media_type: 'episode',
                position: pos.position,
                duration: pos.duration,
                progress_percent: Math.min(progressPercent, 99),
                updated_at: pos.updated_at,
                season_number: ep.season_number,
                episode_number: ep.episode_number,
                series_title: (ep.series as any)?.title
              })
            }
          })
        }

        // Trier par date de mise à jour
        inProgressItems.sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
      }

      // Calculer le temps total de visionnage
      const totalWatchTime = userHistory.reduce((acc, h) => acc + (h.watch_duration || 0), 0)

      users.push({
        id: userId,
        email: `Utilisateur ${userId.slice(0, 8)}...`, // On n'a pas accès aux emails directement
        created_at: userPositions[0]?.updated_at || userHistory[0]?.created_at || new Date().toISOString(),
        last_sign_in_at: userPositions[0]?.updated_at || null,
        in_progress_count: userPositions.length,
        completed_count: userHistory.filter(h => h.completed).length,
        total_watch_time_minutes: Math.round(totalWatchTime / 60),
        in_progress_items: inProgressItems
      })
    }

    // Trier par activité récente
    users.sort((a, b) => {
      const dateA = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0
      const dateB = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0
      return dateB - dateA
    })

    return NextResponse.json({
      success: true,
      users,
      count: users.length
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[API] Erreur liste utilisateurs:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur', details: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Supprimer une position de lecture pour un utilisateur (admin)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const mediaId = searchParams.get('mediaId')

    if (!userId || !mediaId) {
      return NextResponse.json(
        { error: 'userId et mediaId requis' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseClient()

    const { error, count } = await supabase
      .from('playback_positions')
      .delete()
      .eq('user_id', userId)
      .eq('media_id', mediaId)

    if (error) {
      throw error
    }

    console.log(`[API] Position admin supprimée: userId=${userId}, mediaId=${mediaId}`)
    return NextResponse.json({ success: true, deleted: count })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[API] Erreur suppression position admin:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: errorMessage },
      { status: 500 }
    )
  }
}
