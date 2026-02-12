/**
 * Types pour le scanner de séries TV
 */

/** Extensions vidéo supportées */
export const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.m4v']

/** Épisode détecté sur le filesystem */
export interface Episode {
  filename: string
  filepath: string
  season: number
  episode: number
  seriesName: string
}

/** Données épisode retournées par TMDB */
export interface TmdbEpisodeData {
  name: string
  overview: string
  still_path: string | null
  air_date: string | null
  vote_average: number
  runtime: number | null
}

/** Genre TMDB */
export interface TmdbGenre {
  id: number
  name: string
}

/** Résultat vidéo TMDB (pour trailers) */
export interface TmdbVideoResult {
  type: string
  site: string
  key: string
}

/** Détails complets d'une série depuis TMDB */
export interface TmdbSeriesDetails {
  id: number
  name: string
  original_name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  vote_average: number
  first_air_date: string
  genres?: TmdbGenre[]
  videos?: { results: TmdbVideoResult[] }
  /** Ajouté dynamiquement après extraction du trailer */
  trailer_url?: string
}

/** Progression du scan en cours */
export interface ScanProgress {
  totalSeries: number
  processedSeries: number
  currentEpisode: string | null
}

/** Statistiques cumulées du scan */
export interface ScanStats {
  totalSeries: number
  totalEpisodes: number
  newSeries: number
  updatedSeries: number
  newEpisodes: number
  enrichedEpisodes: number
}

/** État global du scan (persiste entre les requêtes) */
export interface ScanState {
  isRunning: boolean
  startedAt: string | null
  currentSeries: string | null
  progress: ScanProgress
  stats: ScanStats
  error: string | null
  completedAt: string | null
}
