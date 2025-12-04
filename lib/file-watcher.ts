/**
 * Watcher pour détecter les nouveaux fichiers vidéo ajoutés
 * 
 * Fonctionnalités :
 * - Surveillance récursive du répertoire media
 * - Détection des nouveaux fichiers avec debounce
 * - Ajout automatique à la queue de transcodage
 * - Démarrage automatique au boot (appelé par transcoding-service)
 */

import { watch, FSWatcher } from 'fs'
import { readdir, stat, writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// Chemins DANS le conteneur Docker
const MEDIA_DIR = process.env.MEDIA_DIR || '/leon/media/films'
const TRANSCODED_DIR = process.env.TRANSCODED_DIR || '/leon/transcoded'
const WATCHER_STATE_FILE = path.join(TRANSCODED_DIR, 'watcher-state.json')

// Extensions vidéo supportées
const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v']

// Debounce pour éviter les événements multiples
const DEBOUNCE_MS = 10000 // 10 secondes (fichiers volumineux)

// Interface pour l'état du watcher
interface WatcherState {
  knownFiles: string[] // Fichiers déjà connus
  lastScan: string
}

// Déclaration globale pour le singleton
declare global {
  var __fileWatcherSingleton: FileWatcher | undefined
}

class FileWatcher {
  private watchers: FSWatcher[] = []
  private isWatching: boolean = false
  private pendingFiles: Map<string, NodeJS.Timeout> = new Map()
  private watchedDirs: Set<string> = new Set()
  private knownFiles: Set<string> = new Set()

  constructor() {
    console.log('👁️ Initialisation FileWatcher')
    this.loadState()
  }

  /**
   * Charger l'état sauvegardé
   */
  private async loadState(): Promise<void> {
    try {
      if (!existsSync(WATCHER_STATE_FILE)) return

      const data = await readFile(WATCHER_STATE_FILE, 'utf-8')
      const state: WatcherState = JSON.parse(data)
      
      this.knownFiles = new Set(state.knownFiles || [])
      console.log(`📂 État watcher restauré: ${this.knownFiles.size} fichiers connus`)
    } catch (error) {
      console.error('❌ Erreur chargement état watcher:', error)
    }
  }

  /**
   * Sauvegarder l'état
   */
  private async saveState(): Promise<void> {
    try {
      const state: WatcherState = {
        knownFiles: Array.from(this.knownFiles),
        lastScan: new Date().toISOString()
      }
      await writeFile(WATCHER_STATE_FILE, JSON.stringify(state, null, 2))
    } catch (error) {
      console.error('❌ Erreur sauvegarde état watcher:', error)
    }
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
      // Scanner d'abord pour connaître les fichiers existants
      await this.initialScan()
      
      // Puis surveiller récursivement
      await this.watchRecursively(MEDIA_DIR)
      this.isWatching = true
      console.log(`✅ Surveillance active (${this.watchedDirs.size} dossiers, ${this.knownFiles.size} fichiers connus)`)
    } catch (error) {
      console.error('❌ Erreur démarrage watcher:', error)
    }
  }

  /**
   * Scan initial pour connaître les fichiers existants
   */
  private async initialScan(): Promise<void> {
    const scanDir = async (dir: string) => {
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          
          if (entry.isDirectory()) {
            await scanDir(fullPath)
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            if (VIDEO_EXTENSIONS.includes(ext)) {
              this.knownFiles.add(fullPath)
            }
          }
        }
      } catch (error) {
        // Ignorer les erreurs de permission
      }
    }

    await scanDir(MEDIA_DIR)
    await this.saveState()
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

      this.watchers.push(watcher)
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
    if (filepath.includes('.tmp') || filepath.includes('.part') || filepath.includes('.crdownload')) return

    // Ignorer les fichiers déjà connus
    if (this.knownFiles.has(filepath)) return

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
      if (stats.size < 50 * 1024 * 1024) { // < 50MB
        console.log(`⏳ Fichier trop petit, en attente: ${path.basename(filepath)}`)
        return
      }

      // Attendre un peu et vérifier que la taille n'a pas changé
      await new Promise(resolve => setTimeout(resolve, 5000))
      const stats2 = await stat(filepath)
      
      if (stats2.size !== stats.size) {
        console.log(`⏳ Fichier en cours d'écriture: ${path.basename(filepath)}`)
        // Re-programmer le traitement
        this.handleFileEvent('change', filepath)
        return
      }

      // Marquer comme connu
      this.knownFiles.add(filepath)
      await this.saveState()

      console.log(`🆕 Nouveau fichier détecté: ${path.basename(filepath)} (${(stats.size / (1024*1024*1024)).toFixed(2)} GB)`)

      // Importer le service de transcodage de manière dynamique
      const transcodingServiceModule = await import('./transcoding-service')
      const transcodingService = transcodingServiceModule.default
      
      // Ajouter à la queue de transcodage avec haute priorité
      const job = await transcodingService.addToQueue(filepath, true)
      
      if (job) {
        console.log(`➕ Ajouté à la queue de transcodage: ${job.filename}`)
        
        // Si le service n'est pas en cours, le démarrer
        const serviceStats = await transcodingService.getStats()
        if (!serviceStats.isRunning && !serviceStats.isPaused) {
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

    // Fermer tous les watchers
    for (const watcher of this.watchers) {
      try {
        watcher.close()
      } catch {}
    }
    
    this.watchers = []
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
  getStats(): { isWatching: boolean; watchedDirs: number; pendingFiles: number; knownFiles: number } {
    return {
      isWatching: this.isWatching,
      watchedDirs: this.watchedDirs.size,
      pendingFiles: this.pendingFiles.size,
      knownFiles: this.knownFiles.size
    }
  }

  /**
   * Forcer un re-scan complet
   */
  async rescan(): Promise<number> {
    console.log('🔄 Re-scan complet des fichiers...')
    
    const previousCount = this.knownFiles.size
    await this.initialScan()
    const newCount = this.knownFiles.size - previousCount
    
    console.log(`✅ Scan terminé: ${newCount} nouveaux fichiers détectés`)
    return newCount
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
