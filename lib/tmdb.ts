/**
 * Client TMDB API pour récupération complète des métadonnées de films ET séries TV
 * Documentation: https://developer.themoviedb.org/docs
 */

const TMDB_KEY = process.env.TMDB_API_KEY || ''
const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

export type MediaType = 'movie' | 'tv'

// Types étendus pour métadonnées complètes
export interface TMDBGenre {
  id: number
  name: string
}

export interface TMDBCompany {
  id: number
  name: string
  logo_path: string | null
  origin_country: string
}

export interface TMDBCountry {
  iso_3166_1: string
  name: string
}

export interface TMDBLanguage {
  iso_639_1: string
  name: string
  english_name: string
}

export interface TMDBCast {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
  known_for_department: string
  popularity: number
}

export interface TMDBCrew {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
}

export interface TMDBCredits {
  cast: TMDBCast[]
  crew: TMDBCrew[]
}

export interface TMDBVideo {
  id: string
  key: string
  name: string
  site: string
  type: string
  official: boolean
}

export interface TMDBVideos {
  results: TMDBVideo[]
}

export interface TMDBProvider {
  provider_id: number
  provider_name: string
  logo_path: string
}

export interface TMDBWatchProviders {
  results: {
    CA?: {
      flatrate?: TMDBProvider[]
      rent?: TMDBProvider[]
      buy?: TMDBProvider[]
    }
  }
}

export type TMDBMovie = {
  id: number
  title: string
  original_title: string
  release_date: string
  poster_path: string | null
  backdrop_path: string | null
  overview: string
  genres: TMDBGenre[]
  runtime: number | null
  vote_average: number
  vote_count: number
  popularity: number
  tagline: string
  status: string
  budget: number
  revenue: number
  production_companies: TMDBCompany[]
  production_countries: TMDBCountry[]
  spoken_languages: TMDBLanguage[]
  credits?: TMDBCredits
  videos?: TMDBVideos
  watch_providers?: TMDBWatchProviders
}

export type TMDBMovieDetails = TMDBMovie & {
  credits: TMDBCredits
}

/**
 * Recherche un film par titre et année optionnelle
 * Retourne les résultats les plus pertinents
 */
export async function searchMovie(
  title: string, 
  year?: number
): Promise<TMDBMovie[]> {
  try {
    if (!TMDB_KEY) {
      console.error('❌ TMDB_API_KEY manquante dans .env')
      throw new Error('TMDB_API_KEY manquante dans .env')
    }
    
    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      query: title,
      language: 'fr-CA', // Français canadien comme spécifié
      ...(year && { year: year.toString() })
    })
    
    console.log(`🔎 TMDB search: "${title}"${year ? ` (${year})` : ''}`)
    const response = await fetch(`${TMDB_BASE}/search/movie?${params}`)
    
    if (!response.ok) {
      console.error(`❌ TMDB API error: ${response.status}`)
      throw new Error(`TMDB API error: ${response.status}`)
    }
    
    const data = await response.json()
    console.log(`📝 TMDB results: ${data.results?.length || 0} résultats`)
    return data.results || []
  } catch (error) {
    console.error('❌ Erreur recherche TMDB:', error)
    return []
  }
}

/**
 * Récupère les détails complets d'un film avec toutes les métadonnées
 */
export async function getMovieDetails(tmdbId: number, language: string = 'fr-FR'): Promise<TMDBMovie | null> {
  try {
    if (!TMDB_KEY) {
      throw new Error('TMDB_API_KEY manquante dans .env')
    }
    
    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      language,
      // Récupérer toutes les données en une seule requête
      append_to_response: 'credits,videos,watch_providers'
    })
    
    const response = await fetch(`${TMDB_BASE}/movie/${tmdbId}?${params}`)
    
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Erreur récupération détails TMDB:', error)
    return null
  }
}

/**
 * Génère l'URL complète d'une image TMDB
 * Tailles disponibles: w92, w154, w185, w342, w500, w780, w1280, original
 */
