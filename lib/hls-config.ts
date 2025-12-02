/**
 * Configuration HLS optimisée pour LEON
 * Paramètres ajustés pour le transcodage en temps réel sur NAS
 */

import type Hls from 'hls.js'

type HlsConfig = ConstructorParameters<typeof Hls>[0]

/**
 * Configuration de base optimisée pour le streaming
 */
export const HLS_BASE_CONFIG: Partial<HlsConfig> = {
  debug: false,
  enableWorker: true,
  
  // 🚀 DÉMARRAGE RAPIDE
  startPosition: -1, // Démarrer au début du buffer disponible
  startLevel: -1, // Auto-sélection du niveau de qualité
  
  // 📦 BUFFER OPTIMISÉ pour transcodage temps réel
  // Plus petit buffer = démarrage plus rapide
  // Mais assez grand pour absorber les variations de transcodage
  maxBufferLength: 15, // 15s de buffer max (7-8 segments de 2s)
  maxMaxBufferLength: 30, // 30s max absolu
  maxBufferSize: 30 * 1000 * 1000, // 30MB max
  backBufferLength: 10, // Garder 10s en arrière (pour retour rapide)
  
  // 🔧 TOLÉRANCE aux imperfections
  maxBufferHole: 0.5, // Accepter des trous de 500ms
  nudgeOffset: 0.2, // Décalage de nudge 200ms
  nudgeMaxRetry: 5, // 5 tentatives de nudge
  
  // ⏳ TIMEOUTS adaptés au transcodage
  manifestLoadingTimeOut: 20000, // 20s pour le manifest (FFmpeg peut être lent au démarrage)
  manifestLoadingMaxRetry: 3,
  manifestLoadingRetryDelay: 1500,
  
  levelLoadingTimeOut: 20000,
  levelLoadingMaxRetry: 3,
  levelLoadingRetryDelay: 1500,
  
  fragLoadingTimeOut: 25000, // 25s pour les fragments (transcodage en cours)
  fragLoadingMaxRetry: 8, // Plus de retries pour les fragments
  fragLoadingRetryDelay: 800, // Retry rapide
  
  // 🎯 ABR (Adaptive Bitrate) - Désactivé car single quality
  abrEwmaDefaultEstimate: 5000000, // Estimation initiale 5 Mbps
  abrBandWidthFactor: 0.95,
  abrBandWidthUpFactor: 0.7,
  
  // ⚡ OPTIMISATIONS
  progressive: true, // Chargement progressif
  lowLatencyMode: false, // Pas de low-latency (VOD, pas live)
  startFragPrefetch: true, // Précharger le premier fragment
  
  // 🛡️ RÉCUPÉRATION D'ERREURS
  levelLoadingMaxRetryTimeout: 64000,
  fragLoadingMaxRetryTimeout: 64000,
}

/**
 * Configuration pour démarrage rapide (premier lancement)
 * Buffer plus petit pour démarrer vite
 */
export const HLS_FAST_START_CONFIG: Partial<HlsConfig> = {
  ...HLS_BASE_CONFIG,
  maxBufferLength: 8, // Démarrer avec moins de buffer
  maxMaxBufferLength: 15,
  startFragPrefetch: true,
}

/**
 * Configuration pour connexion lente
 * Buffers plus grands, timeouts plus longs
 */
export const HLS_SLOW_CONNECTION_CONFIG: Partial<HlsConfig> = {
  ...HLS_BASE_CONFIG,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  maxBufferSize: 60 * 1000 * 1000,
  fragLoadingTimeOut: 40000,
  fragLoadingMaxRetry: 10,
  fragLoadingRetryDelay: 2000,
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

