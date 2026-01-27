/**
 * API Route: Gestion des utilisateurs
 * GET - Liste tous les utilisateurs inscrits avec leurs statistiques de visionnage
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient, createSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface UserWithStats {
  id: string
  email: string
  display_name: string | null
  created_at: string
  last_sign_in_at: string | null
  email_confirmed: boolean
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
    const supabaseAdmin = createSupabaseAdmin()
    const supabase = createSupabaseClient()
    const { searchParams } = new URL(request.url)
    const includeInProgress = searchParams.get('includeInProgress') === 'true'

    // 1. Récupérer tous les utilisateurs depuis Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 100
    })

    if (authError) {
      console.error('[API] Erreur récupération utilisateurs auth:', authError)
      return NextResponse.json(
        { success: false, error: 'Erreur récupération utilisateurs', details: authError.message },
        { status: 500 }
      )
    }

    const authUsers = authData?.users || []
    console.log(`[API] ${authUsers.length} utilisateurs trouvés dans Supabase Auth`)

    // 2. Récupérer les positions de lecture pour tous les utilisateurs
    const { data: positions, error: posError } = await supabase
      .from('playback_positions')
      .select('user_id, media_id, media_type, position, duration, updated_at')
      .not('user_id', 'is', null)
      .order('updated_at', { ascending: false })

    if (posError) {
      console.error('[API] Erreur récupération positions:', posError)
    }

    // 3. Récupérer l'historique de visionnage
    const { data: history, error: histError } = await supabase
      .from('watch_history')
      .select('user_id, media_id, media_type, watch_duration, completed, created_at')
      .not('user_id', 'is', null)

    if (histError) {
      console.error('[API] Erreur récupération historique:', histError)
    }

    // 4. Pour chaque utilisateur auth, calculer les stats
    const users: UserWithStats[] = []

    for (const authUser of authUsers) {
      const userId = authUser.id
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

      // Extraire le display_name des métadonnées utilisateur
      const displayName = authUser.user_metadata?.display_name || 
                         authUser.user_metadata?.full_name || 
                         authUser.user_metadata?.name ||
                         null

      users.push({
        id: userId,
        email: authUser.email || 'Email non disponible',
        display_name: displayName,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at || null,
        email_confirmed: !!authUser.email_confirmed_at,
        in_progress_count: userPositions.length,
        completed_count: userHistory.filter(h => h.completed).length,
        total_watch_time_minutes: Math.round(totalWatchTime / 60),
        in_progress_items: inProgressItems
      })
    }

    // Trier par date d'inscription (plus récent en premier)
    users.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
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
