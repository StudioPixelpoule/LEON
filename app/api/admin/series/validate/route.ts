/**
 * API Admin: Valider une série avec TMDB ou jaquette personnalisée
 * POST /api/admin/series/validate
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const TMDB_API_KEY = process.env.TMDB_API_KEY

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { seriesId, tmdbId, customPosterUrl, correctedTitle } = body
    
    if (!seriesId) {
      return NextResponse.json(
        { error: 'seriesId requis' },
        { status: 400 }
      )
    }
    
    // Cas 1: Validation avec TMDB ID
    if (tmdbId) {
      console.log(`📥 Récupération métadonnées TMDB série ID: ${tmdbId}`)
      
      const tmdbUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`
      const response = await fetch(tmdbUrl)
      const tmdbData = await response.json()
      
      if (!response.ok) {
        return NextResponse.json(
          { error: 'Série introuvable sur TMDB' },
          { status: 404 }
        )
      }
      
      console.log(`✅ Métadonnées récupérées: ${tmdbData.name}`)
      
      // Mettre à jour la série
      const { error: updateError } = await supabase
        .from('series')
        .update({
          tmdb_id: tmdbData.id,
          title: tmdbData.name,
          original_title: tmdbData.original_name,
          overview: tmdbData.overview,
          poster_url: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : null,
          backdrop_url: tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}` : null,
          rating: tmdbData.vote_average,
          first_air_date: tmdbData.first_air_date,
          genres: tmdbData.genres?.map((g: any) => g.name) || [],
          status: tmdbData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', seriesId)
      
      if (updateError) {
        console.error('❌ Erreur mise à jour série:', updateError)
        return NextResponse.json(
          { error: 'Erreur lors de la mise à jour' },
          { status: 500 }
        )
      }
      
      console.log(`✅ Série validée: ${seriesId}`)
      
      return NextResponse.json({
        success: true,
        message: 'Série validée avec succès'
      })
    }
    
    // Cas 2: Validation avec jaquette personnalisée
    if (customPosterUrl) {
      const updateData: any = {
        poster_url: customPosterUrl,
        updated_at: new Date().toISOString()
      }
      
      if (correctedTitle) {
        updateData.title = correctedTitle
      }
      
      const { error: updateError } = await supabase
        .from('series')
        .update(updateData)
        .eq('id', seriesId)
      
      if (updateError) {
        console.error('❌ Erreur mise à jour série:', updateError)
        return NextResponse.json(
          { error: 'Erreur lors de la mise à jour' },
          { status: 500 }
        )
      }
      
      console.log(`✅ Série validée avec jaquette personnalisée: ${seriesId}`)
      
      return NextResponse.json({
        success: true,
        message: 'Série validée avec jaquette personnalisée'
      })
    }
    
    return NextResponse.json(
      { error: 'tmdbId ou customPosterUrl requis' },
      { status: 400 }
    )
    
  } catch (error) {
    console.error('❌ Erreur API series validate:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}




