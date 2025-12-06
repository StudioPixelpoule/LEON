/**
 * Hook React: useAdaptiveQuality
 * Mesure la bande passante et ajuste automatiquement la qualité de transcodage
 */

import { useEffect, useState, useRef, useCallback } from 'react'

export interface QualityLevel {
  name: string
  bitrate: number // kbps
  resolution: string
  label: string
}

// Niveaux de qualité disponibles
export const QUALITY_LEVELS: QualityLevel[] = [
  { name: 'auto', bitrate: 0, resolution: 'auto', label: 'Auto' },
  { name: '1080p', bitrate: 5000, resolution: '1920x1080', label: '1080p (5 Mbps)' },
  { name: '720p', bitrate: 3000, resolution: '1280x720', label: '720p (3 Mbps)' },
  { name: '480p', bitrate: 1500, resolution: '854x480', label: '480p (1.5 Mbps)' },
  { name: '360p', bitrate: 800, resolution: '640x360', label: '360p (800 kbps)' },
]

interface BandwidthMeasurement {
  timestamp: number
  bytesLoaded: number
  duration: number // ms
  bandwidth: number // kbps
}

interface AdaptiveQualityState {
  currentQuality: QualityLevel
  measuredBandwidth: number // kbps
  isBuffering: boolean
  bufferHealth: 'good' | 'warning' | 'critical'
  autoMode: boolean
}

interface UseAdaptiveQualityOptions {
  enabled?: boolean
  onQualityChange?: (quality: QualityLevel) => void
}

export function useAdaptiveQuality(options: UseAdaptiveQualityOptions = {}) {
  const { enabled = true, onQualityChange } = options
  
  const [state, setState] = useState<AdaptiveQualityState>({
    currentQuality: QUALITY_LEVELS[0], // Auto par défaut
    measuredBandwidth: 0,
    isBuffering: false,
    bufferHealth: 'good',
    autoMode: true,
  })
  
  const measurementsRef = useRef<BandwidthMeasurement[]>([])
  const lastMeasurementRef = useRef<number>(0)
  
  /**
   * Enregistre une mesure de bande passante
   */
  const recordMeasurement = useCallback((bytesLoaded: number, durationMs: number) => {
    if (durationMs <= 0 || bytesLoaded <= 0) return
    
    const bandwidth = (bytesLoaded * 8) / (durationMs / 1000) / 1000 // kbps
    
    const measurement: BandwidthMeasurement = {
      timestamp: Date.now(),
      bytesLoaded,
      duration: durationMs,
      bandwidth,
    }
    
    measurementsRef.current.push(measurement)
    
    // Garder seulement les 10 dernières mesures
    if (measurementsRef.current.length > 10) {
      measurementsRef.current.shift()
    }
    
    // Calculer la moyenne pondérée (mesures récentes ont plus de poids)
    const avgBandwidth = calculateWeightedAverage(measurementsRef.current)
    
    setState(prev => ({
      ...prev,
      measuredBandwidth: avgBandwidth,
    }))
    
    // En mode auto, ajuster la qualité
    if (state.autoMode && enabled) {
      const optimalQuality = selectOptimalQuality(avgBandwidth)
      if (optimalQuality.name !== state.currentQuality.name) {
        setState(prev => ({
          ...prev,
          currentQuality: optimalQuality,
        }))
        onQualityChange?.(optimalQuality)
        console.log(`[ADAPTIVE] 📊 Qualité ajustée: ${optimalQuality.label} (bande passante: ${avgBandwidth.toFixed(0)} kbps)`)
      }
    }
  }, [state.autoMode, state.currentQuality.name, enabled, onQualityChange])
  
  /**
   * Signale un événement de buffering
   */
  const reportBuffering = useCallback((isBuffering: boolean) => {
    setState(prev => ({
      ...prev,
      isBuffering,
      bufferHealth: isBuffering ? 'warning' : prev.bufferHealth,
    }))
    
    // Si buffering fréquent, réduire la qualité
    if (isBuffering && state.autoMode && enabled) {
      const currentIndex = QUALITY_LEVELS.findIndex(q => q.name === state.currentQuality.name)
      if (currentIndex > 0 && currentIndex < QUALITY_LEVELS.length - 1) {
        const lowerQuality = QUALITY_LEVELS[currentIndex + 1]
        setState(prev => ({
          ...prev,
          currentQuality: lowerQuality,
          bufferHealth: 'critical',
        }))
        onQualityChange?.(lowerQuality)
        console.log(`[ADAPTIVE] ⚠️ Buffering détecté, réduction qualité: ${lowerQuality.label}`)
      }
    }
  }, [state.autoMode, state.currentQuality.name, enabled, onQualityChange])
  
  /**
   * Signale la santé du buffer
   */
  const reportBufferHealth = useCallback((bufferedSeconds: number, playbackRate: number = 1) => {
    let health: 'good' | 'warning' | 'critical' = 'good'
    
    // Buffer < 5s = critique, < 10s = warning
    if (bufferedSeconds < 5 * playbackRate) {
      health = 'critical'
    } else if (bufferedSeconds < 10 * playbackRate) {
      health = 'warning'
    }
    
    setState(prev => ({
      ...prev,
      bufferHealth: health,
    }))
    
    return health
  }, [])
  
  /**
   * Force une qualité spécifique (désactive le mode auto)
   */
  const setQuality = useCallback((quality: QualityLevel) => {
    setState(prev => ({
      ...prev,
      currentQuality: quality,
      autoMode: quality.name === 'auto',
    }))
    onQualityChange?.(quality)
    console.log(`[ADAPTIVE] 🎚️ Qualité forcée: ${quality.label}`)
  }, [onQualityChange])
  
  /**
   * Active/désactive le mode auto
   */
  const setAutoMode = useCallback((auto: boolean) => {
    setState(prev => ({
      ...prev,
      autoMode: auto,
    }))
    console.log(`[ADAPTIVE] ${auto ? '🤖 Mode auto activé' : '✋ Mode manuel'}`)
  }, [])
  
  return {
    ...state,
    recordMeasurement,
    reportBuffering,
    reportBufferHealth,
    setQuality,
    setAutoMode,
    qualityLevels: QUALITY_LEVELS,
  }
}

/**
 * Calcule une moyenne pondérée (mesures récentes ont plus de poids)
 */
function calculateWeightedAverage(measurements: BandwidthMeasurement[]): number {
  if (measurements.length === 0) return 0
  
  let totalWeight = 0
  let weightedSum = 0
  
  measurements.forEach((m, index) => {
    // Poids croissant pour les mesures récentes
    const weight = index + 1
    totalWeight += weight
    weightedSum += m.bandwidth * weight
  })
  
  return weightedSum / totalWeight
}

/**
 * Sélectionne la qualité optimale selon la bande passante
 */
function selectOptimalQuality(bandwidthKbps: number): QualityLevel {
  // Marge de sécurité de 20% pour éviter les buffers
  const safeBandwidth = bandwidthKbps * 0.8
  
  // Trouver la meilleure qualité supportée
  for (let i = 1; i < QUALITY_LEVELS.length; i++) {
    const quality = QUALITY_LEVELS[i]
    if (safeBandwidth >= quality.bitrate) {
      return quality
    }
  }
  
  // Fallback sur la plus basse qualité
  return QUALITY_LEVELS[QUALITY_LEVELS.length - 1]
}









