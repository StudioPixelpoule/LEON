/**
 * API Route: Gestion des utilisateurs
 * GET - Liste tous les utilisateurs inscrits avec leurs statistiques de visionnage
 * DELETE - Supprimer une position de lecture pour un utilisateur
 * ⚠️ Route admin - Authentification requise
 *
 * Performance : toutes les données sont chargées en batch (5 requêtes max),
 * puis assemblées en mémoire. Aucune requête N+1.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { createSupabaseClient, createSupabaseAdmin } from '@/lib/supabase'
import type { AdminUser, InProgressItem } from '@/types/admin'

export const dynamic = 'force-dynamic'

// Regex UUID v4 pour la validation des paramètres
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Type explicite pour la relation série sur un épisode Supabase
interface EpisodeSeries {
  id: string
  title: string
  poster_url: string | null
}

/**
 * Récupère TOUS les utilisateurs auth en paginant automatiquement.
 * Supabase Auth retourne max 100 par page.
 */
async function fetchAllAuthUsers(supabaseAdmin: ReturnType<typeof createSupabaseAdmin>) {
  const allUsers: Array<{
    id: string
    email?: string
    created_at: string
    last_sign_in_at?: string
    email_confirmed_at?: string
    user_metadata: Record<string, unknown>
  }> = []
  let page = 1
  const perPage = 100

  // Boucler jusqu'à récupérer tous les utilisateurs
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })

    if (error) {
      throw new Error(`Erreur récupération utilisateurs auth page ${page}: ${error.message}`)
    }

    const users = data?.users || []
    allUsers.push(...users)

    // Si on reçoit moins que perPage, c'est la dernière page
    if (users.length < perPage) break
    page++
  }

  return allUsers
}

