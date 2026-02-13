/**
 * Types partagés pour l'interface d'administration LEON
 */

// ============================================
// VUES ET SYSTEME
// ============================================

export type AdminView = 'dashboard' | 'scan' | 'library' | 'posters' | 'credits' | 'transcode' | 'stats' | 'activity' | 'users' | 'requests'

export interface SystemStatus {
  transcodingActive: boolean
  watcherActive: boolean
  autoStartEnabled: boolean
}

export interface DashboardStats {
  films: number
  series: number
  transcoded: number
  transcodedPercent: number
  postersToValidate: number
  storageGB: number
  queueSize: number
  activeViewers: number
  pendingRequests: number
}

// ============================================
// TOAST
// ============================================

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  leaving?: boolean
}

// ============================================
// ACTIVITE — SESSIONS EN DIRECT
// ============================================

export interface ActiveSession {
  id: string
  userId: string | null
  userName: string
  userEmail: string | null
  mediaId: string
  mediaType: 'movie' | 'episode'
  title: string
  posterUrl: string | null
  year: number | null
  position: number
  duration: number | null
  progress: number
  updatedAt: string
  isActive: boolean
  seriesTitle?: string
  seasonNumber?: number
  episodeNumber?: number
}

export interface ActivityStats {
  totalWatches: number
  uniqueViewers: number
  totalWatchTimeMinutes: number
  mostWatchedToday: Array<{
    mediaId: string
    title: string
    posterUrl: string | null
    watchCount: number
  }>
}

export interface ActivityLiveData {
  activeSessions: ActiveSession[]
  recentHistory: ActiveSession[]
  stats: ActivityStats
}

// ============================================
// ACTIVITE — HISTORIQUE
// ============================================

export interface HistoryEntry {
  id: string
  userId: string | null
  userName: string
  userEmail: string | null
  mediaId: string
  mediaType: 'movie' | 'episode'
  title: string
  posterUrl: string | null
  year: number | null
  watchedAt: string
  watchDuration: number | null
  progress: number
  completed: boolean
  seriesTitle?: string
  seasonNumber?: number
  episodeNumber?: number
}

export interface UserActivityStats {
  userId: string
  userName: string
  userEmail: string | null
  totalWatches: number
  totalWatchTimeMinutes: number
  completedCount: number
  lastActivity: string
}

export interface HistoryData {
  history: HistoryEntry[]
  userStats: UserActivityStats[]
  users: Array<{ id: string; name: string; email: string }>
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

// ============================================
// UTILISATEURS ADMIN
// ============================================

export interface InProgressItem {
  media_id: string
  title: string
  poster_url: string | null
  media_type: 'movie' | 'episode'
  position: number
  duration: number | null
  progress_percent: number
  updated_at: string
  season_number?: number
  episode_number?: number
  series_title?: string
}

export interface AdminUser {
  id: string
  email: string
  display_name: string | null
  created_at: string
  last_sign_in_at: string | null
  email_confirmed: boolean
  in_progress_count: number
  completed_count: number
  total_watch_time_minutes: number
  in_progress_items: InProgressItem[]
}
