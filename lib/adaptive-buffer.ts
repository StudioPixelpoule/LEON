/**
 * Système de buffering adaptatif intelligent
 * Ajuste dynamiquement le buffer selon la vitesse de transcoding et la bande passante
 */

export interface TranscodingMetrics {
  speed: number // Vitesse de transcoding (ex: 3.5x)
  fps: number // Frames par seconde
  segmentsGenerated: number // Nombre de segments générés
  segmentsConsumed: number // Nombre de segments consommés
  timestamp: number // Timestamp de la mesure
}

export interface BufferStrategy {
  minBuffer: number // Buffer minimum en segments
  targetBuffer: number // Buffer cible en segments
  maxBuffer: number // Buffer maximum en segments
  strategy: 'aggressive' | 'balanced' | 'conservative'
  reason: string // Raison du choix de stratégie
}

export class AdaptiveBuffer {
  private metrics: TranscodingMetrics[] = []
  private readonly maxMetricsHistory = 20 // Garder 20 dernières mesures

  /**
   * Enregistre une nouvelle métrique de transcoding
   */
  recordMetrics(metrics: TranscodingMetrics): void {
    this.metrics.push(metrics)
    
    // Limiter l'historique
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift()
    }
  }

  /**
   * Calcule la vitesse moyenne de transcoding récente
   */
  getAverageSpeed(): number {
    if (this.metrics.length === 0) return 0

    // Prendre les 5 dernières mesures pour lisser
    const recentMetrics = this.metrics.slice(-5)
    const sum = recentMetrics.reduce((acc, m) => acc + m.speed, 0)
    return sum / recentMetrics.length
  }

  /**
   * Détecte si le transcoding ralentit
   */
  isSlowingDown(): boolean {
    if (this.metrics.length < 3) return false

    const last3 = this.metrics.slice(-3)
    const speeds = last3.map(m => m.speed)

    // Vérifier si chaque mesure est plus lente que la précédente
    return speeds[1] < speeds[0] && speeds[2] < speeds[1]
  }

  /**
   * Calcule le buffer disponible (segments générés - segments consommés)
   */
  getBufferAvailable(): number {
    if (this.metrics.length === 0) return 0

    const latest = this.metrics[this.metrics.length - 1]
    return Math.max(0, latest.segmentsGenerated - latest.segmentsConsumed)
  }

  /**
   * Détermine la stratégie de buffering optimale
   */
  getBufferStrategy(): BufferStrategy {
    const avgSpeed = this.getAverageSpeed()
    const bufferAvailable = this.getBufferAvailable()
    const isSlowing = this.isSlowingDown()

    console.log(`[${new Date().toISOString()}] [BUFFER] 📊 Analyse`, {
      avgSpeed: avgSpeed.toFixed(2) + 'x',
      bufferAvailable,
      isSlowing
    })

    // 🚀 AGGRESSIVE : Transcoding très rapide (> 4x)
    if (avgSpeed >= 4.0 && !isSlowing) {
      return {
        minBuffer: 2,
        targetBuffer: 3,
        maxBuffer: 5,
        strategy: 'aggressive',
        reason: `Transcoding rapide (${avgSpeed.toFixed(1)}x), buffer minimal`
      }
    }

    // ⚖️ BALANCED : Transcoding normal (2-4x)
    if (avgSpeed >= 2.0 && avgSpeed < 4.0) {
      return {
        minBuffer: 3,
        targetBuffer: 5,
        maxBuffer: 8,
        strategy: 'balanced',
        reason: `Transcoding normal (${avgSpeed.toFixed(1)}x), buffer équilibré`
      }
    }

    // 🛡️ CONSERVATIVE : Transcoding lent (< 2x) ou ralentissement détecté
    if (avgSpeed < 2.0 || isSlowing) {
      return {
        minBuffer: 5,
        targetBuffer: 10,
        maxBuffer: 15,
        strategy: 'conservative',
        reason: isSlowing 
          ? `Ralentissement détecté, buffer sécurisé`
          : `Transcoding lent (${avgSpeed.toFixed(1)}x), buffer large`
      }
    }

    // Fallback par défaut
    return {
      minBuffer: 3,
      targetBuffer: 5,
      maxBuffer: 8,
      strategy: 'balanced',
      reason: 'Stratégie par défaut'
    }
  }

  /**
   * Vérifie si le buffer est dangereux (risque d'interruption)
   */
  isBufferCritical(): boolean {
    const strategy = this.getBufferStrategy()
    const available = this.getBufferAvailable()

    return available < strategy.minBuffer
  }

  /**
   * Recommande une action selon l'état du buffer
   */
  getRecommendedAction(): 'wait' | 'continue' | 'prefetch' {
    const strategy = this.getBufferStrategy()
    const available = this.getBufferAvailable()

    // Buffer critique : ATTENDRE
    if (available < strategy.minBuffer) {
      console.warn(`[${new Date().toISOString()}] [BUFFER] ⚠️ Buffer critique (${available}/${strategy.minBuffer})`)
      return 'wait'
    }

    // Buffer optimal : PRÉCHARGER
    if (available >= strategy.targetBuffer) {
      return 'prefetch'
    }

    // Entre les deux : CONTINUER
    return 'continue'
  }

  /**
   * Calcule le temps d'attente recommandé (en ms) avant de demander un nouveau segment
   */
  getRecommendedDelay(): number {
    const strategy = this.getBufferStrategy()
    const avgSpeed = this.getAverageSpeed()

    // Si transcoding très rapide, pas besoin d'attendre
    if (avgSpeed >= 4.0) {
      return 0
    }

    // Si transcoding lent, attendre proportionnellement
    if (avgSpeed < 2.0) {
      return 1000 // 1 seconde
    }

    // Entre les deux, attendre un peu
    return 500
  }

  /**
   * Génère un rapport de statut pour monitoring
   */
  getStatusReport(): {
    avgSpeed: string
    bufferAvailable: number
    strategy: BufferStrategy
    isCritical: boolean
    recommendedAction: string
  } {
    const strategy = this.getBufferStrategy()

    return {
      avgSpeed: this.getAverageSpeed().toFixed(2) + 'x',
      bufferAvailable: this.getBufferAvailable(),
      strategy,
      isCritical: this.isBufferCritical(),
      recommendedAction: this.getRecommendedAction()
    }
  }

  /**
   * Réinitialise les métriques (nouvelle session)
   */
  reset(): void {
    this.metrics = []
  }
}

// Instance singleton pour chaque session de transcoding
const bufferInstances = new Map<string, AdaptiveBuffer>()

/**
 * Récupère ou crée une instance de buffer pour une session
 */
export function getBufferInstance(sessionId: string): AdaptiveBuffer {
  if (!bufferInstances.has(sessionId)) {
    bufferInstances.set(sessionId, new AdaptiveBuffer())
  }
  return bufferInstances.get(sessionId)!
}

/**
 * Nettoie une instance de buffer
 */
export function cleanupBufferInstance(sessionId: string): void {
  bufferInstances.delete(sessionId)
}


















