/**
 * API Route: Gestion individuelle d'une demande média
 * PATCH - Mettre à jour le statut (admin)
 * DELETE - Supprimer une demande (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { createSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * PATCH - Mettre à jour le statut d'une demande
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user: authUser, error: authError } = await requireAdmin(request)
  if (authError || !authUser) return authErrorResponse(authError || 'Non autorisé', 403)

  try {
    const { id } = params
    const body = await request.json()
    const { status } = body

    if (!status || !['pending', 'added', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Status invalide (pending, added, rejected)' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase
      .from('media_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[REQUESTS] Erreur PATCH:', error.message)
      return NextResponse.json(
        { error: 'Erreur base de données', details: error.message },
        { status: 500 }
      )
    }

    console.log(`[REQUESTS] Demande ${id} → ${status} (par ${authUser.email})`)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[REQUESTS] Erreur PATCH:', msg)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE - Supprimer une demande
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user: authUser, error: authError } = await requireAdmin(request)
  if (authError || !authUser) return authErrorResponse(authError || 'Non autorisé', 403)

  try {
    const { id } = params
    const supabase = createSupabaseAdmin()

    const { error } = await supabase
      .from('media_requests')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[REQUESTS] Erreur DELETE:', error.message)
      return NextResponse.json(
        { error: 'Erreur base de données', details: error.message },
        { status: 500 }
      )
    }

    console.log(`[REQUESTS] Demande ${id} supprimée (par ${authUser.email})`)

    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[REQUESTS] Erreur DELETE:', msg)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
