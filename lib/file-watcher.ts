/**
 * Watcher pour détecter les nouveaux fichiers vidéo ajoutés
 * Utilise fs.watch pour surveiller le répertoire media
 */

import { watch, FSWatcher } from 'fs'
import { readdir, stat } from 'fs/promises'
import path from 'path'
import transcodingService from './transcoding-service'

// Chemin DANS le conteneur Docker
const MEDIA_DIR = process.env.MEDIA_DIR || '/leon/media/films'

// Extensions vidéo supportées
const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v']

// Debounce pour éviter les événements multiples
const DEBOUNCE_MS = 5000 // 5 secondes

// Déclaration globale pour le singleton
declare global {
  var __fileWatcherSingleton: FileWatcher | undefined
}

class FileWatcher {
  private watcher: FSWatcher | null = null
  private isWatching: boolean = false
  private pendingFiles: Map<string, NodeJS.Timeout> = new Map()
  private watchedDirs: Set<string> = new Set()

  constructor() {
    console.log('👁️ Initialisation FileWatcher')
  }

  /**
   * Démarrer la surveillance du répertoire media
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      console.log('⚠️ Watcher déjà actif')
      return
    }

    console.log(`👁️ Démarrage surveillance: ${MEDIA_DIR}`)
    
    try {
      // Surveiller récursivement
      await this.watchRecursively(MEDIA_DIR)
      this.isWatching = true
      console.log('✅ Surveillance active')
    } catch (error) {
      console.error('❌ Erreur démarrage watcher:', error)
    }
  }

  /**
   * Surveiller un répertoire et ses sous-répertoires
   */
  private async watchRecursively(dir: string): Promise<void> {
    if (this.watchedDirs.has(dir)) return

    try {
      const watcher = watch(dir, { persistent: true }, (eventType, filename) => {
        if (filename) {
          this.handleFileEvent(eventType, path.join(dir, filename))
        }
      })

      watcher.on('error', (error) => {
        console.error(`❌ Erreur watcher ${dir}:`, error)
      })

      this.watchedDirs.add(dir)

      // Surveiller les sous-répertoires
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.watchRecursively(path.join(dir, entry.name))
        }
      }
    } catch (error) {
      console.error(`❌ Erreur surveillance ${dir}:`, error)
    }
  }

  /**
   * Gérer un événement fichier
   */
  private handleFileEvent(eventType: string, filepath: string): void {
    const ext = path.extname(filepath).toLowerCase()
    
    // Ignorer les fichiers non-vidéo
    if (!VIDEO_EXTENSIONS.includes(ext)) return

    // Ignorer les fichiers temporaires
    if (filepath.includes('.tmp') || filepath.includes('.part')) return

    console.log(`📁 Événement: ${eventType} - ${path.basename(filepath)}`)

    // Debounce : attendre que le fichier soit stable
    if (this.pendingFiles.has(filepath)) {
      clearTimeout(this.pendingFiles.get(filepath))
    }

    const timeout = setTimeout(async () => {
      this.pendingFiles.delete(filepath)
      await this.processNewFile(filepath)
    }, DEBOUNCE_MS)

    this.pendingFiles.set(filepath, timeout)
  }

  /**
   * Traiter un nouveau fichier détecté
   */
  private async processNewFile(filepath: string): Promise<void> {
    try {
      // Vérifier que le fichier existe et est complet
      const stats = await stat(filepath)
      
      // Ignorer les fichiers trop petits (probablement incomplets)
      if (stats.size < 10 * 1024 * 1024) { // < 10MB
        console.log(`⏳ Fichier trop petit, en attente: ${path.basename(filepath)}`)
        return
      }

      console.log(`🆕 Nouveau fichier détecté: ${path.basename(filepath)} (${(stats.size / (1024*1024*1024)).toFixed(2)} GB)`)

      // Ajouter à la queue de transcodage avec haute priorité
      const job = transcodingService.addToQueue(filepath, true)
      
      if (job) {
        console.log(`➕ Ajouté à la queue de transcodage: ${job.filename}`)
        
        // Si le service n'est pas en cours, le démarrer
        const serviceStats = await transcodingService.getStats()
        if (!serviceStats.isRunning) {
          console.log('🚀 Démarrage automatique du transcodage')
          transcodingService.start()
        }
      }
    } catch (error) {
      // Le fichier n'existe peut-être plus (supprimé ou renommé)
      console.log(`⚠️ Fichier non accessible: ${path.basename(filepath)}`)
    }
  }

  /**
   * Arrêter la surveillance
   */
  stop(): void {
    if (!this.isWatching) return

    this.isWatching = false
    this.watchedDirs.clear()
    
    // Annuler les timeouts en attente
    for (const timeout of this.pendingFiles.values()) {
      clearTimeout(timeout)
    }
    this.pendingFiles.clear()

    console.log('🛑 Surveillance arrêtée')
  }

  /**
   * Vérifier si le watcher est actif
   */
  isActive(): boolean {
    return this.isWatching
  }

  /**
   * Obtenir les statistiques du watcher
   */
  getStats(): { isWatching: boolean; watchedDirs: number; pendingFiles: number } {
    return {
      isWatching: this.isWatching,
      watchedDirs: this.watchedDirs.size,
      pendingFiles: this.pendingFiles.size
    }
  }
}

// Singleton global
if (!global.__fileWatcherSingleton) {
  console.log('🆕 Création du singleton FileWatcher')
  global.__fileWatcherSingleton = new FileWatcher()
} else {
  console.log('♻️ Réutilisation du singleton FileWatcher')
}

const fileWatcher = global.__fileWatcherSingleton

export default fileWatcher
export { FileWatcher }

