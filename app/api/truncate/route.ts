/**
 * API Route: Vider la table media
 * POST /api/truncate
 * ⚠️ ATTENTION : Supprime TOUS les films de la base !
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('⚠️  TRUNCATE TABLE media demandé...')
    
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
