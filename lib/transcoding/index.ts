/**
 * Module de transcodage LEON
 * 
 * Re-exporte exactement la même API que l'ancien lib/transcoding-service.ts :
 * - default : singleton TranscodingService
 * - TranscodingService : classe
 * - TRANSCODED_DIR, MEDIA_DIR : constantes
 * - TranscodeJob, TranscodeStats : types
 */

import { TranscodingService } from './transcoding-service'
export { TranscodingService } from './transcoding-service'
export { TRANSCODED_DIR, MEDIA_DIR } from './types'
export type { TranscodeJob, TranscodeStats } from './types'

// Déclaration globale pour le singleton
declare global {
  var __transcodingServiceSingleton: TranscodingService | undefined
}

// Singleton global (identique à l'ancien code)
if (!global.__transcodingServiceSingleton) {
  console.log('[TRANSCODE] Création du singleton TranscodingService')
  global.__transcodingServiceSingleton = new TranscodingService()
} else {
  console.log('[TRANSCODE] Réutilisation du singleton TranscodingService')
}

const transcodingService = global.__transcodingServiceSingleton

export default transcodingService
