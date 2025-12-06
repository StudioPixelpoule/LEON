/**
 * API: Mettre à jour les métadonnées d'une série depuis TMDB
 * POST /api/admin/update-series-metadata
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// Créer le client Supabase admin de façon lazy (au runtime, pas au build)
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant')
  }
  
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { seriesId, tmdbId } = body

    if (!seriesId || !tmdbId) {
      return NextResponse.json(
        { error: 'seriesId et tmdbId sont requis' },
        { status: 400 }
      )
    }

    if (!TMDB_API_KEY) {
      return NextResponse.json(
        { error: 'TMDB API key non configurée' },
        { status: 500 }
      )
    }

    console.log(`📺 Mise à jour série ${seriesId} avec TMDB ID ${tmdbId}`)

    // Récupérer les détails de la série depuis TMDB
    const tmdbUrl = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`
    const response = await fetch(tmdbUrl)

    if (!response.ok) {
      console.error(`❌ Erreur TMDB API: ${response.status}`)
      return NextResponse.json(
        { error: 'Série non trouvée sur TMDB' },
        { status: 404 }
      )
    }

    const tmdbData = await response.json()

    // Mettre à jour la série dans Supabase
    const updateData = {
      tmdb_id: tmdbId,
      title: tmdbData.name,
      original_title: tmdbData.original_name,
      overview: tmdbData.overview,
      poster_url: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : null,
      backdrop_url: tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}` : null,
      rating: tmdbData.vote_average,
      first_air_date: tmdbData.first_air_date,
      genres: tmdbData.genres?.map((g: { name: string }) => g.name) || [],
      updated_at: new Date().toISOString()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { error: updateError } = await supabaseAdmin
      .from('series')
      .update(updateData)
      .eq('id', seriesId)

    if (updateError) {
      console.error('❌ Erreur mise à jour Supabase:', updateError)
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour en base' },
        { status: 500 }
      )
    }

    console.log(`✅ Série "${tmdbData.name}" mise à jour avec succès`)

    return NextResponse.json({
      success: true,
      series: {
        id: seriesId,
        title: tmdbData.name,
        poster_url: updateData.poster_url
      }
    })

  } catch (error) {
    console.error('❌ Erreur update-series-metadata:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

