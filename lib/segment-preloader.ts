/**
 * Système de préchargement intelligent des segments HLS
 * Précharge les N prochains segments en arrière-plan pour éviter les buffering
 */

export interface PreloaderConfig {
  lookaheadSegments: number // Nombre de segments à précharger
  maxConcurrent: number // Nombre de requêtes simultanées max
}

const DEFAULT_CONFIG: PreloaderConfig = {
  lookaheadSegments: 3, // Précharger les 3 prochains segments (6 secondes à 2s/segment)
  maxConcurrent: 2, // 2 requêtes en parallèle max
}

interface PreloadTask {
  url: string
  segmentIndex: number
  promise: Promise<void> | null
  completed: boolean
}

export class SegmentPreloader {
  private config: PreloaderConfig
  private tasks: Map<number, PreloadTask> = new Map()
  private currentSegment: number = -1
  private baseUrl: string = ''
  private isEnabled: boolean = true

  constructor(config?: Partial<PreloaderConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Configure l'URL de base pour les segments
   */
  setBaseUrl(url: string): void {
    // Extraire l'URL de base depuis l'URL du playlist
    // Ex: /api/hls?path=/Users/.../video.mkv&playlist=true
    const match = url.match(/^(.*?)&playlist=true/)
    if (match) {
      this.baseUrl = match[1]
    } else {
      // Fallback: utiliser l'URL telle quelle
      this.baseUrl = url.split('&playlist')[0]
    }
    console.log(`[PRELOADER] Base URL configurée: ${this.baseUrl.slice(0, 80)}...`)
  }

  /**
   * Met à jour le segment courant et déclenche le préchargement
   */
  updateCurrentSegment(segmentIndex: number): void {
    if (segmentIndex === this.currentSegment) return
    
    this.currentSegment = segmentIndex
    
    if (!this.isEnabled) return
    
    // Nettoyer les segments trop anciens (plus nécessaires)
    this.cleanupOldTasks(segmentIndex)
    
    // Précharger les prochains segments
    this.preloadNextSegments(segmentIndex)
  }

  /**
   * Précharge les N prochains segments
   */
  private preloadNextSegments(fromIndex: number): void {
    const { lookaheadSegments, maxConcurrent } = this.config
    
    // Calculer les segments à précharger
    const segmentsToPreload: number[] = []
    for (let i = 1; i <= lookaheadSegments; i++) {
      const segmentIndex = fromIndex + i
      
      // Vérifier si ce segment n'est pas déjà préchargé ou en cours
      if (!this.tasks.has(segmentIndex) || !this.tasks.get(segmentIndex)!.completed) {
        segmentsToPreload.push(segmentIndex)
      }
    }
    
    if (segmentsToPreload.length === 0) {
      return // Tous les segments sont déjà préchargés
    }
    
    console.log(`[PRELOADER] 📥 Préchargement des segments:`, segmentsToPreload)
    
    // Limiter le nombre de requêtes simultanées
    const activeTasks = Array.from(this.tasks.values()).filter(t => t.promise && !t.completed).length
    const availableSlots = maxConcurrent - activeTasks
    
    const toPreload = segmentsToPreload.slice(0, availableSlots)
    
    toPreload.forEach(segmentIndex => {
      this.preloadSegment(segmentIndex)
    })
  }

  /**
   * Précharge un segment spécifique
   */
  private preloadSegment(segmentIndex: number): void {
    if (this.tasks.has(segmentIndex)) {
      // Déjà en cours ou complété
      return
    }
    
    const segmentUrl = `${this.baseUrl}&segment=segment${segmentIndex}.ts`
    
    const task: PreloadTask = {
      url: segmentUrl,
      segmentIndex,
      promise: null,
      completed: false,
    }
    
    this.tasks.set(segmentIndex, task)
    
    // Lancer le préchargement
    task.promise = this.fetchSegment(segmentUrl, segmentIndex)
      .then(() => {
        task.completed = true
        console.log(`[PRELOADER] ✅ Segment ${segmentIndex} préchargé`)
        
        // Déclencher le préchargement du suivant si nécessaire
        this.preloadNextSegments(this.currentSegment)
      })
      .catch((error) => {
        console.warn(`[PRELOADER] ⚠️ Erreur préchargement segment ${segmentIndex}:`, error.message)
        // Ne pas marquer comme completed en cas d'erreur
        this.tasks.delete(segmentIndex)
      })
  }

  /**
   * Fetch un segment (utilise le cache du navigateur)
   */
  private async fetchSegment(url: string, segmentIndex: number): Promise<void> {
    const startTime = Date.now()
    
    const response = await fetch(url, {
      method: 'GET',
      // Utiliser le cache du navigateur pour éviter les requêtes dupliquées
      cache: 'force-cache',
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    // Consommer le body pour mettre en cache
    await response.arrayBuffer()
    
    const duration = Date.now() - startTime
    console.log(`[PRELOADER] 📦 Segment ${segmentIndex} téléchargé en ${duration}ms`)
  }

  /**
   * Nettoie les tâches des segments trop anciens
   */
  private cleanupOldTasks(currentIndex: number): void {
    const toDelete: number[] = []
    
    this.tasks.forEach((task, segmentIndex) => {
      // Garder seulement les segments récents (pas plus de 5 segments en arrière)
      if (segmentIndex < currentIndex - 5) {
        toDelete.push(segmentIndex)
      }
    })
    
    toDelete.forEach(index => {
      this.tasks.delete(index)
    })
    
    if (toDelete.length > 0) {
      console.log(`[PRELOADER] 🧹 ${toDelete.length} tâches anciennes nettoyées`)
    }
  }

  /**
   * Active/désactive le préchargement
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    console.log(`[PRELOADER] ${enabled ? '✅ Activé' : '❌ Désactivé'}`)
  }

  /**
   * Réinitialise le préchargeur
   */
  reset(): void {
    this.tasks.clear()
    this.currentSegment = -1
    console.log(`[PRELOADER] 🔄 Réinitialisé`)
  }

  /**
   * Récupère les statistiques du préchargeur
   */
  getStats() {
    const completed = Array.from(this.tasks.values()).filter(t => t.completed).length
    const inProgress = Array.from(this.tasks.values()).filter(t => t.promise && !t.completed).length
    
    return {
      currentSegment: this.currentSegment,
      totalTasks: this.tasks.size,
      completed,
      inProgress,
      config: this.config,
    }
  }
}