export function getTMDBImageUrl(
  path: string | null, 
  size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500'
): string | null {
  if (!path) return null
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}

/**
 * Extrait l'année d'une date de sortie TMDB
 */
export function getYearFromDate(releaseDate: string | null): number | null {
  if (!releaseDate) return null
  const year = parseInt(releaseDate.split('-')[0])
  return isNaN(year) ? null : year
}

/**
 * Formate la durée en heures et minutes
 */
export function formatRuntime(minutes: number | null): string {
  if (!minutes) return 'Durée inconnue'
  
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}min`
}

/**
 * Récupère les acteurs principaux (limite configurable)
 */
export function getMainCast(credits: TMDBCredits | undefined, limit: number = 10): TMDBCast[] {
  if (!credits || !credits.cast) return []
  return credits.cast.slice(0, limit)
}

/**
 * Récupère le réalisateur depuis les credits
 */
export function getDirector(credits: TMDBCredits | undefined): TMDBCrew | null {
  if (!credits || !credits.crew) return null
  return credits.crew.find(person => person.job === 'Director') || null
}

/**
 * Récupère les scénaristes
 */
export function getWriters(credits: TMDBCredits | undefined): TMDBCrew[] {
  if (!credits || !credits.crew) return []
  
  return credits.crew.filter(person => 
    person.department === 'Writing' || 
    person.job === 'Writer' || 
    person.job === 'Screenplay'
  )
}

/**
 * Récupère la bande-annonce principale
 */
export function getMainTrailer(videos: TMDBVideos | undefined): TMDBVideo | null {
  if (!videos || !videos.results) return null
  
  // Prioriser les trailers officiels YouTube
  const trailer = videos.results.find(video => 
    video.type === 'Trailer' && 
    video.site === 'YouTube' && 
    video.official
  )
  
  // Si pas de trailer officiel, prendre le premier trailer
  return trailer || videos.results.find(video => 
    video.type === 'Trailer' && 
    video.site === 'YouTube'
  ) || null
}

/**
 * Génère l'URL YouTube d'une vidéo
 */
export function getYouTubeUrl(videoKey: string): string {
  return `https://www.youtube.com/watch?v=${videoKey}`
}

/**
 * Récupère toutes les images (backdrops, posters) d'un film via /movie/{id}/images
 * Retourne les images sans filtre de langue pour avoir le maximum de résultats
 */
export async function getMovieImages(tmdbId: number): Promise<{ backdrops: TMDBImage[], posters: TMDBImage[] }> {
  try {
    if (!TMDB_KEY) throw new Error('TMDB_API_KEY manquante')

    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      include_image_language: 'fr,en,null'
    })

    const response = await fetch(`${TMDB_BASE}/movie/${tmdbId}/images?${params}`)
    if (!response.ok) throw new Error(`TMDB API error: ${response.status}`)

    const data = await response.json()
    return {
      backdrops: data.backdrops || [],
      posters: data.posters || []
    }
  } catch (error) {
    console.error('[TMDB] Erreur récupération images:', error)
    return { backdrops: [], posters: [] }
  }
}

/**
 * Récupère toutes les images d'une série TV via /tv/{id}/images
 */
export async function getTVShowImages(tvId: number): Promise<{ backdrops: TMDBImage[], posters: TMDBImage[] }> {
  try {
    if (!TMDB_KEY) throw new Error('TMDB_API_KEY manquante')

    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      include_image_language: 'fr,en,null'
    })

    const response = await fetch(`${TMDB_BASE}/tv/${tvId}/images?${params}`)
    if (!response.ok) throw new Error(`TMDB API error: ${response.status}`)

    const data = await response.json()
    return {
      backdrops: data.backdrops || [],
      posters: data.posters || []
    }
  } catch (error) {
    console.error('[TMDB] Erreur récupération images TV:', error)
    return { backdrops: [], posters: [] }
  }
}

export interface TMDBImage {
  file_path: string
  width: number
  height: number
  aspect_ratio: number
  vote_average: number
  vote_count: number
  iso_639_1: string | null
}

