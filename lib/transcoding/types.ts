/**
 * Types et constantes pour le service de transcodage LEON
 */

import path from 'path'

// ─── Configuration ──────────────────────────────────────────────────────────
export const TRANSCODED_DIR = process.env.TRANSCODED_DIR || '/leon/transcoded'
export const MEDIA_DIR = process.env.MEDIA_DIR || '/leon/media/films'
export const SERIES_DIR = process.env.PCLOUD_SERIES_PATH || '/leon/media/series'
export const STATE_FILE = path.join(TRANSCODED_DIR, 'queue-state.json')
export const MAX_CONCURRENT_TRANSCODES = 2
export const SEGMENT_DURATION = 2
export const AUTO_SAVE_INTERVAL = 30000
export const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v']

// ─── Interfaces ─────────────────────────────────────────────────────────────
export interface TranscodeJob {
  id: string
  filepath: string
  filename: string
  outputDir: string
  status: 'pending' | 'transcoding' | 'completed' | 'failed' | 'cancelled'
  progress: number
  startedAt?: string
  completedAt?: string
  error?: string
  priority: number
  estimatedDuration?: number
  currentTime?: number
  speed?: number
  pid?: number
  fileSize?: number
  mtime?: string
  retryCount?: number
}

export interface TranscodeStats {
  totalFiles: number
  completedFiles: number
  pendingFiles: number
  failedFiles: number
  currentJob?: TranscodeJob
  activeJobs?: TranscodeJob[]
  activeCount?: number
  maxConcurrent?: number
  isRunning: boolean
  isPaused: boolean
  estimatedTimeRemaining?: number
  diskUsage?: string
  autoStartEnabled: boolean
  watcherActive: boolean
}

export interface QueueState {
  queue: TranscodeJob[]
  completedJobs: TranscodeJob[]
  interruptedJob?: TranscodeJob
  isRunning: boolean
  isPaused: boolean
  lastSaved: string
  version: number
}

/** Résultat de l'analyse ffprobe des pistes */
export interface StreamInfo {
  audioCount: number
  subtitleCount: number
  audios: Array<{ index: number; language: string; title?: string }>
  subtitles: Array<{ index: number; language: string; title?: string; codec: string }>
}

/** Informations d'une piste audio dans le manifest */
export interface AudioInfoEntry {
  index: number
  language: string
  title: string
  playlist: string
  isDefault: boolean
}

/** Fichier média scanné */
export interface ScannedMediaFile {
  filepath: string
  filename: string
  mtime: Date
  size: number
}

/** Item transcodé retourné par listTranscoded */
export interface TranscodedItem {
  name: string
  folder: string
  transcodedAt: string
  segmentCount: number
  isComplete: boolean
  hasMultiAudio: boolean
  hasSubtitles: boolean
  audioCount: number
  subtitleCount: number
}
