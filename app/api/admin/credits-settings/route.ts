/**
 * API: Gestion des paramètres de générique par série/saison
 * GET /api/admin/credits-settings - Liste tous les paramètres
 * GET /api/admin/credits-settings?show_name=xxx - Paramètres d'une série
 * POST /api/admin/credits-settings - Créer/Mettre à jour un paramètre
 * DELETE /api/admin/credits-settings - Supprimer un paramètre
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant')
  }
  
  return createClient(url, key)
}

// GET - Liste des paramètres
export async function GET(request: NextRequest) {
  // Vérification admin OBLIGATOIRE
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

  try {
    const { searchParams } = new URL(request.url)
    const showName = searchParams.get('show_name')
    
    const supabase = getSupabaseAdmin()
    
    let query = supabase
      .from('series_credits_settings')
      .select('*')
      .order('show_name')
      .order('season_number', { nullsFirst: true })
    
    if (showName) {
      query = query.eq('show_name', showName)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Erreur récupération credits settings:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      settings: data || []
    })
    
  } catch (error) {
    console.error('Erreur API credits-settings GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Créer ou mettre à jour
export async function POST(request: NextRequest) {
  // Vérification admin OBLIGATOIRE
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

  try {
    const body = await request.json()
    const { show_name, season_number, credits_duration, timing_source } = body
    
    if (!show_name) {
      return NextResponse.json({ error: 'show_name requis' }, { status: 400 })
    }
    
    if (credits_duration === undefined || credits_duration < 0) {
      return NextResponse.json({ error: 'credits_duration requis (>= 0)' }, { status: 400 })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Upsert (insert ou update si existe)
    const { data, error } = await supabase
      .from('series_credits_settings')
      .upsert({
        show_name,
        season_number: season_number ?? null, // NULL = valeur par défaut série
        credits_duration,
        timing_source: timing_source || 'manual',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'show_name,season_number'
      })
      .select()
      .single()
    
    if (error) {
      console.error('Erreur upsert credits settings:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log(`✅ Credits settings mis à jour: ${show_name} S${season_number ?? 'défaut'} = ${credits_duration}s`)
    
    return NextResponse.json({
      success: true,
      setting: data
    })
    
  } catch (error) {
    console.error('Erreur API credits-settings POST:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Supprimer un paramètre
export async function DELETE(request: NextRequest) {
  // Vérification admin OBLIGATOIRE
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

  try {
    const { searchParams } = new URL(request.url)
    const showName = searchParams.get('show_name')
    const seasonNumber = searchParams.get('season_number')
    
    if (!showName) {
      return NextResponse.json({ error: 'show_name requis' }, { status: 400 })
    }
    
    const supabase = getSupabaseAdmin()
    
    let query = supabase
      .from('series_credits_settings')
      .delete()
      .eq('show_name', showName)
    
    // Si season_number est spécifié, supprimer cette saison spécifique
    // Sinon, supprimer la valeur par défaut (season_number IS NULL)
    if (seasonNumber !== null && seasonNumber !== undefined && seasonNumber !== '') {
      query = query.eq('season_number', parseInt(seasonNumber))
    } else {
      query = query.is('season_number', null)
    }
    
    const { error } = await query
    
    if (error) {
      console.error('Erreur suppression credits settings:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log(`🗑️ Credits settings supprimé: ${showName} S${seasonNumber ?? 'défaut'}`)
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Erreur API credits-settings DELETE:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
