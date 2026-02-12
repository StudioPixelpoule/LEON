/**
 * FileWatcher — Orchestrateur principal.
 * Délègue la logique aux modules spécialisés :
 * - file-monitor : surveillance fs.watch + polling
 * - watcher-state : persistance fichiers connus
 * - movie-importer / episode-importer : import BDD + TMDB
 * - db-consistency : cohérence BDD / disque
 * - filename-parser : extraction infos depuis noms de fichiers
 */

import { FSWatcher } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'
import {
  MEDIA_DIR,
  SERIES_DIR,
  DEBOUNCE_MS,
  ENRICHMENT_SCAN_DELAY_MS,
  POLLING_INTERVAL_MS,
  MIN_FILE_SIZE
} from './types'
import type { WatcherStats } from './types'
import { loadKnownFiles, saveKnownFiles } from './watcher-state'
import { scanDirectory, watchDirectoryRecursive, isValidFileEvent, findNewFiles } from './file-monitor'
import { importMovieToDatabase, forceMarkAsTranscoded } from './movie-importer'
import { importSeriesEpisode } from './episode-importer'
import { checkMissingInDatabase, checkSeriesNeedingEnrichment, triggerEnrichmentScan } from './db-consistency'

export class FileWatcher {
  private watchers: FSWatcher[] = []
  private isWatching: boolean = false
  private pendingFiles: Map<string, NodeJS.Timeout> = new Map()
  private watchedDirs: Set<string> = new Set()
  private knownFiles: Set<string> = new Set()
  private enrichmentScanTimer: NodeJS.Timeout | null = null
  private pendingEnrichment: boolean = false
  private pollingInterval: NodeJS.Timeout | null = null

  constructor() {
    this.loadState()
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Démarrer la surveillance du répertoire media (films + séries)
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      return
    }