export async function GET(request: NextRequest) {
  // Vérification admin OBLIGATOIRE
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    console.warn('[USERS] Tentative GET non autorisée')
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

  try {
    const supabaseAdmin = createSupabaseAdmin()
    const supabase = createSupabaseClient()
    const { searchParams } = new URL(request.url)
    const includeInProgress = searchParams.get('includeInProgress') === 'true'

    // 1. Charger TOUS les utilisateurs auth (pagination automatique)
    const authUsers = await fetchAllAuthUsers(supabaseAdmin)
    console.log(`[USERS] ${authUsers.length} utilisateurs récupérés depuis Supabase Auth`)

    // 2. Charger TOUTES les positions en une seule requête
    const { data: allPositions, error: posError } = await supabase
      .from('playback_positions')
      .select('user_id, media_id, media_type, position, duration, updated_at')
      .not('user_id', 'is', null)
      .order('updated_at', { ascending: false })

    if (posError) {
      console.error('[USERS] Erreur récupération positions:', posError)
    }

    // 3. Charger TOUT l'historique en une seule requête
    const { data: allHistory, error: histError } = await supabase
      .from('watch_history')
      .select('user_id, watch_duration, completed')
      .not('user_id', 'is', null)

    if (histError) {
      console.error('[USERS] Erreur récupération historique:', histError)
    }

    // 4. Charger TOUS les médias référencés en batch (films + épisodes)
    let movieMap = new Map<string, { id: string; title: string; poster_url: string | null }>()
    let episodeMap = new Map<string, {
      id: string; title: string; season_number: number; episode_number: number
      series: EpisodeSeries | null
    }>()

    if (includeInProgress && allPositions && allPositions.length > 0) {
      const allMovieIds = [...new Set(
        allPositions
          .filter(p => p.media_type === 'movie' || !p.media_type)
          .map(p => p.media_id)
      )]
      const allEpisodeIds = [...new Set(
        allPositions
          .filter(p => p.media_type === 'episode')
          .map(p => p.media_id)
      )]

      // Requêtes en parallèle pour films et épisodes
      const [moviesResult, episodesResult] = await Promise.all([
        allMovieIds.length > 0
          ? supabase.from('media').select('id, title, poster_url').in('id', allMovieIds)
          : Promise.resolve({ data: [] as Array<{ id: string; title: string; poster_url: string | null }>, error: null }),
        allEpisodeIds.length > 0
          ? supabase.from('episodes').select(`
              id, title, season_number, episode_number,
              series:series_id (id, title, poster_url)
            `).in('id', allEpisodeIds)
          : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null })
      ])

      // Construire les Maps pour un accès O(1)
      moviesResult.data?.forEach(m => {
        movieMap.set(m.id, m)
      })

      episodesResult.data?.forEach(ep => {
        // Supabase retourne la relation comme un objet ou un tableau
        const rawSeries = ep.series
        let series: EpisodeSeries | null = null
        if (rawSeries && typeof rawSeries === 'object' && !Array.isArray(rawSeries)) {
          const s = rawSeries as Record<string, unknown>
          series = {
            id: s.id as string,
            title: s.title as string,
            poster_url: (s.poster_url as string | null) || null
          }
        } else if (Array.isArray(rawSeries) && rawSeries.length > 0) {
          const s = rawSeries[0] as Record<string, unknown>
          series = {
            id: s.id as string,
            title: s.title as string,
            poster_url: (s.poster_url as string | null) || null
          }
        }

        episodeMap.set(ep.id as string, {
          id: ep.id as string,
          title: ep.title as string,
          season_number: ep.season_number as number,
          episode_number: ep.episode_number as number,
          series
        })
      })
    }

    // 5. Assembler en mémoire — aucune requête supplémentaire
    const positions = allPositions || []
    const historyList = allHistory || []

    // Indexer positions et historique par user_id pour accès O(1)
    const positionsByUser = new Map<string, typeof positions>()
    for (const p of positions) {
      if (!p.user_id) continue
      const list = positionsByUser.get(p.user_id) || []
      list.push(p)
      positionsByUser.set(p.user_id, list)
    }

    const historyByUser = new Map<string, typeof historyList>()
    for (const h of historyList) {
      if (!h.user_id) continue
      const list = historyByUser.get(h.user_id) || []
      list.push(h)
      historyByUser.set(h.user_id, list)
    }

    const users: AdminUser[] = authUsers.map(authUser => {
      const userId = authUser.id
      const userPositions = positionsByUser.get(userId) || []
      const userHistory = historyByUser.get(userId) || []

      // Construire les items en cours (pur mapping, zero I/O)
      let inProgressItems: InProgressItem[] = []

      if (includeInProgress && userPositions.length > 0) {
        for (const pos of userPositions) {
          const isMovie = pos.media_type === 'movie' || !pos.media_type
          const progressPercent = pos.duration && pos.duration > 0
            ? Math.round((pos.position / pos.duration) * 100)
            : 0

          if (isMovie) {
            const movie = movieMap.get(pos.media_id)
            if (movie) {
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
          } else {
            const ep = episodeMap.get(pos.media_id)
            if (ep) {
              inProgressItems.push({
                media_id: ep.id,
                title: ep.title,
                poster_url: ep.series?.poster_url || null,
                media_type: 'episode',
                position: pos.position,
                duration: pos.duration,
                progress_percent: Math.min(progressPercent, 99),
                updated_at: pos.updated_at,
                season_number: ep.season_number,
                episode_number: ep.episode_number,
                series_title: ep.series?.title
              })
            }
          }
        }

        // Trier par date de mise à jour (plus récent en premier)
        inProgressItems.sort((a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
      }

      // Temps total de visionnage (en minutes)
      const totalWatchTime = userHistory.reduce((acc, h) => acc + (h.watch_duration || 0), 0)

      // Extraire le display_name des métadonnées utilisateur
      const displayName = (authUser.user_metadata?.display_name ||
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        null) as string | null

      return {
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
      }
    })

    // Trier par date d'inscription (plus récent en premier)
    users.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return NextResponse.json({
      success: true,
      users,
      count: users.length
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[USERS] Erreur liste utilisateurs:', error)
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
  // Vérification admin OBLIGATOIRE
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    console.warn('[USERS] Tentative DELETE non autorisée')
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

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

    // Validation format UUID
    if (!UUID_REGEX.test(userId) || !UUID_REGEX.test(mediaId)) {
      return NextResponse.json(
        { error: 'Format userId ou mediaId invalide (UUID attendu)' },
        { status: 400 }
      )
    }

    console.log(`[USERS] DELETE position par admin: ${user.email}`, { userId, mediaId })

    const supabase = createSupabaseClient()

    const { error, count } = await supabase
      .from('playback_positions')
      .delete()
      .eq('user_id', userId)
      .eq('media_id', mediaId)

    if (error) {
      throw error
    }

    console.log(`[USERS] Position admin supprimée: userId=${userId}, mediaId=${mediaId}`)
    return NextResponse.json({ success: true, deleted: count })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[USERS] Erreur suppression position admin:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: errorMessage },
      { status: 500 }
    )
  }
}
