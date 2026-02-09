/**
 * Types partagés pour SimpleVideoPlayer et ses composants
 */

// Types pour les pistes audio
export interface AudioTrack {
  index: number
  language: string
  title?: string
  codec?: string
  hlsPlaylist?: string // Pour les pistes audio pré-transcodées
}

// Types pour les pistes de sous-titres
export interface SubtitleTrack {
  index: number
  language: string
  title?: string
  codec?: string
  forced?: boolean
  isDownloaded?: boolean // Pour les tracks téléchargés depuis OpenSubtitles
  sourceUrl?: string // URL de l'API pour les tracks téléchargés
  vttFile?: string // Pour les sous-titres VTT pré-transcodés
}

// Types pour l'épisode suivant
export interface NextEpisodeInfo {
  id: string
  title: string
  seasonNumber: number
  episodeNumber: number
  thumbnail?: string
}

// Préférences à conserver entre épisodes
export interface PlayerPreferences {
  audioTrackIndex?: number
  audioStreamIndex?: number       // Index absolu FFprobe (pour construction URL HLS en transcodage temps réel)
  audioLanguage?: string          // Code langue ISO (fre, eng...) pour résolution robuste entre épisodes
  subtitleTrackIndex?: number | null
  wasFullscreen?: boolean
  volume?: number
}

// Props du lecteur vidéo
export interface SimpleVideoPlayerProps {
  src: string
  title?: string
  subtitle?: string
  onClose: () => void
  poster?: string
  mediaId?: string
  mediaType?: 'movie' | 'episode'
  nextEpisode?: NextEpisodeInfo
  onNextEpisode?: (preferences: PlayerPreferences) => void
  initialPreferences?: PlayerPreferences
}

// État des contrôles vidéo
export interface VideoControlsState {
  isPlaying: boolean
  currentTime: number
  duration: number
  buffered: number
  volume: number
  isMuted: boolean
  isFullscreen: boolean
  isLoading: boolean
  isSeeking: boolean
  showControls: boolean
}

// Actions des contrôles vidéo
export interface VideoControlsActions {
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  toggleFullscreen: () => void
  skip: (seconds: number) => void
}

// Props pour le menu de paramètres
export interface SettingsMenuProps {
  audioTracks: AudioTrack[]
  subtitleTracks: SubtitleTrack[]
  selectedAudio: number
  selectedSubtitle: number | null
  subtitleOffset: number
  onAudioChange: (track: AudioTrack, index: number) => void
  onSubtitleChange: (index: number | null) => void
  onSubtitleOffsetChange: (offset: number) => void
  onClose: () => void
  isDownloadingSubtitles?: boolean
}

// Nom de langue lisible
export const LANGUAGE_NAMES: Record<string, string> = {
  'fre': 'Français',
  'fra': 'Français',
  'french': 'Français',
  'eng': 'Anglais',
  'english': 'Anglais',
  'ger': 'Allemand',
  'deu': 'Allemand',
  'german': 'Allemand',
  'spa': 'Espagnol',
  'spanish': 'Espagnol',
  'ita': 'Italien',
  'italian': 'Italien',
  'por': 'Portugais',
  'portuguese': 'Portugais',
  'jpn': 'Japonais',
  'japanese': 'Japonais',
  'kor': 'Coréen',
  'korean': 'Coréen',
  'zho': 'Chinois',
  'chi': 'Chinois',
  'chinese': 'Chinois',
  'rus': 'Russe',
  'russian': 'Russe',
  'ara': 'Arabe',
  'arabic': 'Arabe',
  'und': 'Non défini',
  '': 'Non défini'
}

/**
 * Obtenir le nom lisible d'une langue
 */
export function getLanguageName(code: string): string {
  const normalized = code?.toLowerCase() || ''
  return LANGUAGE_NAMES[normalized] || code || 'Inconnu'
}

/**
 * Formater le temps en HH:MM:SS ou MM:SS
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}
