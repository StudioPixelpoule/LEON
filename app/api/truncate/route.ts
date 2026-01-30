/**
 * API Route: Vider la table media
 * POST /api/truncate
 * ⚠️ ATTENTION : Supprime TOUS les films de la base !
 * ⚠️ Route CRITIQUE - Authentification admin requise
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  // Vérification admin OBLIGATOIRE
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    console.warn('[TRUNCATE] Tentative non autorisée')
    return authErrorResponse(authError || 'Accès refusé', 403)
  }
  
  try {
    console.log(`[TRUNCATE] ⚠️ Demandé par admin: ${user.email}`)
    
    // Vider la table media avec une requête SQL brute
    const { error } = await supabase.rpc('truncate_media_table')
    
    if (error) {
      console.error('❌ Erreur truncate:', error)
      // Si la fonction n'existe pas, essayer delete simple
      console.log('Tentative avec DELETE simple...')
      const { error: deleteError } = await supabase
        .from('media')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000')
      
      if (deleteError) {
        return NextResponse.json(
          { error: 'Erreur lors du vidage de la table. Veuillez utiliser Supabase Dashboard pour exécuter: TRUNCATE TABLE media RESTART IDENTITY CASCADE;' },
          { status: 500 }
        )
      }
    }
    
    console.log('✅ Table media vidée !')
    
    return NextResponse.json({
      success: true,
      message: 'Table media vidée avec succès. Vous pouvez maintenant relancer le scan.'
    })
    
  } catch (error) {
    console.error('❌ Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
