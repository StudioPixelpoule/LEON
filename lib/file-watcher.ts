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
const SERIES_DIR = process.env.PCLOUD_SERIES_PATH || '/leon/media/series'
const TRANSCODED_DIR = process.env.TRANSCODED_DIR || '/leon/transcoded'
const WATCHER_STATE_FILE = path.join(TRANSCODED_DIR, 'watcher-state.json')

// Extensions vidéo supportées
const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v']

// Debounce pour éviter les événements multiples
const DEBOUNCE_MS = 10000 // 10 secondes (fichiers volumineux)

// Debounce pour le scan d'enrichissement global (après batch de fichiers)
const ENRICHMENT_SCAN_DELAY_MS = 10 * 60 * 1000 // 10 minutes de calme avant scan

// TMDB API
const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

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
  private enrichmentScanTimer: NodeJS.Timeout | null = null
  private pendingEnrichment: boolean = false
  private pollingInterval: NodeJS.Timeout | null = null

  constructor() {
    this.loadState()
  }

  /**
   * Récupérer les métadonnées TMDB d'un épisode
   */
  private async fetchTmdbEpisodeMetadata(
    tmdbSeriesId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<{ name?: string; overview?: string; still_path?: string; air_date?: string; vote_average?: number; runtime?: number } | null> {
    if (!TMDB_API_KEY) return null
    
    try {
      // Essayer en français d'abord
      const response = await fetch(
        `${TMDB_BASE_URL}/tv/${tmdbSeriesId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${TMDB_API_KEY}&language=fr-FR`
      )
      
      if (!response.ok) {
        // Fallback en anglais
        const responseEn = await fetch(
          `${TMDB_BASE_URL}/tv/${tmdbSeriesId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${TMDB_API_KEY}&language=en-US`
        )
        if (!responseEn.ok) return null
        return await responseEn.json()
      }
      
      return await response.json()
    } catch {
      return null
    }
  }

  /**
   * Programmer un scan d'enrichissement différé
   * Se déclenche après 10 minutes sans nouveaux fichiers
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
      
      try {
        // Appeler l'API de scan en mode background
        const response = await fetch('http://localhost:3000/api/scan-series?background=true', {
          method: 'POST'
        })
        
        if (!response.ok) {
          console.warn('[WATCHER] Échec du scan d\'enrichissement')
        }
      } catch (error) {
        console.error('[WATCHER] Erreur scan d\'enrichissement:', error)
      }
    }, ENRICHMENT_SCAN_DELAY_MS)
  }

  /**
   * Vérifier au démarrage s'il y a des séries sans poster
   * Si oui, déclencher automatiquement un scan d'enrichissement
   */
  private async checkSeriesNeedingEnrichment(): Promise<void> {
    try {
      const { supabase } = await import('./supabase')
      
      // Compter les séries sans poster_url
      const { data: seriesWithoutPoster, error } = await supabase
        .from('series')
        .select('id, title')
        .is('poster_url', null)
      
      if (error) {
        console.error('[WATCHER] Erreur vérification séries sans poster:', error.message)
        return
      }
      
      if (!seriesWithoutPoster || seriesWithoutPoster.length === 0) {
        return
      }
      
      // Déclencher le scan d'enrichissement
      try {
        const response = await fetch('http://localhost:3000/api/scan-series?background=true', {
          method: 'POST'
        })
        
        if (!response.ok) {
          console.warn('[WATCHER] Échec du déclenchement du scan d\'enrichissement')
        }
      } catch (fetchError) {
        console.error('[WATCHER] Erreur appel API scan-series:', fetchError)
      }
      
    } catch (error) {
      console.error('[WATCHER] Erreur checkSeriesNeedingEnrichment:', error)
    }
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
    } catch (error) {
      console.error('[WATCHER] Erreur chargement état watcher:', error)
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
      console.error('[WATCHER] Erreur sauvegarde état watcher:', error)
    }
  }

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
      await this.watchRecursively(MEDIA_DIR)
      
      // Surveiller le dossier séries
      try {
        await stat(SERIES_DIR)
        await this.watchRecursively(SERIES_DIR)
      } catch {
        console.warn(`[WATCHER] Dossier séries non accessible: ${SERIES_DIR}`)
      }
      
      this.isWatching = true
      
      // Polling de secours : fs.watch() ne fonctionne pas toujours sur les montages NAS (NFS/SMB)
      // Scan léger toutes les 5 minutes pour détecter les fichiers manqués
      this.startPolling()
      
      // Vérification de cohérence asynchrone (ne bloque pas le démarrage)
      setTimeout(() => {
        this.checkMissingInDatabase().catch(err => {
          console.error('[WATCHER] Erreur vérification cohérence:', err)
        })
      }, 15000) // Attendre 15s que l'app soit stable
      
      // Vérification des séries sans métadonnées (poster) après 30s
      setTimeout(() => {
        this.checkSeriesNeedingEnrichment().catch(err => {
          console.error('[WATCHER] Erreur vérification enrichissement:', err)
        })
      }, 30000) // Attendre 30s pour laisser la cohérence se faire d'abord
      
    } catch (error) {
      console.error('[WATCHER] Erreur démarrage watcher:', error)
    }
  }
  
  /**
   * Extraire le titre d'un film depuis le nom de fichier
   */
  private extractMovieTitle(filename: string): string {
    let title = filename
    // Retirer l'extension
    title = title.replace(/\.(mkv|mp4|avi|mov|m4v|webm|flv|wmv)$/i, '')
    // Retirer l'année entre parenthèses ou après un point
    title = title.replace(/[\s._-]*\(?\d{4}\)?[\s._-]*$/, '')
    // Nettoyer les séparateurs
    title = title.replace(/[._]/g, ' ').trim()
    return title.toLowerCase()
  }
  
  /**
   * Extraire les infos d'un épisode depuis le chemin
   */
  private extractEpisodeInfo(filepath: string): { seriesName: string; season: number; episode: number } | null {
    const filename = path.basename(filepath)
    const episodeMatch = filename.match(/S(\d{1,2})E(\d{1,2})/i)
    if (!episodeMatch) return null
    
    const season = parseInt(episodeMatch[1])
    const episode = parseInt(episodeMatch[2])
    
    // Extraire le nom de la série depuis le dossier parent
    let seriesPath = path.dirname(filepath)
    let seriesName = path.basename(seriesPath)
    
    // Si dans un dossier de saison, remonter
    const seasonPatterns = [/^Season\s*\d+$/i, /^Saison\s*\d+$/i, /^S\d{1,2}$/i, /\sS\d{1,2}$/i]
    if (seasonPatterns.some(p => p.test(seriesName))) {
      seriesPath = path.dirname(seriesPath)
      seriesName = path.basename(seriesPath)
    }
    
    return { seriesName: seriesName.toLowerCase(), season, episode }
  }

  /**
   * Vérifier si des fichiers connus manquent en base de données
   * et les ajouter automatiquement (version optimisée)
   */
  private async checkMissingInDatabase(): Promise<void> {
    try {
      const { supabase } = await import('./supabase')
      
      // Récupérer tous les films en BDD avec titre ET filepath
      const { data: movies } = await supabase
        .from('media')
        .select('title, filepath')
      
      // Créer des sets pour recherche rapide (par filepath ET par titre normalisé)
      const movieFilepaths = new Set((movies || []).map(m => m.filepath).filter(Boolean))
      const movieTitles = new Set((movies || []).map(m => m.title?.toLowerCase()).filter(Boolean))
      
      // Récupérer tous les épisodes avec série, saison, numéro
      const { data: episodes } = await supabase
        .from('episodes')
        .select('filepath, series_id, season_number, episode_number, series:series_id(title)')
      
      // Créer un set d'épisodes par clé unique (série+saison+episode)
      const episodeFilepaths = new Set((episodes || []).map(e => e.filepath).filter(Boolean))
      const episodeKeys = new Set((episodes || []).map(e => {
        const seriesTitle = (e.series as { title?: string })?.title?.toLowerCase() || ''
        return `${seriesTitle}|s${e.season_number}e${e.episode_number}`
      }))
      
      // Trouver les VRAIS fichiers manquants (ni par filepath, ni par titre/clé)
      const missingFiles: string[] = []
      
      for (const filepath of this.knownFiles) {
        const filename = path.basename(filepath)
        
        if (filepath.startsWith(SERIES_DIR)) {
          // C'est un épisode
          // Vérifier par filepath d'abord
          if (episodeFilepaths.has(filepath)) continue
          
          // Vérifier par clé série+saison+episode
          const info = this.extractEpisodeInfo(filepath)
          if (info) {
            const key = `${info.seriesName}|s${info.season}e${info.episode}`
            if (episodeKeys.has(key)) continue
          }
          
          // Vraiment manquant
          missingFiles.push(filepath)
          
        } else if (filepath.startsWith(MEDIA_DIR)) {
          // C'est un film
          // Vérifier par filepath d'abord
          if (movieFilepaths.has(filepath)) continue
          
          // Vérifier par titre normalisé
          const title = this.extractMovieTitle(filename)
          if (movieTitles.has(title)) continue
          
          // Vraiment manquant
          missingFiles.push(filepath)
        }
      }
      
      if (missingFiles.length === 0) {
        return
      }
      
      // Séparer séries et films pour affichage
      const missingSeries = missingFiles.filter(f => f.startsWith(SERIES_DIR))
      const missingMovies = missingFiles.filter(f => f.startsWith(MEDIA_DIR))
      
      // Traiter les fichiers manquants (séries d'abord, puis films)
      // Séries en priorité car généralement ce qu'on veut voir rapidement
      const sortedMissing = [...missingSeries, ...missingMovies]
      
      let processed = 0
      for (const filepath of sortedMissing) {
        try {
          this.knownFiles.delete(filepath)
          await this.processNewFile(filepath)
          processed++
          
          // Pause courte entre chaque fichier (100ms au lieu de 500ms)
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (err) {
          console.error(`[WATCHER] Erreur traitement ${path.basename(filepath)}:`, err)
        }
      }
      
      await this.saveState()
      
      if (processed > 0) {
        this.scheduleEnrichmentScan()
      }
      
    } catch (error) {
      console.error('[WATCHER] Erreur vérification cohérence:', error)
    }
  }

  /**
   * Scan initial pour connaître les fichiers existants (films + séries)
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

    // Scanner les films
    await scanDir(MEDIA_DIR)
    
    // Scanner les séries (si le dossier existe)
    try {
      await stat(SERIES_DIR)
      await scanDir(SERIES_DIR)
    } catch {
      // Le dossier séries n'existe pas encore
    }
    
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
        console.error(`[WATCHER] Erreur watcher ${dir}:`, error)
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
      console.error(`[WATCHER] Erreur surveillance ${dir}:`, error)
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
        return
      }

      // Attendre un peu et vérifier que la taille n'a pas changé
      await new Promise(resolve => setTimeout(resolve, 5000))
      const stats2 = await stat(filepath)
      
      if (stats2.size !== stats.size) {
        // Re-programmer le traitement
        this.handleFileEvent('change', filepath)
        return
      }

      // Marquer comme connu
      this.knownFiles.add(filepath)
      await this.saveState()

      const filename = path.basename(filepath)
      const fileSize = (stats.size / (1024*1024*1024)).toFixed(2)
      
      // Détecter si c'est un épisode de série (fichier dans SERIES_DIR ou contient SxxExx)
      const isSeriesEpisode = filepath.startsWith(SERIES_DIR) || /S\d{1,2}E\d{1,2}/i.test(filename)
      
      if (isSeriesEpisode) {
        // Déclencher un scan de la série
        await this.importSeriesEpisode(filepath)
      } else {
        // IMPORTER DANS LA BASE AVEC MÉTADONNÉES TMDB
        await this.importToDatabase(filepath, stats.size)
      }

      // Ajouter à la queue de transcodage (films et séries)
      const transcodingServiceModule = await import('./transcoding-service')
      const transcodingService = transcodingServiceModule.default
      
      const job = await transcodingService.addToQueue(filepath, true)
      
      if (job) {
        // Si le service n'est pas en cours, le démarrer
        const serviceStats = await transcodingService.getStats()
        if (!serviceStats.isRunning && !serviceStats.isPaused) {
          transcodingService.start()
        }
      }
    } catch (error) {
      // Le fichier n'existe peut-être plus (supprimé ou renommé)
      console.warn(`[WATCHER] Fichier non accessible: ${path.basename(filepath)}`)
    }
  }

  /**
   * Importer un épisode de série (déclenche un scan de la série parente)
   */
  private async importSeriesEpisode(filepath: string): Promise<void> {
    try {
      const filename = path.basename(filepath)
      
      // Extraire le numéro de saison/épisode
      const episodeMatch = filename.match(/S(\d+)E(\d+)/i)
      if (!episodeMatch) {
        return
      }
      
      const seasonNumber = parseInt(episodeMatch[1])
      const episodeNumber = parseInt(episodeMatch[2])
      
      // Trouver le dossier de la série (parent ou grand-parent)
      // Structure possible: /series/NomSerie/Season X/fichier.mkv
      // ou: /series/NomSerie/fichier.mkv
      let seriesPath = path.dirname(filepath)
      let seriesName = path.basename(seriesPath)
      
      // Si on est dans un dossier de saison, remonter d'un niveau
      // Patterns: "Season 1", "Saison 1", "S01", "S1", "NomSerie S01", "NomSerie S1", etc.
      const seasonPatterns = [
        /^Season\s*\d+$/i,           // Season 1, Season01
        /^Saison\s*\d+$/i,           // Saison 1, Saison01
        /^S\d{1,2}$/i,               // S01, S1
        /\sS\d{1,2}$/i,              // "Industry S03" → se termine par S + chiffres
        /^Specials?$/i,              // Specials
      ]
      
      if (seasonPatterns.some(pattern => pattern.test(seriesName))) {
        seriesPath = path.dirname(seriesPath)
        seriesName = path.basename(seriesPath)
      }
      
      // Import dynamique pour éviter les dépendances circulaires
      const { supabase } = await import('./supabase')
      
      // Chercher la série existante par chemin local
      const { data: existingSeries } = await supabase
        .from('series')
        .select('id, title, tmdb_id')
        .eq('local_folder_path', seriesPath)
        .single()
      
      if (existingSeries) {
        // Vérifier si l'épisode existe déjà
        const { data: existingEp } = await supabase
          .from('episodes')
          .select('id')
          .eq('series_id', existingSeries.id)
          .eq('season_number', seasonNumber)
          .eq('episode_number', episodeNumber)
          .single()
        
        if (existingEp) {
          return
        }
        
        // Préparer les données de l'épisode
        const cleanTitle = this.cleanEpisodeTitle(filename, seriesName)
        const episodeData: Record<string, unknown> = {
          series_id: existingSeries.id,
          tmdb_series_id: existingSeries.tmdb_id,
          season_number: seasonNumber,
          episode_number: episodeNumber,
          title: cleanTitle,
          filepath: filepath,
          is_transcoded: false // Masqué jusqu'à la fin du transcodage
        }
        
        // Récupérer les métadonnées TMDB si la série a un tmdb_id
        if (existingSeries.tmdb_id) {
          const tmdbEpisode = await this.fetchTmdbEpisodeMetadata(
            existingSeries.tmdb_id,
            seasonNumber,
            episodeNumber
          )
          
          if (tmdbEpisode) {
            if (tmdbEpisode.name) episodeData.title = tmdbEpisode.name
            if (tmdbEpisode.overview) episodeData.overview = tmdbEpisode.overview
            if (tmdbEpisode.still_path) episodeData.still_url = `https://image.tmdb.org/t/p/w500${tmdbEpisode.still_path}`
            if (tmdbEpisode.air_date) episodeData.air_date = tmdbEpisode.air_date
            if (tmdbEpisode.vote_average) episodeData.rating = tmdbEpisode.vote_average
            if (tmdbEpisode.runtime) episodeData.runtime = tmdbEpisode.runtime
          }
        }
        
        // Ajouter l'épisode
        const { error: epError } = await supabase.from('episodes').insert(episodeData)
        
        if (epError) {
          console.error(`[WATCHER] Erreur ajout épisode:`, epError.message)
        }
        
        // Programmer un scan d'enrichissement différé (pour les autres épisodes potentiels)
        this.scheduleEnrichmentScan()
      } else {
        // Série pas encore en base - déclencher un scan complet
        // Appeler l'API de scan (via fetch interne ou directement)
        try {
          // On va simplement créer la série sans métadonnées pour l'instant
          // Un scan manuel pourra enrichir les données plus tard
          const { data: newSeries, error: insertError } = await supabase
            .from('series')
            .insert({
              title: seriesName,
              local_folder_path: seriesPath
            })
            .select('id')
            .single()
          
          if (insertError || !newSeries) {
            console.error(`[WATCHER] Erreur création série:`, insertError?.message)
            return
          }
          
          // Ajouter l'épisode
          const cleanTitle = this.cleanEpisodeTitle(filename, seriesName)
          await supabase.from('episodes').insert({
            series_id: newSeries.id,
            season_number: seasonNumber,
            episode_number: episodeNumber,
            title: cleanTitle,
            filepath: filepath,
            is_transcoded: false // Masqué jusqu'à la fin du transcodage
          })
          
          // Programmer un scan d'enrichissement différé (pour récupérer les métadonnées TMDB)
          this.scheduleEnrichmentScan()
        } catch (scanError) {
          console.error(`[WATCHER] Erreur lors du scan:`, scanError)
        }
      }
    } catch (error) {
      console.error(`[WATCHER] Erreur import épisode:`, error)
    }
  }

  /**
   * Nettoyer le titre d'un épisode
   */
  private cleanEpisodeTitle(filename: string, seriesName: string): string {
    let title = filename
    
    // 1. Retirer l'extension
    title = title.replace(/\.(mkv|mp4|avi|mov|m4v)$/i, '')
    
    // 2. Retirer les infos de codec/release
    title = title.replace(/[\[\(]?x26[45][\]\)]?/gi, '')
    title = title.replace(/[\[\(]?HEVC[\]\)]?/gi, '')
    title = title.replace(/[\[\(]?10bit[\]\)]?/gi, '')
    title = title.replace(/[\[\(]?HDR[\]\)]?/gi, '')
    title = title.replace(/[\[\(]?WEB-?DL[\]\)]?/gi, '')
    title = title.replace(/[\[\(]?BluRay[\]\)]?/gi, '')
    title = title.replace(/[\[\(]?1080p[\]\)]?/gi, '')
    title = title.replace(/[\[\(]?720p[\]\)]?/gi, '')
    title = title.replace(/[\[\(]?2160p[\]\)]?/gi, '')
    title = title.replace(/[\[\(]?4K[\]\)]?/gi, '')
    
    // 3. Retirer les noms de release groups
    title = title.replace(/-[A-Za-z0-9]+$/g, '')
    title = title.replace(/\[.*?\]/g, '')
    
    // 4. Retirer le pattern SxxExx
    title = title.replace(/S\d+E\d+/gi, '')
    
    // 5. Retirer le nom de la série
    const seriesNameClean = seriesName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    title = title.replace(new RegExp(`^${seriesNameClean}[\\s.-]*`, 'i'), '')
    title = title.replace(new RegExp(`[\\s.-]+${seriesNameClean}[\\s.-]*`, 'i'), '')
    
    // 6. Nettoyer
    title = title.replace(/^[\s._-]+/, '')
    title = title.replace(/[\s._-]+$/, '')
    title = title.replace(/\s{2,}/g, ' ')
    
    // 7. Si vide, utiliser un format par défaut
    if (!title.trim()) {
      const match = filename.match(/S(\d+)E(\d+)/i)
      if (match) {
        title = `Épisode ${parseInt(match[2])}`
      } else {
        title = filename.replace(/\.(mkv|mp4|avi|mov|m4v)$/i, '')
      }
    }
    
    return title.trim()
  }

  /**
   * Importer un fichier dans la base de données avec métadonnées TMDB
   */
  private async importToDatabase(filepath: string, fileSize: number): Promise<void> {
    try {
      const filename = path.basename(filepath)

      // Imports dynamiques pour éviter les dépendances circulaires
      const { supabase } = await import('./supabase')
      const { searchMovie, getMovieDetails, getTMDBImageUrl, getYearFromDate } = await import('./tmdb')
      const { findLocalSubtitles, formatFileSize, detectVideoQuality } = await import('./localScanner')
      const { sanitizeFilename } = await import('./media-recognition/filenameSanitizer')

      // Vérifier si le fichier existe déjà en base
      const { data: existing } = await supabase
        .from('media')
        .select('id')
        .eq('pcloud_fileid', filepath)
        .single()

      if (existing) {
        return
      }

      // Nettoyer le nom du fichier pour la recherche TMDB
      const sanitized = sanitizeFilename(filename)
      const cleanName = sanitized.cleanName
      const year = sanitized.year || undefined

      // Rechercher sur TMDB
      let mediaDetails = null
      let tmdbId = null

      try {
        const searchResults = await searchMovie(cleanName, year || undefined)
        if (searchResults && searchResults.length > 0) {
          tmdbId = searchResults[0].id
          mediaDetails = await getMovieDetails(tmdbId)
        }
      } catch (tmdbError) {
        // Pas de résultat TMDB
      }

      // Chercher les sous-titres locaux
      const localSubtitles = await findLocalSubtitles(filepath)
      const subtitles = localSubtitles.reduce((acc: Record<string, unknown>, sub: { language?: string; filename: string; filepath: string; forced?: boolean; sdh?: boolean }) => {
        const lang = sub.language || 'UNKNOWN'
        acc[lang.toUpperCase()] = {
          filename: sub.filename,
          filepath: sub.filepath,
          isForced: sub.forced || false,
          isSDH: sub.sdh || false
        }
        return acc
      }, {} as Record<string, unknown>)

      // Détecter la qualité
      const quality = detectVideoQuality(filename, fileSize)

      // Préparer les données
      const mediaData = {
        pcloud_fileid: filepath,
        title: mediaDetails?.title || cleanName || filename,
        original_title: mediaDetails?.original_title || null,
        year: mediaDetails?.release_date ? getYearFromDate(mediaDetails.release_date) : year || null,
        duration: mediaDetails?.runtime || null,
        formatted_runtime: mediaDetails?.runtime ? `${Math.floor(mediaDetails.runtime / 60)}h ${mediaDetails.runtime % 60}min` : null,
        file_size: formatFileSize(fileSize),
        quality: quality,
        tmdb_id: mediaDetails?.id || null,
        poster_url: getTMDBImageUrl(mediaDetails?.poster_path || null, 'w500'),
        backdrop_url: getTMDBImageUrl(mediaDetails?.backdrop_path || null, 'original'),
        overview: mediaDetails?.overview || null,
        genres: mediaDetails?.genres?.map((g: { name: string }) => g.name) || null,
        movie_cast: mediaDetails?.credits?.cast || null,
        subtitles: Object.keys(subtitles).length > 0 ? subtitles : null,
        release_date: mediaDetails?.release_date || null,
        rating: mediaDetails?.vote_average || null,
        vote_count: mediaDetails?.vote_count || null,
        tagline: mediaDetails?.tagline || null,
        director: mediaDetails?.credits?.crew?.find((c: { job: string }) => c.job === 'Director')?.name || null,
        trailer_url: (() => {
          const trailer = mediaDetails?.videos?.results?.find((v: { type: string; site: string }) => v.type === 'Trailer' && v.site === 'YouTube')
          return trailer?.key ? `https://www.youtube.com/watch?v=${trailer.key}` : null
        })(),
        media_type: 'movie',
        updated_at: new Date().toISOString(),
        is_transcoded: false // Masqué jusqu'à la fin du transcodage
      }

      // Insérer en base
      const { error } = await supabase
        .from('media')
        .insert(mediaData)

      if (error) {
        console.error(`[WATCHER] Erreur insertion base: ${error.message}`)
      }
    } catch (error) {
      console.error(`[WATCHER] Erreur import automatique:`, error)
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

  /**
   * Polling de secours : scanne les dossiers toutes les 5 minutes
   * pour détecter les fichiers que fs.watch() aurait manqués (montages NAS)
   */
  private startPolling(): void {
    if (this.pollingInterval) return

    const POLLING_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollForNewFiles()
      } catch (error) {
        console.error('[WATCHER] Erreur polling:', error)
      }
    }, POLLING_INTERVAL_MS)

    console.log('[WATCHER] Polling de secours activé (toutes les 5 min)')
  }

  /**
   * Scanner les dossiers pour trouver des fichiers non encore connus
   * Léger : compare les noms de fichiers avec le Set knownFiles en mémoire
   * Résilient : marque les fichiers comme connus même en cas d'erreur de traitement
   */
  private async pollForNewFiles(): Promise<void> {
    const newFiles: string[] = []

    const scanDir = async (dir: string) => {
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            await scanDir(fullPath)
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            if (VIDEO_EXTENSIONS.includes(ext) && !this.knownFiles.has(fullPath)) {
              // Ignorer les fichiers temporaires
              if (!fullPath.includes('.tmp') && !fullPath.includes('.part') && !fullPath.includes('.crdownload')) {
                newFiles.push(fullPath)
              }
            }
          }
        }
      } catch {
        // Ignorer les erreurs de permission
      }
    }

    await scanDir(MEDIA_DIR)
    try {
      await stat(SERIES_DIR)
      await scanDir(SERIES_DIR)
    } catch {
      // Dossier séries non accessible
    }

    if (newFiles.length === 0) return

    console.log(`[WATCHER] Polling: ${newFiles.length} nouveau(x) fichier(s) détecté(s)`)

    for (const filepath of newFiles) {
      try {
        // Vérifier la taille (ignorer < 50MB)
        const stats = await stat(filepath)
        if (stats.size < 50 * 1024 * 1024) {
          // Fichier trop petit — le marquer comme connu pour ne pas le re-scanner
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
          await this.importSeriesEpisode(filepath)
        } else {
          await this.importToDatabase(filepath, stats.size)
        }

        // Ajouter à la queue de transcodage
        const transcodingServiceModule = await import('./transcoding-service')
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

  /**
   * Vérifier si le watcher est actif
   */
  isActive(): boolean {
    return this.isWatching
  }

  /**
   * Obtenir les statistiques du watcher
   */
  getStats(): { isWatching: boolean; watchedDirs: number; pendingFiles: number; knownFiles: number; pendingEnrichment: boolean } {
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
}

// Singleton global
if (!global.__fileWatcherSingleton) {
  global.__fileWatcherSingleton = new FileWatcher()
}

const fileWatcher = global.__fileWatcherSingleton

export default fileWatcher
export { FileWatcher }
