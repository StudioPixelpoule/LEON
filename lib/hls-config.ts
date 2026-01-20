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
  
  // 📦 BUFFER OPTIMISÉ - Plus grand pour éviter les micro-lags
  // Compromis : démarrage légèrement plus lent mais lecture fluide
  maxBufferLength: 30, // 30s de buffer (au lieu de 15)
  maxMaxBufferLength: 60, // 60s max absolu
  maxBufferSize: 60 * 1000 * 1000, // 60MB max
  backBufferLength: 30, // Garder 30s en arrière (pour retour rapide)
  
  // 🔧 TOLÉRANCE aux imperfections - Plus permissif
  maxBufferHole: 1.0, // Accepter des trous de 1s
  nudgeOffset: 0.3, // Décalage de nudge 300ms
  nudgeMaxRetry: 8, // 8 tentatives de nudge
  
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
 * Compromis entre vitesse et stabilité
 */
export const HLS_FAST_START_CONFIG: Partial<HlsConfig> = {
  ...HLS_BASE_CONFIG,
  maxBufferLength: 15, // 15s au lieu de 8 pour plus de stabilité
  maxMaxBufferLength: 30,
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