    try {
      // Scanner d'abord pour connaître les fichiers existants
      await this.initialScan()

      // Surveiller le dossier films
      await watchDirectoryRecursive(
        MEDIA_DIR,
        this.watchedDirs,
        this.watchers,
        (eventType, filepath) => this.handleFileEvent(eventType, filepath)
      )

      // Surveiller le dossier séries
      try {
        await stat(SERIES_DIR)
        await watchDirectoryRecursive(
          SERIES_DIR,
          this.watchedDirs,
          this.watchers,
          (eventType, filepath) => this.handleFileEvent(eventType, filepath)
        )
      } catch {
        console.warn(`[WATCHER] Dossier séries non accessible: ${SERIES_DIR}`)
      }

      this.isWatching = true
      console.log(`[WATCHER] Démarré: ${this.watchedDirs.size} dossiers surveillés, ${this.knownFiles.size} fichiers connus`)

      // Polling de secours pour montages NAS
      this.startPolling()

      // Vérification de cohérence asynchrone (ne bloque pas le démarrage)
      setTimeout(() => {
        checkMissingInDatabase(
          this.knownFiles,
          (filepath) => this.processNewFile(filepath),
          () => this.saveState(),
          () => this.scheduleEnrichmentScan()
        ).catch(err => {
          console.error('[WATCHER] Erreur vérification cohérence:', err)
        })
      }, 15000) // Attendre 15s que l'app soit stable

      // Vérification des séries sans métadonnées (poster) après 30s
      setTimeout(() => {
        checkSeriesNeedingEnrichment().catch(err => {
          console.error('[WATCHER] Erreur vérification enrichissement:', err)
        })
      }, 30000)

    } catch (error) {
      console.error('[WATCHER] Erreur démarrage watcher:', error)
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
      } catch (error) {
        console.warn('[WATCHER] Erreur fermeture watcher:', error instanceof Error ? error.message : error)
      }
    }

    this.watchers = []
    this.isWatching = false
    this.watchedDirs.clear()

    // Annuler les timeouts en attente
    for (const timeout of this.pendingFiles.values()) {
      clearTimeout(timeout)
    }
    this.pendingFiles.clear()

    // Annuler le timer d'enrichissement
    if (this.enrichmentScanTimer) {
      clearTimeout(this.enrichmentScanTimer)
      this.enrichmentScanTimer = null
    }
    this.pendingEnrichment = false

    // Arrêter le polling de secours
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Vérifier si le watcher est actif
   */
  isActive(): boolean {
    return this.isWatching
  }

  /**
   * Obtenir les statistiques du watcher
   */
  getStats(): WatcherStats {
    return {
      isWatching: this.isWatching,
      watchedDirs: this.watchedDirs.size,
      pendingFiles: this.pendingFiles.size,
      knownFiles: this.knownFiles.size,
      pendingEnrichment: this.pendingEnrichment
    }
  }

  /**
   * Forcer un re-scan complet
   */
  async rescan(): Promise<number> {
    const previousCount = this.knownFiles.size
    await this.initialScan()
    const newCount = this.knownFiles.size - previousCount

    return newCount
  }

  // ─── State Management ────────────────────────────────────────────────────────

  private async loadState(): Promise<void> {
    this.knownFiles = await loadKnownFiles()
  }

  private async saveState(): Promise<void> {
    await saveKnownFiles(this.knownFiles)
  }

  // ─── File Event Handling ─────────────────────────────────────────────────────

  /**
   * Gérer un événement fichier avec debounce
   */
  private handleFileEvent(_eventType: string, filepath: string): void {
    if (!isValidFileEvent(filepath, this.knownFiles)) return

    // Debounce : attendre que le fichier soit stable
    if (this.pendingFiles.has(filepath)) {
      clearTimeout(this.pendingFiles.get(filepath))
    }

    const timeout = setTimeout(async () => {
      this.pendingFiles.delete(filepath)
      try {
        await this.processNewFile(filepath)
      } catch (error) {
        // processNewFile gère déjà ses erreurs — sécurité supplémentaire
        this.knownFiles.add(filepath)
        console.error(`[WATCHER] Erreur inattendue processNewFile (debounce):`, error instanceof Error ? error.message : error)
      }
    }, DEBOUNCE_MS)

    this.pendingFiles.set(filepath, timeout)
  }

  /**
   * Traiter un nouveau fichier détecté.
   * Garantit que le fichier est TOUJOURS ajouté à knownFiles, même en cas d'erreur.
   */
  private async processNewFile(filepath: string): Promise<void> {
    const filename = path.basename(filepath)

    try {
      // Vérifier que le fichier existe et est complet
      const stats = await stat(filepath)

      // Ignorer les fichiers trop petits (probablement incomplets)
      if (stats.size < MIN_FILE_SIZE) {
        this.knownFiles.add(filepath)
        return
      }

      // Attendre un peu et vérifier que la taille n'a pas changé (copie en cours)
      await new Promise(resolve => setTimeout(resolve, 5000))
      const stats2 = await stat(filepath)

      if (stats2.size !== stats.size) {
        // Fichier encore en cours d'écriture — re-programmer sans marquer comme connu
        console.log(`[WATCHER] Fichier en cours d'écriture: ${filename} (${(stats.size / (1024*1024*1024)).toFixed(1)} Go → ${(stats2.size / (1024*1024*1024)).toFixed(1)} Go)`)
        this.handleFileEvent('change', filepath)
        return
      }

      // Marquer comme connu AVANT le traitement (évite les boucles infinies)
      this.knownFiles.add(filepath)
      await this.saveState()

      const fileSize = (stats.size / (1024*1024*1024)).toFixed(2)
      console.log(`[WATCHER] Nouveau fichier détecté: ${filename} (${fileSize} Go)`)

      // Détecter si c'est un épisode de série
      const isSeriesEpisode = filepath.startsWith(SERIES_DIR) || /S\d{1,2}E\d{1,2}/i.test(filename)

      if (isSeriesEpisode) {
        await importSeriesEpisode(filepath, () => this.scheduleEnrichmentScan())
      } else {
        await importMovieToDatabase(filepath, stats.size)
      }

      // Ajouter à la queue de transcodage (films et séries)
      try {
        const transcodingServiceModule = await import('../transcoding-service')
        const transcodingService = transcodingServiceModule.default

        const job = await transcodingService.addToQueue(filepath, true)

        if (job) {
          console.log(`[WATCHER] Ajouté à la queue de transcodage: ${filename}`)
          // Si le service n'est pas en cours, le démarrer
          const serviceStats = await transcodingService.getStats()
          if (!serviceStats.isRunning && !serviceStats.isPaused) {
            console.log(`[WATCHER] Démarrage automatique du transcodage`)
            transcodingService.start()
          }
        } else {
          // addToQueue retourne null = déjà transcodé sur disque
          console.log(`[WATCHER] Fichier déjà transcodé, mise à jour BDD: ${filename}`)
          await forceMarkAsTranscoded(filepath)
        }
      } catch (transcodeError) {
        console.error(`[WATCHER] Erreur ajout queue transcodage ${filename}:`, transcodeError instanceof Error ? transcodeError.message : transcodeError)
      }
    } catch (error) {
      // Marquer comme connu même en cas d'erreur pour éviter les boucles
      this.knownFiles.add(filepath)
      console.error(`[WATCHER] Erreur traitement ${filename}:`, error instanceof Error ? error.message : error)
    }
  }

  // ─── Scanning & Polling ──────────────────────────────────────────────────────

  /**
   * Scan initial pour connaître les fichiers existants (films + séries)
   */
  private async initialScan(): Promise<void> {
    const previousCount = this.knownFiles.size

    // Scanner les films
    const movieFiles = await scanDirectory(MEDIA_DIR)
    for (const file of movieFiles) {
      this.knownFiles.add(file)
    }

    // Scanner les séries (si le dossier existe)
    try {
      await stat(SERIES_DIR)
      const seriesFiles = await scanDirectory(SERIES_DIR)
      for (const file of seriesFiles) {
        this.knownFiles.add(file)
      }
    } catch {
      // Le dossier séries n'existe pas encore
    }

    const newFound = this.knownFiles.size - previousCount
    if (newFound > 0) {
      console.log(`[WATCHER] Scan initial: ${newFound} nouveau(x) fichier(s) trouvé(s) (total: ${this.knownFiles.size})`)
    }

    await this.saveState()
  }

  /**
   * Démarrer le polling de secours (toutes les 5 minutes).
   * fs.watch() ne fonctionne pas toujours sur les montages NAS (NFS/SMB).
   */
  private startPolling(): void {
    if (this.pollingInterval) return

    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollForNewFiles()

        // Synchroniser les statuts is_transcoded (rattrapage continu)
        try {
          const transcodingServiceModule = await import('../transcoding-service')
          const transcodingService = transcodingServiceModule.default
          await transcodingService.syncTranscodedStatus()
        } catch {
          // Silencieux — la sync est un bonus, pas critique
        }
      } catch (error) {
        console.error('[WATCHER] Erreur polling:', error)
      }
    }, POLLING_INTERVAL_MS)

    console.log('[WATCHER] Polling de secours activé (toutes les 5 min)')
  }

  /**
   * Scanner les dossiers pour trouver des fichiers non encore connus.
   * Léger : compare les noms de fichiers avec le Set knownFiles en mémoire.
   */
  private async pollForNewFiles(): Promise<void> {
    const newFiles = await findNewFiles(this.knownFiles)

    if (newFiles.length === 0) return

    console.log(`[WATCHER] Polling: ${newFiles.length} nouveau(x) fichier(s) détecté(s)`)

    for (const filepath of newFiles) {
      try {
        // Vérifier la taille (ignorer < 50MB)
        const stats = await stat(filepath)
        if (stats.size < MIN_FILE_SIZE) {
          this.knownFiles.add(filepath)
          continue
        }

        // Marquer comme connu AVANT le traitement pour éviter la boucle infinie
        this.knownFiles.add(filepath)

        const filename = path.basename(filepath)
        const fileSize = (stats.size / (1024 * 1024 * 1024)).toFixed(2)
        console.log(`[WATCHER] Polling: nouveau fichier ${filename} (${fileSize} Go)`)

        // Détecter si c'est un épisode de série
        const isSeriesEpisode = filepath.startsWith(SERIES_DIR) || /S\d{1,2}E\d{1,2}/i.test(filename)

        if (isSeriesEpisode) {
          await importSeriesEpisode(filepath, () => this.scheduleEnrichmentScan())
        } else {
          await importMovieToDatabase(filepath, stats.size)
        }

        // Ajouter à la queue de transcodage
        const transcodingServiceModule = await import('../transcoding-service')
        const transcodingService = transcodingServiceModule.default

        const job = await transcodingService.addToQueue(filepath, true)
        if (job) {
          const serviceStats = await transcodingService.getStats()
          if (!serviceStats.isRunning && !serviceStats.isPaused) {
            transcodingService.start()
          }
        }
      } catch (error) {
        // Marquer quand même comme connu pour ne pas boucler
        this.knownFiles.add(filepath)
        console.error(`[WATCHER] Polling: erreur traitement ${path.basename(filepath)}:`, error instanceof Error ? error.message : error)
      }
    }

    // Sauvegarder l'état après le batch
    await this.saveState()
  }

  // ─── Enrichment ──────────────────────────────────────────────────────────────

  /**
   * Programmer un scan d'enrichissement différé.
   * Se déclenche après 10 minutes sans nouveaux fichiers.
   */
  private scheduleEnrichmentScan(): void {
    // Annuler le timer précédent
    if (this.enrichmentScanTimer) {
      clearTimeout(this.enrichmentScanTimer)
    }

    this.pendingEnrichment = true

    this.enrichmentScanTimer = setTimeout(async () => {
      this.enrichmentScanTimer = null
      this.pendingEnrichment = false
      await triggerEnrichmentScan()
    }, ENRICHMENT_SCAN_DELAY_MS)
  }
}
