/**
 * API Route: Récupération des médias
 * GET /api/media - Liste tous les films
 */

import { NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: media, error } = await supabase
      .from('media')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Erreur Supabase:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des médias' },
        { status: 500 }
      )
    }
    
    console.log(`✅ API /media : ${media?.length || 0} films envoyés`)
    return NextResponse.json(media || [])
    
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

