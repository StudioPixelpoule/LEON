/**
 * API Admin: Appliquer une correction manuelle
 * POST /api/admin/apply-correction
 * Body: {
 *   mediaId: string,
 *   source: 'tmdb' | 'omdb' | 'manual',
 *   resultId: string, // "tmdb_12345" ou "imdb_tt1234567"
 *   customPosterUrl?: string,
 *   reason: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { createSupabaseAdmin } from '@/lib/supabase'
import { getMovieDetails, getTMDBImageUrl } from '@/lib/tmdb'
import { invalidateMediaCaches } from '@/lib/cache-invalidation'

const OMDB_API_KEY = process.env.OMDB_API_KEY || 'b9a5c8f8'

export async function POST(request: NextRequest) {
  // Vérification admin OBLIGATOIRE
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

  try {
    const supabase = createSupabaseAdmin()
    
    const body = await request.json()
    const { mediaId, source, resultId, customPosterUrl, reason } = body
    
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
    let newTmdbId: number | null = null
    let newPosterUrl: string | null = null
    
    // Cas 1: Upload manuel
    if (source === 'manual' && customPosterUrl) {
      updateData = {
        poster_url: customPosterUrl,
        updated_at: new Date().toISOString()
      }
      newPosterUrl = customPosterUrl
    }
    
    // Cas 2: TMDB
    else if (source === 'tmdb' && resultId.startsWith('tmdb_')) {
      const tmdbId = parseInt(resultId.replace('tmdb_', ''))
      
      try {
        const details = await getMovieDetails(tmdbId)
        
        if (!details) {
          return NextResponse.json(
            { error: 'Impossible de récupérer les détails TMDB' },
            { status: 500 }
          )
        }
        
        // Extraire l'année de release_date (format: "2024-05-15")
        const releaseYear = details.release_date ? parseInt(details.release_date.split('-')[0]) : null
        
        updateData = {
          tmdb_id: tmdbId,
          title: details.title,
          original_title: details.original_title,
          year: releaseYear,
          poster_url: details.poster_path ? getTMDBImageUrl(details.poster_path, 'w500') : null,
          backdrop_url: details.backdrop_path ? getTMDBImageUrl(details.backdrop_path, 'original') : null,
          overview: details.overview,
          rating: details.vote_average,
          release_date: details.release_date,
          genres: details.genres?.map((g: any) => g.name) || [],
          duration: details.runtime,
          formatted_runtime: formatRuntime(details.runtime),
          movie_cast: details.credits?.cast?.slice(0, 10).map((c: any) => ({
            name: c.name,
            character: c.character,
            profile_path: c.profile_path
          })) || [],
          director: details.credits?.crew?.find((c: any) => c.job === 'Director') || null,
          updated_at: new Date().toISOString()
        }
        
        newTmdbId = tmdbId
        newPosterUrl = updateData.poster_url
      } catch (error) {
        console.error('❌ Erreur récupération TMDB:', error)
        return NextResponse.json(
          { error: 'Erreur lors de la récupération des données TMDB' },
          { status: 500 }
        )
      }
    }
    
    // Cas 3: OMDb (IMDb)
    else if (source === 'omdb' && resultId.startsWith('imdb_')) {
      const imdbId = resultId.replace('imdb_', '')
      
      try {
        const omdbUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}&plot=full`
        const response = await fetch(omdbUrl)
        const data = await response.json()
        
        if (data.Response === 'False') {
          return NextResponse.json(
            { error: 'Film introuvable sur OMDb' },
            { status: 404 }
          )
        }
        
        updateData = {
          title: data.Title,
          original_title: data.Title,
          year: data.Year ? parseInt(data.Year) : null,
          poster_url: data.Poster !== 'N/A' ? data.Poster : null,
          overview: data.Plot !== 'N/A' ? data.Plot : null,
          rating: data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null,
          release_date: data.Released !== 'N/A' ? data.Released : null,
          genres: data.Genre !== 'N/A' ? data.Genre.split(', ') : [],
          duration: data.Runtime !== 'N/A' ? parseInt(data.Runtime.replace(' min', '')) : null,
          formatted_runtime: data.Runtime !== 'N/A' ? data.Runtime : null,
          director: data.Director !== 'N/A' ? { name: data.Director } : null,
          updated_at: new Date().toISOString()
        }
        
        newPosterUrl = updateData.poster_url
      } catch (error) {
        console.error('❌ Erreur récupération OMDb:', error)
        return NextResponse.json(
          { error: 'Erreur lors de la récupération des données OMDb' },
          { status: 500 }
        )
      }
    }
    
    else {
      return NextResponse.json(
        { error: 'Source ou resultId invalide' },
        { status: 400 }
      )
    }
    
    // Mettre à jour le média
    const { error: updateError } = await supabase
      .from('media')
      .update(updateData)
      .eq('id', mediaId)
    
    if (updateError) {
      console.error('❌ Erreur mise à jour média:', updateError)
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour du média' },
        { status: 500 }
      )
    }
    
    // Enregistrer dans l'historique
    const { error: correctionError } = await supabase
      .from('media_corrections')
      .insert({
        media_id: mediaId,
        old_tmdb_id: existingMedia.tmdb_id,
        old_poster_url: existingMedia.poster_url,
        old_title: existingMedia.title,
        new_tmdb_id: newTmdbId,
        new_poster_url: newPosterUrl,
        new_title: updateData.title || existingMedia.title,
        correction_reason: reason,
        source: source
      })
    
    if (correctionError) {
      console.error('⚠️ Erreur enregistrement historique:', correctionError)
      // Non bloquant
    }
    
    console.log(`[ADMIN] Correction appliquée pour "${existingMedia.title}" (${source})`)
    invalidateMediaCaches()
    
    return NextResponse.json({
      success: true,
      message: 'Correction appliquée avec succès',
      media: {
        id: mediaId,
        title: updateData.title || existingMedia.title,
        poster_url: newPosterUrl
      }
    })
    
  } catch (error) {
    console.error('❌ Erreur application correction:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'application de la correction' },
      { status: 500 }
    )
  }
}

function formatRuntime(minutes: number | null): string | null {
  if (!minutes) return null
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`
}




