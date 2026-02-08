/**
 * API Route: Demandes de films/séries
 * POST - Créer des demandes (utilisateur authentifié)
 * GET - Lister les demandes (admin: toutes, user: les siennes)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { createSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface RequestItem {
  tmdb_id: number
  media_type: 'movie' | 'tv'
  title: string
  year: number | null
  poster_url: string | null
}

interface RequestBody {
  items: RequestItem[]
  comment?: string
}

/**
 * POST - Créer une ou plusieurs demandes
 */
export async function POST(request: NextRequest) {
  const { user: authUser, error: authError } = await requireAuth(request)
  if (authError || !authUser) return authErrorResponse(authError || 'Non authentifié')

  try {
    const body: RequestBody = await request.json()
    const { items, comment } = body

    if ((!items || items.length === 0) && (!comment || comment.trim() === '')) {
      return NextResponse.json(
        { error: 'Au moins une sélection ou un commentaire requis' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()
    const rows: Record<string, unknown>[] = []

    // Une ligne par item TMDB sélectionné
    if (items && items.length > 0) {
      for (const item of items) {
        if (!item.title || !item.tmdb_id) continue
        rows.push({
          user_id: authUser.id,
          tmdb_id: item.tmdb_id,
          media_type: item.media_type,
          title: item.title,
          year: item.year,
          poster_url: item.poster_url,
          status: 'pending'
        })
      }
    }

    // Ligne supplémentaire pour le commentaire libre
    if (comment && comment.trim() !== '') {
      rows.push({
        user_id: authUser.id,
        tmdb_id: null,
        media_type: null,
        title: comment.trim(),
        year: null,
        poster_url: null,
        comment: comment.trim(),
        status: 'pending'
      })
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Aucune demande valide' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('media_requests')
      .insert(rows)
      .select()

    if (error) {
      console.error('[REQUESTS] Erreur insertion:', error.message)
      return NextResponse.json(
        { error: 'Erreur base de données', details: error.message },
        { status: 500 }
      )
    }

    console.log(`[REQUESTS] ${rows.length} demande(s) créée(s) par ${authUser.email}`)

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      data
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[REQUESTS] Erreur POST:', msg)
    return NextResponse.json({ error: 'Erreur serveur', details: msg }, { status: 500 })
  }
}

/**
 * GET - Lister les demandes
 * Admin : toutes les demandes (avec info utilisateur)
 * User : ses propres demandes uniquement
 */
export async function GET(request: NextRequest) {
  // Essayer d'abord en tant qu'admin
  const { user: adminUser } = await requireAdmin(request)
  const isAdmin = !!adminUser

  // Si pas admin, vérifier l'auth simple
  if (!isAdmin) {
    const { user: authUser, error: authError } = await requireAuth(request)
    if (authError || !authUser) return authErrorResponse(authError || 'Non authentifié')

    try {
      const supabase = createSupabaseAdmin()
      const status = request.nextUrl.searchParams.get('status')

      let query = supabase
        .from('media_requests')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      const { data, error } = await query

      if (error) {
        console.error('[REQUESTS] Erreur GET user:', error.message)
        return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
      }

      return NextResponse.json({ success: true, requests: data || [] })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue'
      console.error('[REQUESTS] Erreur GET:', msg)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }

  // Admin : toutes les demandes
  try {
    const supabase = createSupabaseAdmin()
    const status = request.nextUrl.searchParams.get('status')

    let query = supabase
      .from('media_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('[REQUESTS] Erreur GET admin:', error.message)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    // Récupérer les emails des utilisateurs via auth admin
    const userIds = [...new Set((data || []).map(r => r.user_id))]
    const userMap = new Map<string, string>()

    for (const uid of userIds) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(uid)
        if (userData?.user?.email) {
          userMap.set(uid, userData.user.user_metadata?.display_name || userData.user.email.split('@')[0])
        }
      } catch {
        // Ignorer les erreurs de récupération utilisateur
      }
    }

    const requestsWithUsers = (data || []).map(r => ({
      ...r,
      user_name: userMap.get(r.user_id) || 'Inconnu'
    }))

    return NextResponse.json({ success: true, requests: requestsWithUsers })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[REQUESTS] Erreur GET admin:', msg)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