// ============================================
// API SÉRIES TV
// ============================================

export interface TMDBTVShow {
  id: number
  name: string // Équivalent de "title" pour les films
  original_name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  last_air_date: string
  genres: TMDBGenre[]
  number_of_seasons: number
  number_of_episodes: number
  episode_run_time: number[]
  vote_average: number
  vote_count: number
  popularity: number
  status: string
  tagline: string
  created_by: {
    id: number
    name: string
    profile_path: string | null
  }[]
  networks: {
    id: number
    name: string
    logo_path: string | null
  }[]
  production_companies: TMDBCompany[]
  production_countries: TMDBCountry[]
  spoken_languages: TMDBLanguage[]
  credits?: TMDBCredits
  videos?: TMDBVideos
  watch_providers?: TMDBWatchProviders
}

/**
 * Recherche une série TV sur TMDB
 */
export async function searchTVShow(
  name: string,
  year?: number
): Promise<TMDBTVShow[]> {
  try {
    if (!TMDB_KEY) {
      console.error('❌ TMDB_API_KEY manquante dans .env')
      throw new Error('TMDB_API_KEY manquante dans .env')
    }

    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      query: name,
      language: 'fr-CA',
      ...(year && { first_air_date_year: year.toString() })
    })

    console.log(`🔎 TMDB TV search: "${name}"${year ? ` (${year})` : ''}`)
    const response = await fetch(`${TMDB_BASE}/search/tv?${params}`)

    if (!response.ok) {
      console.error(`❌ TMDB API error: ${response.status}`)
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`📺 TMDB TV results: ${data.results?.length || 0} résultats`)
    return data.results || []
  } catch (error) {
    console.error('❌ Erreur recherche TMDB TV:', error)
    return []
  }
}

/**
 * Récupère les détails complets d'une série TV
 */
export async function getTVShowDetails(tvId: number): Promise<TMDBTVShow | null> {
  try {
    if (!TMDB_KEY) {
      throw new Error('TMDB_API_KEY manquante')
    }

    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      language: 'fr-CA',
      append_to_response: 'credits,videos,watch_providers'
    })

    const response = await fetch(`${TMDB_BASE}/tv/${tvId}?${params}`)

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Erreur récupération détails série TV:', error)
    return null
  }
}

/**
 * Récupère les détails d'un épisode spécifique
 */
export async function getTVEpisodeDetails(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<any | null> {
  try {
    if (!TMDB_KEY) {
      throw new Error('TMDB_API_KEY manquante')
    }

    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      language: 'fr-CA'
    })

    const response = await fetch(
      `${TMDB_BASE}/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}?${params}`
    )

    if (!response.ok) {
      console.warn(`⚠️  Episode S${seasonNumber}E${episodeNumber} introuvable`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error(`Erreur récupération épisode S${seasonNumber}E${episodeNumber}:`, error)
    return null
  }
}

/**
 * Recherche un média (film OU série) automatiquement
 */
export async function searchMedia(
  query: string,
  year?: number,
  mediaType?: MediaType
): Promise<{ type: MediaType; data: TMDBMovie | TMDBTVShow }[]> {
  const results: { type: MediaType; data: TMDBMovie | TMDBTVShow }[] = []

  // Si le type est spécifié, chercher uniquement ce type
  if (mediaType === 'movie') {
    const movies = await searchMovie(query, year)
    movies.forEach(movie => results.push({ type: 'movie', data: movie }))
  } else if (mediaType === 'tv') {
    const shows = await searchTVShow(query, year)
    shows.forEach(show => results.push({ type: 'tv', data: show }))
  } else {
    // Chercher les deux en parallèle
    const [movies, shows] = await Promise.all([
      searchMovie(query, year),
      searchTVShow(query, year)
    ])

    movies.forEach(movie => results.push({ type: 'movie', data: movie }))
    shows.forEach(show => results.push({ type: 'tv', data: show }))

    // Trier par popularité
    results.sort((a, b) => b.data.popularity - a.data.popularity)
  }

  return results
}

