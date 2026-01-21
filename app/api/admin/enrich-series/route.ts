/**
 * API: Enrichir les séries avec les métadonnées TMDB (genres, etc.)
 * POST /api/admin/enrich-series
 * 
 * Récupère les genres depuis TMDB pour toutes les séries qui ont un tmdb_id
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// Mapping des IDs de genres TMDB vers noms lisibles
const GENRE_MAP: Record<number, string> = {
  10759: 'Action & Aventure',
  16: 'Animation',
  35: 'Comédie',
  80: 'Crime',
  99: 'Documentaire',
  18: 'Drame',
  10751: 'Familial',
  10762: 'Enfants',
  9648: 'Mystère',
  10763: 'Actualités',
  10764: 'Téléréalité',
  10765: 'Science-Fiction & Fantastique',
  10766: 'Soap',
  10767: 'Talk-show',
  10768: 'Guerre & Politique',
  37: 'Western',
  27: 'Horreur',
  53: 'Thriller',
  10749: 'Romance',
  878: 'Science-Fiction',
  14: 'Fantastique',
  12: 'Aventure',
  28: 'Action'
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error('Configuration Supabase manquante')
  }
  
  return createClient(url, key)
}

async function fetchTMDBGenres(tmdbId: number): Promise<string[]> {
  if (!TMDB_API_KEY) return []
  
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`,
      { next: { revalidate: 86400 } } // Cache 24h
    )
    
    if (!response.ok) return []
    
    const data = await response.json()
    
    // Convertir les IDs en noms
    const genres = (data.genres || []).map((g: { id: number; name: string }) => 
      GENRE_MAP[g.id] || g.name
    )
    
    return genres
  } catch (error) {
    console.error(`Erreur TMDB pour série ${tmdbId}:`, error)
    return []
  }
}

export async function POST() {
  try {
    if (!TMDB_API_KEY) {
      return NextResponse.json({ error: 'TMDB_API_KEY non configurée' }, { status: 500 })
    }
    
    const supabase = getSupabaseAdmin()
    
    // Récupérer toutes les séries avec un tmdb_id
    const { data: series, error } = await supabase
      .from('series')
      .select('id, title, tmdb_id, genres')
      .not('tmdb_id', 'is', null)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    const results = {
      total: series?.length || 0,
      enriched: 0,
      skipped: 0,
      errors: 0,
      details: [] as { title: string; genres: string[]; status: string }[]
    }
    
    // Enrichir chaque série
    for (const serie of series || []) {
      // Skip si déjà enrichi avec des genres
      if (serie.genres && serie.genres.length > 0) {
        results.skipped++
        results.details.push({ title: serie.title, genres: serie.genres, status: 'skipped' })
        continue
      }
      
      // Récupérer les genres depuis TMDB
      const genres = await fetchTMDBGenres(serie.tmdb_id)
      
      if (genres.length > 0) {
        // Mettre à jour en base
        const { error: updateError } = await supabase
          .from('series')
          .update({ genres })
          .eq('id', serie.id)
        
        if (updateError) {
          results.errors++
          results.details.push({ title: serie.title, genres: [], status: 'error' })
        } else {
          results.enriched++
          results.details.push({ title: serie.title, genres, status: 'enriched' })
          console.log(`✅ ${serie.title}: ${genres.join(', ')}`)
        }
      } else {
        results.skipped++
        results.details.push({ title: serie.title, genres: [], status: 'no-genres' })
      }
      
      // Petit délai pour ne pas surcharger TMDB
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    return NextResponse.json({
      success: true,
      message: `${results.enriched} séries enrichies, ${results.skipped} ignorées, ${results.errors} erreurs`,
      results
    })
    
  } catch (error) {
    console.error('Erreur enrichissement séries:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// GET pour vérifier le statut
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    
    const { data: series } = await supabase
      .from('series')
      .select('id, title, genres')
    
    const withGenres = series?.filter(s => s.genres && s.genres.length > 0).length || 0
    const withoutGenres = (series?.length || 0) - withGenres
    
    // Compter les genres uniques
    const allGenres = new Set<string>()
    series?.forEach(s => {
      (s.genres || []).forEach((g: string) => allGenres.add(g))
    })
    
    return NextResponse.json({
      success: true,
      stats: {
        total: series?.length || 0,
        withGenres,
        withoutGenres,
        uniqueGenres: Array.from(allGenres).sort()
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
