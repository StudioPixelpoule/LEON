/**
 * Configuration HLS optimisée pour LEON
 * Paramètres ajustés pour le transcodage en temps réel sur NAS
 */

import type Hls from 'hls.js'

type HlsConfig = ConstructorParameters<typeof Hls>[0]

/**
 * Configuration de base optimisée pour le streaming
 * Priorité : stabilité et fluidité > démarrage rapide
 */
export const HLS_BASE_CONFIG: Partial<HlsConfig> = {
  debug: false,
  enableWorker: true,
  
  // 🚀 DÉMARRAGE
  startPosition: -1, // Démarrer au début du buffer disponible
  startLevel: -1, // Auto-sélection du niveau de qualité
  
  // 📦 BUFFER OPTIMISÉ - Augmenté pour éviter les micro-coupures audio
  // Compromis : démarrage légèrement plus lent mais lecture parfaitement fluide
  maxBufferLength: 45, // 45s de buffer (était 30s) - évite les micro-coupures
  maxMaxBufferLength: 90, // 90s max absolu (était 60s)
  maxBufferSize: 90 * 1000 * 1000, // 90MB max (augmenté pour plus de marge)
  backBufferLength: 45, // Garder 45s en arrière (était 30s) - seek arrière fluide
  
  // 🔧 TOLÉRANCE aux imperfections - Équilibré pour audio fluide
  maxBufferHole: 0.5, // Réduire à 0.5s (était 1.0s) - moins de micro-coupures audio
  nudgeOffset: 0.2, // Réduire le décalage de nudge (était 0.3s)
  nudgeMaxRetry: 10, // Plus de tentatives (était 8)
  
  // 🎵 STABILITÉ AUDIO - Nouvelles options
  maxAudioFramesDrift: 10, // Permet plus de drift audio avant resync
  appendErrorMaxRetry: 5, // Retenter les erreurs d'append de segment
  
  // ⏳ TIMEOUTS adaptés au transcodage NAS
  manifestLoadingTimeOut: 30000, // 30s pour le manifest
  manifestLoadingMaxRetry: 5,
  manifestLoadingRetryDelay: 1000,
  
  levelLoadingTimeOut: 30000,
  levelLoadingMaxRetry: 5,
  levelLoadingRetryDelay: 1000,
  
  fragLoadingTimeOut: 30000, // 30s pour les fragments
  fragLoadingMaxRetry: 10, // Plus de retries
  fragLoadingRetryDelay: 500, // Retry rapide
  
  // 🎯 ABR (Adaptive Bitrate)
  abrEwmaDefaultEstimate: 8000000, // Estimation initiale 8 Mbps
  abrBandWidthFactor: 0.95,
  abrBandWidthUpFactor: 0.7,
  
  // ⚡ OPTIMISATIONS
  progressive: true, // Chargement progressif
  lowLatencyMode: false, // Pas de low-latency (VOD, pas live)
  startFragPrefetch: true, // Précharger le premier fragment
  
  // 🛡️ RÉCUPÉRATION D'ERREURS
  levelLoadingMaxRetryTimeout: 90000,
  fragLoadingMaxRetryTimeout: 90000,
}

/**
 * Configuration pour démarrage rapide (premier lancement)
 * Compromis entre vitesse et stabilité audio
 */
export const HLS_FAST_START_CONFIG: Partial<HlsConfig> = {
  ...HLS_BASE_CONFIG,
  maxBufferLength: 20, // 20s (était 15s) - garde plus de marge pour l'audio
  maxMaxBufferLength: 45, // (était 30s)
  startFragPrefetch: true,
}

/**
 * Configuration pour connexion lente
 * Buffers encore plus grands, timeouts plus longs
 */
export const HLS_SLOW_CONNECTION_CONFIG: Partial<HlsConfig> = {
  ...HLS_BASE_CONFIG,
  maxBufferLength: 60, // 60s (était 30s) - beaucoup plus de buffer
  maxMaxBufferLength: 120, // 120s (était 60s)
  maxBufferSize: 120 * 1000 * 1000, // 120MB (était 60MB)
  fragLoadingTimeOut: 45000, // 45s (était 40s)
  fragLoadingMaxRetry: 12, // 12 retries (était 10)
  fragLoadingRetryDelay: 2500, // 2.5s (était 2s)
}

/**
 * Configuration pour récupération après erreur
 * Avec position de démarrage spécifique
 */
export function getRecoveryConfig(startPosition: number): Partial<HlsConfig> {
  return {
    ...HLS_BASE_CONFIG,
    startPosition: startPosition > 5 ? startPosition : -1,
    // Plus tolérant après une erreur
    maxBufferHole: 1.0,
    nudgeMaxRetry: 8,
  }
}

/**
 * Sélectionne la meilleure configuration selon le contexte
 */
export function selectHlsConfig(options: {
  isFirstLoad?: boolean
  connectionQuality?: 'excellent' | 'good' | 'poor'
  isRecovery?: boolean
  startPosition?: number
}): Partial<HlsConfig> {
  const { isFirstLoad, connectionQuality, isRecovery, startPosition } = options
  
  // Récupération après erreur
  if (isRecovery && startPosition !== undefined) {
    return getRecoveryConfig(startPosition)
  }
  
  // Premier chargement = démarrage rapide
  if (isFirstLoad) {
    return HLS_FAST_START_CONFIG
  }
  
  // Connexion lente
  if (connectionQuality === 'poor') {
    return HLS_SLOW_CONNECTION_CONFIG
  }
  
  // Par défaut
  return HLS_BASE_CONFIG
}

/**
 * Log la configuration utilisée (pour debug)
 */
export function logHlsConfig(config: Partial<HlsConfig> | undefined, context: string): void {
  if (!config) return
  
  console.log(`[HLS CONFIG] ${context}`, {
    maxBufferLength: config.maxBufferLength,
    fragLoadingTimeOut: config.fragLoadingTimeOut,
    startPosition: config.startPosition,
  })
}

