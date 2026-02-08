/**
 * Types partagés pour l'interface d'administration LEON
 */

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

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  leaving?: boolean
}
