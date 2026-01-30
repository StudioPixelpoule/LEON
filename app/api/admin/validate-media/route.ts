/**
 * API Admin: Validation manuelle d'un film
 * POST /api/admin/validate-media
 * Body: {
 *   mediaId: string,
 *   tmdbId?: number,
 *   customPosterUrl?: string,
 *   correctedTitle?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { getMovieDetails, getTMDBImageUrl, getYearFromDate } from '@/lib/tmdb'

export async function POST(request: NextRequest) {
  // Vérification admin OBLIGATOIRE
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

  try {
    const body = await request.json()
    const { mediaId, tmdbId, customPosterUrl, correctedTitle } = body
    
    if (!mediaId) {
      return NextResponse.json(
        { error: 'Media ID manquant' },
        { status: 400 }
      )
    }
    
    // Récupérer le média existant
    const { data: existingMedia, error: fetchError } = await supabase
      .from('media')
      .select('*')
      .eq('id', mediaId)
      .single()
    
    if (fetchError || !existingMedia) {
      return NextResponse.json(
        { error: 'Média introuvable' },
        { status: 404 }
      )
    }
    
    let updateData: any = {}
    
    // Cas 1: TMDB ID fourni → Récupérer métadonnées complètes
    if (tmdbId) {
      console.log(`📥 Récupération métadonnées TMDB movie ID: ${tmdbId}`)
      
      const details = await getMovieDetails(tmdbId)
      
      if (details) {
        updateData = {
          title: details.title,
          original_title: details.original_title,
          year: details.release_date ? getYearFromDate(details.release_date) : null,
          tmdb_id: tmdbId,
          poster_url: getTMDBImageUrl(details.poster_path, 'w500'),
          backdrop_url: getTMDBImageUrl(details.backdrop_path, 'original'),
          overview: details.overview,
          genres: details.genres?.map((g: any) => g.name) || null,
          movie_cast: details.credits?.cast || null,
          director: details.credits?.crew?.find((c: any) => c.job === 'Director') || null,
          rating: details.vote_average,
          vote_count: details.vote_count,
          tagline: details.tagline || null,
          release_date: details.release_date || null,
          duration: details.runtime || null,
          formatted_runtime: details.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}min` : null,
          trailer_url: details.videos?.results?.[0]?.key ? `https://youtube.com/watch?v=${details.videos.results[0].key}` : null,
        }
        
        console.log(`✅ Métadonnées récupérées: ${details.title}`)
        
        // Sauvegarder dans manual_matches pour apprentissage
        const originalFilename = existingMedia.pcloud_fileid.split('/').pop()
        if (originalFilename) {
          await supabase
            .from('manual_matches')
            .upsert({
              filename: originalFilename,
              tmdb_id: tmdbId,
              title: details.title,
              year: updateData.year,
              poster_path: details.poster_path,
            }, {
              onConflict: 'filename'
            })
          
          console.log(`💾 Sauvegardé dans manual_matches: ${originalFilename}`)
        }
      }
    }
    
    // Cas 2: Jaquette personnalisée uploadée
    if (customPosterUrl) {
      updateData.poster_url = customPosterUrl
      console.log(`🖼️  Jaquette personnalisée appliquée`)
    }
    
    // Cas 3: Titre corrigé sans TMDB ID
    if (correctedTitle && !tmdbId) {
      updateData.title = correctedTitle
      console.log(`✏️  Titre corrigé: ${correctedTitle}`)
    }
    
    // Mettre à jour uniquement ce média
    const { error: updateError } = await supabase
      .from('media')
      .update(updateData)
      .eq('id', mediaId)
    
    if (updateError) {
      console.error('Erreur mise à jour média:', updateError)
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour' },
        { status: 500 }
      )
    }
    
    console.log(`✅ Média validé: ${mediaId}`)
    
    return NextResponse.json({
      success: true,
      updatedCount: 1
    })
    
  } catch (error) {
    console.error('Erreur API validate-media:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
