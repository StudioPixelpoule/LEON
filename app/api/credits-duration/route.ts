/**
 * API: Récupérer la durée du générique pour un épisode
 * GET /api/credits-duration?show_name=xxx&season=1
 * 
 * Logique de fallback:
 * 1. Chercher un override pour cette saison spécifique
 * 2. Sinon, utiliser la valeur par défaut de la série
 * 3. Sinon, retourner 45 secondes (défaut système)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const showName = searchParams.get('show_name')
    const season = searchParams.get('season')
    
    if (!showName) {
      return NextResponse.json({ 
        success: true, 
        credits_duration: 45,
        source: 'default'
      })
    }
    
    const seasonNumber = season ? parseInt(season) : null
    
    // Chercher d'abord un override pour cette saison
    if (seasonNumber !== null) {
      const { data: seasonSetting } = await supabase
        .from('series_credits_settings')
        .select('credits_duration, timing_source')
        .eq('show_name', showName)
        .eq('season_number', seasonNumber)
        .single()
      
      if (seasonSetting) {
        return NextResponse.json({
          success: true,
          credits_duration: seasonSetting.credits_duration,
          source: seasonSetting.timing_source,
          level: 'season'
        })
      }
    }
    
    // Sinon, chercher la valeur par défaut de la série
    const { data: defaultSetting } = await supabase
      .from('series_credits_settings')
      .select('credits_duration, timing_source')
      .eq('show_name', showName)
      .is('season_number', null)
      .single()
    
    if (defaultSetting) {
      return NextResponse.json({
        success: true,
        credits_duration: defaultSetting.credits_duration,
        source: defaultSetting.timing_source,
        level: 'series'
      })
    }
    
    // Aucun paramètre trouvé, retourner la valeur par défaut
    return NextResponse.json({
      success: true,
      credits_duration: 45,
      source: 'default',
      level: 'system'
    })
    
  } catch (error) {
    console.error('Erreur API credits-duration:', error)
    return NextResponse.json({
      success: true,
      credits_duration: 45,
      source: 'default',
      level: 'error'
    })
  }
}
