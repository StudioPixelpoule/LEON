/**
 * Processeur de métadonnées TMDB
 * Enrichit et formate les données pour stockage optimal
 */

import { 
  getMovieDetails, 
  getTMDBImageUrl, 
  formatRuntime, 
  getMainCast, 
  getDirector,
  getMainTrailer,
  getYouTubeUrl,
  getYearFromDate,
  type TMDBMovie,
  type TMDBWatchProviders
} from '@/lib/tmdb'
import { supabase } from '@/lib/supabase'

export interface ProcessedMovie {
  tmdbId: number
  title: string
  originalTitle: string
  overview: string
  runtime: number | null
  formattedRuntime: string
  releaseDate: Date | null
  year: number
  posterUrl: string | null
  backdropUrl: string | null
  genres: string[]
  rating: number
  voteCount: number
  tagline: string
  director: {
    name: string
    profileUrl: string | null
  } | null
  movieCast: {
    name: string
    character: string
    profileUrl: string | null
  }[]
  trailerUrl: string | null
  watchProviders: {
    streaming: string[]
    rent: string[]
    buy: string[]
  }
}

/**
 * Traite et enrichit les données TMDB pour stockage
 */
export async function processMovieMetadata(tmdbId: number): Promise<ProcessedMovie | null> {
  try {
    const movie = await getMovieDetails(tmdbId, 'fr-FR')
    
    if (!movie) return null
    
    const director = getDirector(movie.credits)
    const mainCast = getMainCast(movie.credits, 10)
    const trailer = getMainTrailer(movie.videos)
    
    const processed: ProcessedMovie = {
      tmdbId: movie.id,
      title: movie.title,
      originalTitle: movie.original_title,
      overview: movie.overview || 'Aucun résumé disponible',
      runtime: movie.runtime,
      formattedRuntime: formatRuntime(movie.runtime),
      releaseDate: movie.release_date ? new Date(movie.release_date) : null,
      year: getYearFromDate(movie.release_date) || 0,
      posterUrl: getTMDBImageUrl(movie.poster_path, 'w500'),
      backdropUrl: getTMDBImageUrl(movie.backdrop_path, 'w1280'),
      genres: movie.genres.map(g => g.name),
      rating: Math.round(movie.vote_average * 10) / 10,
      voteCount: movie.vote_count,
      tagline: movie.tagline || '',
      director: director ? {
        name: director.name,
        profileUrl: getTMDBImageUrl(director.profile_path, 'w185')
      } : null,
      movieCast: mainCast.map(actor => ({
        name: actor.name,
        character: actor.character,
        profileUrl: getTMDBImageUrl(actor.profile_path, 'w185')
      })),
      trailerUrl: trailer ? getYouTubeUrl(trailer.key) : null,
      watchProviders: extractWatchProviders(movie.watch_providers)
    }
    
    return processed
  } catch (error) {
    console.error('Erreur traitement métadonnées:', error)
    return null
  }
}

/**
 * Extrait les plateformes de streaming disponibles au Canada
 */
function extractWatchProviders(providers: TMDBWatchProviders | undefined): ProcessedMovie['watchProviders'] {
  const result = {
    streaming: [] as string[],
    rent: [] as string[],
    buy: [] as string[]
  }
  
  if (!providers || !providers.results || !providers.results.CA) {
    return result
  }
  
  const ca = providers.results.CA
  
  if (ca.flatrate) {
    result.streaming = ca.flatrate.map(p => p.provider_name)
  }
  if (ca.rent) {
    result.rent = ca.rent.map(p => p.provider_name)
  }
  if (ca.buy) {
    result.buy = ca.buy.map(p => p.provider_name)
  }
  
  return result
}

/**
 * Sauvegarde les métadonnées enrichies en base de données
 */
export async function saveMovieMetadata(
  fileId: string,
  metadata: ProcessedMovie,
  fileInfo: { size: number; quality: string },
  subtitles?: Record<string, any>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('media')
      .upsert({
        pcloud_fileid: fileId,
        tmdb_id: metadata.tmdbId,
        title: metadata.title,
        original_title: metadata.originalTitle,
        overview: metadata.overview,
        runtime: metadata.runtime,
        formatted_runtime: metadata.formattedRuntime,
        release_date: metadata.releaseDate?.toISOString(),
        year: metadata.year,
        poster_url: metadata.posterUrl,
        backdrop_url: metadata.backdropUrl,
        genres: metadata.genres,
        rating: metadata.rating,
        vote_count: metadata.voteCount,
        tagline: metadata.tagline,
        director: metadata.director,
        movie_cast: metadata.movieCast,
        trailer_url: metadata.trailerUrl,
        watch_providers: metadata.watchProviders,
        file_size: fileInfo.size,
        quality: fileInfo.quality,
        subtitles: subtitles || null,
        updated_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('Erreur sauvegarde métadonnées:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Erreur sauvegarde:', error)
    return false
  }
}

/**
 * Récupère un film avec toutes ses métadonnées depuis Supabase
 */
export async function getEnrichedMovie(mediaId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .eq('id', mediaId)
      .single()
    
    if (error || !data) return null
    
    return data
  } catch (error) {
    console.error('Erreur récupération film:', error)
    return null
  }
}

