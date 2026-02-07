/**
 * Types TypeScript pour les médias et les métadonnées
 * Centralise les interfaces utilisées dans tout le projet
 */

// =====================================================
// TYPES TMDB (The Movie Database)
// =====================================================

export interface TMDBGenre {
  id: number
  name: string
}

export interface TMDBCastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
}

export interface TMDBCrewMember {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
}

export interface TMDBCredits {
  cast: TMDBCastMember[]
  crew: TMDBCrewMember[]
}

export interface TMDBVideo {
  id: string
  key: string
  name: string
  site: string
  type: string
}

export interface TMDBMovieDetails {
  id: number
  title: string
  original_title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  runtime: number
  vote_average: number
  vote_count: number
  genres: TMDBGenre[]
  tagline: string | null
  credits?: TMDBCredits
  videos?: { results: TMDBVideo[] }
}

export interface TMDBSeriesDetails {
  id: number
  name: string
  original_name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  last_air_date: string
  number_of_seasons: number
  number_of_episodes: number
  vote_average: number
  vote_count: number
  genres: TMDBGenre[]
  status: string
  credits?: TMDBCredits
}

export interface TMDBSearchResult {
  id: number
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string
  first_air_date?: string
  vote_average: number
  media_type?: 'movie' | 'tv'
}

// =====================================================
// TYPES FFPROBE (Métadonnées vidéo)
// =====================================================

export interface FFprobeStreamTags {
  language?: string
  title?: string
  handler_name?: string
  creation_time?: string
}

export interface FFprobeStream {
  index: number
  codec_type: 'video' | 'audio' | 'subtitle'
  codec_name: string
  codec_long_name?: string
  width?: number
  height?: number
  bit_rate?: string
  channels?: number
  channel_layout?: string
  sample_rate?: string
  tags?: FFprobeStreamTags
}

export interface FFprobeFormat {
  filename: string
  format_name: string
  format_long_name: string
  duration: string
  size: string
  bit_rate: string
  tags?: Record<string, string>
}

export interface FFprobeData {
  streams: FFprobeStream[]
  format: FFprobeFormat
}

// =====================================================
// TYPES SÉRIE
// =====================================================

export interface SeriesSummary {
  id: string
  title: string
  original_title?: string
  poster_url: string | null
  backdrop_url?: string | null
  overview?: string
  year?: number
  rating?: number
  genres?: string[]
  tmdb_id?: number
  seasons_count?: number
  episodes_count?: number
}

export interface EpisodeSummary {
  id: string
  title: string
  series_id: string
  season_number: number
  episode_number: number
  duration?: number
  overview?: string
  air_date?: string
  filepath?: string
  poster_url?: string | null
}

export interface SeasonSummary {
  season_number: number
  episode_count: number
  episodes: EpisodeSummary[]
}

// =====================================================
// TYPES MÉDIA LOCAL
// =====================================================

export interface CastMember {
  id?: number
  name: string
  character?: string
  profile_path?: string | null
}

export interface Director {
  id?: number
  name: string
  profile_path?: string | null
}

export interface SubtitleInfo {
  filename: string
  filepath: string
  language?: string
  isForced?: boolean
  isSDH?: boolean
}

export interface SubtitlesMap {
  [language: string]: SubtitleInfo
}

// =====================================================
// TYPES API
// =====================================================

export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: string
  details?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface APIErrorResponse {
  success: false
  error: string
  code?: string
  details?: string
}

// Types de transcodage définis dans lib/transcoding-service.ts (source de vérité unique)
// Importer depuis ce module si nécessaire

// =====================================================
// TYPES PLAYBACK
// =====================================================

export interface PlaybackPosition {
  media_id: string
  media_type: 'movie' | 'episode'
  position: number
  duration: number | null
  updated_at: string
}

export interface WatchHistoryEntry {
  id: string
  media_id: string
  media_type: 'movie' | 'episode'
  watch_duration: number
  completed: boolean
  watched_at: string
}

// =====================================================
// TYPES GROUPED MEDIA
// =====================================================

export interface GroupedMedia {
  id: string
  title: string
  original_title?: string
  year?: number
  duration?: number
  formatted_runtime?: string
  file_size?: string
  quality?: string
  tmdb_id?: number
  poster_url: string | null
  backdrop_url?: string | null
  overview?: string
  genres?: string[]
  movie_cast?: CastMember[]
  director?: Director
  subtitles?: SubtitlesMap
  release_date?: string
  rating?: number
  vote_count?: number
  tagline?: string
  trailer_url?: string
  pcloud_fileid?: string
}

// =====================================================
// TYPE GUARDS
// =====================================================

export function isFFprobeStream(obj: unknown): obj is FFprobeStream {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'index' in obj &&
    'codec_type' in obj &&
    'codec_name' in obj
  )
}

export function isTMDBSearchResult(obj: unknown): obj is TMDBSearchResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    ('title' in obj || 'name' in obj)
  )
}
