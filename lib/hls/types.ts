/**
 * Types et constantes pour le module HLS
 * Interfaces partagées entre les services de streaming
 */

/** Paramètres de la requête HLS parsés depuis les query params */
export interface HlsRequestParams {
  filepath: string
  segment: string | null
  variant: string | null
  playlist: string | null
  audioTrack: string
  subtitleTrack: string | null
  seekTo: string | null
}

/** Résultat de la vérification de disponibilité pré-transcodage */
export interface PreTranscodeStatus {
  available: boolean
  directory: string
}

/** En-têtes HTTP pour les réponses HLS */
export interface HlsResponseHeaders {
  'Content-Type': string
  'Cache-Control': string
  [key: string]: string
}

/** Répertoire temporaire pour les segments HLS (legacy, nettoyage uniquement) */
export const HLS_TEMP_DIR = '/tmp/leon-hls'
