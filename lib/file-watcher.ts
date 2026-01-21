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

  constructor() {
    console.log('👁️ Initialisation FileWatcher')
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
      
      console.log('🔄 Scan d\'enrichissement automatique (10 min de calme)')
      
      try {
        // Appeler l'API de scan en mode background
        const response = await fetch('http://localhost:3000/api/scan-series?background=true', {
          method: 'POST'
        })
        
        if (response.ok) {
          console.log('✅ Scan d\'enrichissement lancé en arrière-plan')
        } else {
          console.log('⚠️ Échec du scan d\'enrichissement')
        }
      } catch (error) {
        console.error('❌ Erreur scan d\'enrichissement:', error)
      }
    }, ENRICHMENT_SCAN_DELAY_MS)
    
    console.log('⏰ Scan d\'enrichissement programmé dans 10 minutes')
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
   * Démarrer la surveillance du répertoire media (films + séries)
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      console.log('⚠️ Watcher déjà actif')
      return
    }

    console.log(`👁️ Démarrage surveillance:`)
    console.log(`   📁 Films: ${MEDIA_DIR}`)
    console.log(`   📁 Séries: ${SERIES_DIR}`)
    
    try {
      // Scanner d'abord pour connaître les fichiers existants
      await this.initialScan()
      
      // Surveiller le dossier films
      await this.watchRecursively(MEDIA_DIR)
      
      // Surveiller le dossier séries
      try {
        await stat(SERIES_DIR)
        await this.watchRecursively(SERIES_DIR)
        console.log(`📺 Surveillance séries activée`)
      } catch {
        console.log(`⚠️ Dossier séries non accessible: ${SERIES_DIR}`)
      }
      
      this.isWatching = true
      console.log(`✅ Surveillance active (${this.watchedDirs.size} dossiers, ${this.knownFiles.size} fichiers connus)`)
    } catch (error) {
      console.error('❌ Erreur démarrage watcher:', error)
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

      const filename = path.basename(filepath)
      const fileSize = (stats.size / (1024*1024*1024)).toFixed(2)
      
      // Détecter si c'est un épisode de série (fichier dans SERIES_DIR ou contient SxxExx)
      const isSeriesEpisode = filepath.startsWith(SERIES_DIR) || /S\d{1,2}E\d{1,2}/i.test(filename)
      
      if (isSeriesEpisode) {
        console.log(`📺 Nouvel épisode détecté: ${filename} (${fileSize} GB)`)
        
        // Déclencher un scan de la série
        await this.importSeriesEpisode(filepath)
      } else {
        console.log(`🎬 Nouveau film détecté: ${filename} (${fileSize} GB)`)
        
        // IMPORTER DANS LA BASE AVEC MÉTADONNÉES TMDB
        await this.importToDatabase(filepath, stats.size)
      }

      // Ajouter à la queue de transcodage (films et séries)
      const transcodingServiceModule = await import('./transcoding-service')
      const transcodingService = transcodingServiceModule.default
      
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
   * Importer un épisode de série (déclenche un scan de la série parente)
   */
  private async importSeriesEpisode(filepath: string): Promise<void> {
    try {
      const filename = path.basename(filepath)
      
      // Extraire le numéro de saison/épisode
      const episodeMatch = filename.match(/S(\d+)E(\d+)/i)
      if (!episodeMatch) {
        console.log(`⚠️ Pattern SxxExx non trouvé dans: ${filename}`)
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
      
      console.log(`📺 Série détectée: ${seriesName} (S${seasonNumber}E${episodeNumber})`)
      
      // Import dynamique pour éviter les dépendances circulaires
      const { supabase } = await import('./supabase')
      
      // Chercher la série existante par chemin local
      const { data: existingSeries } = await supabase
        .from('series')
        .select('id, title, tmdb_id')
        .eq('local_folder_path', seriesPath)
        .single()
      
      if (existingSeries) {
        console.log(`📁 Série trouvée: ${existingSeries.title} (ID: ${existingSeries.id})`)
        
        // Vérifier si l'épisode existe déjà
        const { data: existingEp } = await supabase
          .from('episodes')
          .select('id')
          .eq('series_id', existingSeries.id)
          .eq('season_number', seasonNumber)
          .eq('episode_number', episodeNumber)
          .single()
        
        if (existingEp) {
          console.log(`⏭️ Épisode déjà en base: S${seasonNumber}E${episodeNumber}`)
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
          filepath: filepath
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
            console.log(`✨ Métadonnées TMDB récupérées pour S${seasonNumber}E${episodeNumber}`)
          }
        }
        
        // Ajouter l'épisode
        const { error: epError } = await supabase.from('episodes').insert(episodeData)
        
        if (epError) {
          console.error(`❌ Erreur ajout épisode:`, epError.message)
        } else {
          const hasMetadata = episodeData.still_url ? '✨' : ''
          console.log(`✅ ${hasMetadata} Épisode ajouté: ${seriesName} S${seasonNumber}E${episodeNumber} - ${episodeData.title}`)
        }
        
        // Programmer un scan d'enrichissement différé (pour les autres épisodes potentiels)
        this.scheduleEnrichmentScan()
      } else {
        // Série pas encore en base - déclencher un scan complet
        console.log(`🔍 Série non trouvée, déclenchement du scan...`)
        
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
            console.error(`❌ Erreur création série:`, insertError?.message)
            return
          }
          
          console.log(`✅ Série créée: ${seriesName} (ID: ${newSeries.id})`)
          
          // Ajouter l'épisode
          const cleanTitle = this.cleanEpisodeTitle(filename, seriesName)
          await supabase.from('episodes').insert({
            series_id: newSeries.id,
            season_number: seasonNumber,
            episode_number: episodeNumber,
            title: cleanTitle,
            filepath: filepath
          })
          
          console.log(`✅ Épisode ajouté: ${seriesName} S${seasonNumber}E${episodeNumber}`)
          
          // Programmer un scan d'enrichissement différé (pour récupérer les métadonnées TMDB)
          this.scheduleEnrichmentScan()
        } catch (scanError) {
          console.error(`❌ Erreur lors du scan:`, scanError)
        }
      }
    } catch (error) {
      console.error(`❌ Erreur import épisode:`, error)
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
      console.log(`📥 Import automatique: ${filename}`)

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
        console.log(`⏭️ Déjà en base: ${filename}`)
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
          console.log(`🎬 TMDB match: ${mediaDetails?.title} (${mediaDetails?.release_date?.slice(0,4)})`)
        }
      } catch (tmdbError) {
        console.log(`⚠️ Pas de résultat TMDB pour: ${cleanName}`)
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
        updated_at: new Date().toISOString()
      }

      // Insérer en base
      const { error } = await supabase
        .from('media')
        .insert(mediaData)

      if (error) {
        console.error(`❌ Erreur insertion base: ${error.message}`)
      } else {
        console.log(`✅ Importé dans LEON: ${mediaData.title} ${mediaData.year ? `(${mediaData.year})` : ''}`)
        if (mediaData.poster_url) console.log(`   🖼️ Jaquette: OK`)
        if (mediaData.trailer_url) console.log(`   🎬 Bande-annonce: OK`)
        if (Object.keys(subtitles).length > 0) console.log(`   💬 Sous-titres: ${Object.keys(subtitles).join(', ')}`)
      }
    } catch (error) {
      console.error(`❌ Erreur import automatique:`, error)
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
    
    // Annuler le timer d'enrichissement
    if (this.enrichmentScanTimer) {
      clearTimeout(this.enrichmentScanTimer)
      this.enrichmentScanTimer = null
    }
    this.pendingEnrichment = false

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
