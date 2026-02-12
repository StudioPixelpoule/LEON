/**
 * Types, interfaces et constantes pour le module watcher
 */

import path from 'path'

// ─── Chemins (conteneur Docker) ──────────────────────────────────────────────

export const MEDIA_DIR = process.env.MEDIA_DIR || '/leon/media/films'
export const SERIES_DIR = process.env.PCLOUD_SERIES_PATH || '/leon/media/series'
export const TRANSCODED_DIR = process.env.TRANSCODED_DIR || '/leon/transcoded'
export const WATCHER_STATE_FILE = path.join(TRANSCODED_DIR, 'watcher-state.json')

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Extensions vidéo supportées */
export const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v']

/** Debounce pour éviter les événements multiples (fichiers volumineux) */
export const DEBOUNCE_MS = 10_000 // 10 secondes

/** Délai avant scan d'enrichissement global (après batch de fichiers) */
export const ENRICHMENT_SCAN_DELAY_MS = 10 * 60 * 1000 // 10 minutes

/** Intervalle du polling de secours (montages NAS) */
export const POLLING_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/** Taille minimale d'un fichier vidéo valide */
export const MIN_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

// ─── TMDB API ────────────────────────────────────────────────────────────────

export const TMDB_API_KEY = process.env.TMDB_API_KEY
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// ─── Interfaces ──────────────────────────────────────────────────────────────

/** État persisté du watcher (fichier JSON) */
export interface WatcherState {
  knownFiles: string[]
  lastScan: string
}

/** Statistiques du watcher */
export interface WatcherStats {
  isWatching: boolean
  watchedDirs: number
  pendingFiles: number
  knownFiles: number
  pendingEnrichment: boolean
}

/** Métadonnées TMDB d'un épisode */
export interface TmdbEpisodeMetadata {
  name?: string
  overview?: string
  still_path?: string
  air_date?: string
  vote_average?: number
  runtime?: number
}
