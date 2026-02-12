/**
 * Configuration HLS optimisée pour LEON
 * Paramètres ajustés pour le streaming pré-transcodé sur NAS
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
  maxBufferHole: 0.3, // 🔧 Réduit à 0.3s - tolère moins de trous pour éviter les sauts
  nudgeOffset: 0.1, // 🔧 Réduit à 0.1s - micro-ajustements plus fins
  nudgeMaxRetry: 15, // 🔧 Plus de tentatives pour éviter les coupures
  
  // 🎵 STABILITÉ AUDIO - Options critiques pour éviter micro-coupures
  maxAudioFramesDrift: 1, // 🔧 Réduit à 1 frame - resync audio plus rapide et précis
  appendErrorMaxRetry: 8, // 🔧 Plus de retries pour les erreurs d'append
  stretchShortVideoTrack: true, // 🔧 Étire les pistes courtes pour éviter les sauts
  forceKeyFrameOnDiscontinuity: true, // 🔧 Force keyframe sur discontinuité
  
  // ⏳ TIMEOUTS adaptés au transcodage NAS
  manifestLoadingTimeOut: 30000, // 30s pour le manifest
  manifestLoadingMaxRetry: 5,
  manifestLoadingRetryDelay: 1000,
  
  levelLoadingTimeOut: 30000,
  levelLoadingMaxRetry: 5,
  levelLoadingRetryDelay: 1000,
  
  fragLoadingTimeOut: 30000, // 30s pour les fragments
  fragLoadingMaxRetry: 15, // 15 retries (supporte les segments lents à transcoder)
  fragLoadingRetryDelay: 1000, // 1s entre les retries (laisse le temps au serveur)
  
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
  fragLoadingMaxRetryTimeout: 120000, // 2 minutes max pour un segment (pré-transcodage incomplet)
}

/**
 * Configuration pour démarrage rapide (premier lancement)
 * Compromis entre vitesse et stabilité audio
 */
export const HLS_FAST_START_CONFIG: Partial<HlsConfig> = {
  ...HLS_BASE_CONFIG,
  maxBufferLength: 30, // 🔧 Augmenté à 30s pour plus de stabilité audio
  maxMaxBufferLength: 60, // 🔧 Augmenté à 60s
  startFragPrefetch: true,
  // 🎵 Hérite des paramètres audio de BASE_CONFIG (stretchShortVideoTrack, etc.)
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
    nudgeMaxRetry: 15,
    appendErrorMaxRetry: 12,
    fragLoadingMaxRetry: 20,
    fragLoadingRetryDelay: 2000,
    fragLoadingMaxRetryTimeout: 180000,
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

