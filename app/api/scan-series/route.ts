/**
 * API: Scanner les séries TV sur le NAS
 * POST /api/scan-series - Lance le scan (arrière-plan si ?background=true)
 * GET /api/scan-series - Récupère le statut du scan en cours
 * 
 * Structure attendue:
 * /leon/media/series/
 *   ├── Breaking Bad/
 *   │   ├── Season 1/
 *   │   │   ├── Breaking Bad S01E01.mkv
 *   │   │   └── Breaking Bad S01E02.mkv
 *   │   └── Season 2/
 *   │       └── Breaking Bad S02E01.mkv
 *   └── Game of Thrones/
 *       └── Season 1/
 *           └── GOT S01E01.mkv
 */

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'
import fs from 'fs/promises'
import path from 'path'

interface Episode {
  filename: string
  filepath: string
  season: number
  episode: number
  seriesName: string
}

interface TmdbEpisodeData {
  name: string
  overview: string
  still_path: string | null
  air_date: string | null
  vote_average: number
  runtime: number | null
}

// État global du scan (persiste entre les requêtes)
interface ScanState {
  isRunning: boolean
  startedAt: string | null
  currentSeries: string | null
  progress: {
    totalSeries: number
    processedSeries: number
    currentEpisode: string | null
  }
  stats: {
    totalSeries: number
    totalEpisodes: number
    newSeries: number
    updatedSeries: number
    newEpisodes: number
    enrichedEpisodes: number
  }
  error: string | null
  completedAt: string | null
}

// Singleton pour l'état du scan
const scanState: ScanState = {
  isRunning: false,
  startedAt: null,
  currentSeries: null,
  progress: {
    totalSeries: 0,
    processedSeries: 0,
    currentEpisode: null
  },
  stats: {
    totalSeries: 0,
    totalEpisodes: 0,
    newSeries: 0,
    updatedSeries: 0,
    newEpisodes: 0,
    enrichedEpisodes: 0
  },
  error: null,
  completedAt: null
}

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.m4v']
const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

/**
 * GET: Récupérer le statut du scan en cours
 */
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authErrorResponse(authError, 403)
  
  return NextResponse.json({
    success: true,
    scan: { ...scanState }
  })
}

/**
 * Récupérer les métadonnées d'un épisode depuis TMDB
 */
async function fetchTmdbEpisode(
  tmdbSeriesId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<TmdbEpisodeData | null> {
  if (!TMDB_API_KEY) return null
  
  try {
    // Essayer d'abord en français
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
 * Nettoyer le titre d'un épisode
 * "Bref - S01E01 - Bref. J'ai dragué cette fille x265-Amen.mkv" 
 * → "J'ai dragué cette fille"
 */
function cleanEpisodeTitle(filename: string, seriesName: string): string {
  let title = filename
  
  // 1. Retirer l'extension
  title = title.replace(/\.(mkv|mp4|avi|mov|m4v)$/i, '')
  
  // 2. Retirer les infos de codec/release (x264, x265, HEVC, etc.)
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
  
  // 3. Retirer les noms de release groups courants
  title = title.replace(/-[A-Za-z0-9]+$/g, '') // -Amen, -NTb, etc.
  title = title.replace(/\[.*?\]/g, '') // [YTS.MX], etc.
  
  // 4. Retirer le pattern SxxExx
  title = title.replace(/S\d+E\d+/gi, '')
  
  // 5. Retirer le nom de la série (au début ou après un tiret)
  const seriesNameClean = seriesName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  title = title.replace(new RegExp(`^${seriesNameClean}[\\s.-]*`, 'i'), '')
  title = title.replace(new RegExp(`[\\s.-]+${seriesNameClean}[\\s.-]*`, 'i'), '')
  
  // 6. Retirer le nom de série répété (ex: "Bref. J'ai..." → "J'ai...")
  // Pattern spécifique pour "Bref." au début
  title = title.replace(/^Bref\.\s*/i, '')
  
  // 7. Nettoyer les tirets/points/underscores en trop
  title = title.replace(/^[\s._-]+/, '') // Au début
  title = title.replace(/[\s._-]+$/, '') // À la fin
  title = title.replace(/\s{2,}/g, ' ')  // Espaces multiples
  
  // 8. Si le titre est vide, utiliser un format par défaut
  if (!title.trim()) {
    // Essayer d'extraire le numéro d'épisode du filename original
    const match = filename.match(/S(\d+)E(\d+)/i)
    if (match) {
      title = `Épisode ${parseInt(match[2])}`
    } else {
      title = filename.replace(/\.(mkv|mp4|avi|mov|m4v)$/i, '')
    }
  }
  
  return title.trim()
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authErrorResponse(authError, 403)
  
  // Vérifier si un scan est déjà en cours
  if (scanState.isRunning) {
    return NextResponse.json({
      success: false,
      error: 'Un scan est déjà en cours',
      scan: { ...scanState }
    }, { status: 409 })
  }

  // Mode background via query param
  const url = new URL(request.url)
  const backgroundMode = url.searchParams.get('background') === 'true'

  // Reset l'état
  scanState.isRunning = true
  scanState.startedAt = new Date().toISOString()
  scanState.currentSeries = null
  scanState.progress = { totalSeries: 0, processedSeries: 0, currentEpisode: null }
  scanState.stats = { totalSeries: 0, totalEpisodes: 0, newSeries: 0, updatedSeries: 0, newEpisodes: 0, enrichedEpisodes: 0 }
  scanState.error = null
  scanState.completedAt = null

  // Si mode background, lancer le scan et retourner immédiatement
  if (backgroundMode) {
    // Lancer le scan en arrière-plan (sans await)
    runScanInBackground().catch(err => {
      console.error('[SCAN] Erreur scan background:', err)
      scanState.error = err instanceof Error ? err.message : 'Erreur inconnue'
      scanState.isRunning = false
      scanState.completedAt = new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Scan démarré en arrière-plan',
      scan: { ...scanState }
    })
  }

  // Mode synchrone (pour les appels locaux sans Cloudflare)
  try {
    await runScanInBackground()
    return NextResponse.json({
      success: true,
      stats: scanState.stats
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({
      success: false,
      error: errorMessage,
      stats: scanState.stats
    }, { status: 500 })
  }
}

/**
 * Exécute le scan des séries (peut être appelé en sync ou async)
 */
async function runScanInBackground() {
  try {
    const seriesBasePath = process.env.PCLOUD_SERIES_PATH || '/leon/media/series'
    
    console.log('[SCAN] Démarrage du scan des séries...')
    console.log(`[SCAN] Dossier: ${seriesBasePath}`)

    // Vérifier que le dossier existe
    try {
      await fs.access(seriesBasePath)
    } catch {
      throw new Error(`Dossier introuvable: ${seriesBasePath}. Vérifiez que le volume est monté.`)
    }

    // 1. Lister tous les dossiers de séries
    const seriesFolders = await fs.readdir(seriesBasePath, { withFileTypes: true })
    const seriesNames = seriesFolders
      .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
      .map(dirent => dirent.name)

    console.log(`[SCAN] ${seriesNames.length} séries trouvées`)
    scanState.progress.totalSeries = seriesNames.length

    const stats = scanState.stats

    // 2. Scanner chaque série
    for (const seriesName of seriesNames) {
      // Mettre à jour l'état du scan
      scanState.currentSeries = seriesName
      scanState.progress.currentEpisode = null
      
      console.log(`[SCAN] Analyse: ${seriesName}`)
      
      const seriesPath = path.join(seriesBasePath, seriesName)
      
      // Extraire tous les épisodes
      const episodes = await scanSeriesFolder(seriesPath, seriesName)
      
      console.log(`[SCAN] ${episodes.length} épisodes détectés`)
      
      if (episodes.length === 0) {
        console.warn(`[SCAN] Aucun épisode trouvé pour ${seriesName}`)
        continue
      }

      // 3. Rechercher la série sur TMDB
      console.log(`[SCAN] Recherche TMDB pour: "${seriesName}"`)
      const tmdbData = await searchSeriesOnTMDB(seriesName)

      if (!tmdbData) {
        console.log(`[SCAN] Non trouvé sur TMDB, création sans métadonnées...`)
        
        // Chercher d'abord par chemin local (plus fiable)
        let existingSeriesNoTmdb: { id: string } | null = null
        
        const { data: seriesByPath } = await supabase
          .from('series')
          .select('id')
          .eq('local_folder_path', seriesPath)
          .single()
        
        if (seriesByPath) {
          existingSeriesNoTmdb = seriesByPath
          console.log(`[SCAN] Série trouvée par chemin local (ID: ${seriesByPath.id})`)
        } else {
          // Sinon chercher par titre
          const { data: seriesByTitle } = await supabase
            .from('series')
            .select('id')
            .eq('title', seriesName)
            .single()
          
          if (seriesByTitle) {
            existingSeriesNoTmdb = seriesByTitle
            console.log(`[SCAN] Série trouvée par titre (ID: ${seriesByTitle.id})`)
          }
        }
        
        let seriesId: string
        
        if (!existingSeriesNoTmdb) {
          const { data: newSeries, error: insertError } = await supabase
            .from('series')
            .insert({
              title: seriesName,
              local_folder_path: seriesPath
            })
            .select('id')
            .single()
          
          if (insertError || !newSeries) {
            console.error(`[SCAN] Erreur création série ${seriesName}:`, insertError?.message || 'newSeries est null')
            console.error(`[SCAN] Détails erreur:`, JSON.stringify(insertError, null, 2))
            continue
          }
          
          console.log(`[SCAN] Série créée (ID: ${newSeries.id})`)
          seriesId = newSeries.id
          stats.newSeries++
        } else {
          seriesId = existingSeriesNoTmdb.id
          console.log(`[SCAN] Série existante utilisée (ID: ${seriesId})`)
        }
        
        // Sauvegarder les épisodes
        console.log(`[SCAN] Sauvegarde de ${episodes.length} épisodes...`)
        for (const ep of episodes) {
          const { data: existingEp } = await supabase
            .from('episodes')
            .select('id')
            .eq('series_id', seriesId)
            .eq('season_number', ep.season)
            .eq('episode_number', ep.episode)
            .single()

        if (!existingEp) {
          const cleanTitle = cleanEpisodeTitle(ep.filename, seriesName)
          const { error: epError } = await supabase.from('episodes').insert({
            series_id: seriesId,
            season_number: ep.season,
            episode_number: ep.episode,
            title: cleanTitle,
            filepath: ep.filepath
          })
            
            if (epError) {
              console.error(`[SCAN] Erreur épisode S${ep.season}E${ep.episode}:`, epError.message)
            } else {
              stats.newEpisodes++
            }
          }
        }
        
        console.log(`[SCAN] ${stats.newEpisodes} nouveaux épisodes sauvegardés`)
        stats.totalSeries++
        stats.totalEpisodes += episodes.length
        continue
      }

      console.log(`[SCAN] Trouvé sur TMDB (ID: ${tmdbData.id}) - ${tmdbData.name}`)

      // 4. Sauvegarder la série
      console.log(`[SCAN] Sauvegarde dans la base...`)
      
      // Chercher d'abord par chemin local (plus fiable pour les rescans)
      let existingSeries: { id: string } | null = null
      
      const { data: seriesByPath } = await supabase
        .from('series')
        .select('id')
        .eq('local_folder_path', seriesPath)
        .single()
      
      if (seriesByPath) {
        existingSeries = seriesByPath
        console.log(`[SCAN] Série trouvée par chemin local (ID: ${seriesByPath.id})`)
      } else {
        // Sinon chercher par tmdb_id
        const { data: seriesByTmdb } = await supabase
          .from('series')
          .select('id')
          .eq('tmdb_id', tmdbData.id)
          .single()
        
        if (seriesByTmdb) {
          existingSeries = seriesByTmdb
          console.log(`[SCAN] Série trouvée par TMDB ID (ID: ${seriesByTmdb.id})`)
        }
      }

      let seriesId: string

      if (existingSeries) {
        // Mettre à jour (incluant tmdb_id, genres et trailer depuis TMDB)
        const { error: updateError } = await supabase
          .from('series')
          .update({
            tmdb_id: tmdbData.id, // 🔑 Important pour le lien TMDB
            title: tmdbData.name,
            original_title: tmdbData.original_name,
            overview: tmdbData.overview,
            poster_url: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : null,
            backdrop_url: tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}` : null,
            rating: tmdbData.vote_average,
            first_air_date: tmdbData.first_air_date,
            genres: tmdbData.genres?.map((g: any) => g.name) || [],
            trailer_url: tmdbData.trailer_url || null, // 🎬 Bande-annonce
            local_folder_path: seriesPath,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSeries.id)

        if (updateError) {
          console.error(`[SCAN] Erreur mise à jour série ${seriesName}:`, updateError.message)
          console.error(`[SCAN] Détails:`, JSON.stringify(updateError, null, 2))
          continue
        }

        console.log(`[SCAN] Série mise à jour (ID: ${existingSeries.id})`)
        seriesId = existingSeries.id
        stats.updatedSeries++
      } else {
        // Créer avec toutes les métadonnées TMDB
        const { data: newSeries, error: insertError } = await supabase
          .from('series')
          .insert({
            tmdb_id: tmdbData.id,
            title: tmdbData.name,
            original_title: tmdbData.original_name,
            overview: tmdbData.overview,
            poster_url: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : null,
            backdrop_url: tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}` : null,
            rating: tmdbData.vote_average,
            first_air_date: tmdbData.first_air_date,
            genres: tmdbData.genres?.map((g: any) => g.name) || [],
            trailer_url: tmdbData.trailer_url || null, // 🎬 Bande-annonce
            local_folder_path: seriesPath
          })
          .select('id')
          .single()

        if (insertError || !newSeries) {
          console.error(`[SCAN] Erreur création série ${seriesName}:`, insertError?.message || 'newSeries est null')
          console.error(`[SCAN] Détails:`, JSON.stringify(insertError, null, 2))
          continue
        }

        console.log(`[SCAN] Série créée (ID: ${newSeries.id})`)
        seriesId = newSeries.id
        stats.newSeries++
      }

      // 5. Sauvegarder les épisodes
      console.log(`[SCAN] Sauvegarde de ${episodes.length} épisodes...`)
      let episodesSaved = 0
      let episodesUpdated = 0
      for (const ep of episodes) {
        const { data: existingEp } = await supabase
          .from('episodes')
          .select('id, still_url, overview')
          .eq('series_id', seriesId)
          .eq('season_number', ep.season)
          .eq('episode_number', ep.episode)
          .single()

        if (!existingEp) {
          // 🎬 Récupérer les métadonnées TMDB de l'épisode
          const tmdbEpisode = tmdbData?.id 
            ? await fetchTmdbEpisode(tmdbData.id, ep.season, ep.episode)
            : null
          
          const episodeData: Record<string, unknown> = {
            series_id: seriesId,
            tmdb_series_id: tmdbData?.id || null,
            season_number: ep.season,
            episode_number: ep.episode,
            title: tmdbEpisode?.name || cleanEpisodeTitle(ep.filename, seriesName),
            filepath: ep.filepath
          }
          
          // Ajouter les données TMDB si disponibles
          if (tmdbEpisode) {
            if (tmdbEpisode.overview) episodeData.overview = tmdbEpisode.overview
            if (tmdbEpisode.still_path) episodeData.still_url = `https://image.tmdb.org/t/p/w500${tmdbEpisode.still_path}`
            if (tmdbEpisode.air_date) episodeData.air_date = tmdbEpisode.air_date
            if (tmdbEpisode.vote_average) episodeData.rating = tmdbEpisode.vote_average
            if (tmdbEpisode.runtime) episodeData.runtime = tmdbEpisode.runtime
          }
          
          const { error: epError } = await supabase.from('episodes').insert(episodeData)
          
          if (epError) {
            console.error(`[SCAN] Erreur épisode S${ep.season}E${ep.episode}:`, epError.message)
          } else {
            if (tmdbEpisode) {
              console.log(`[SCAN] S${ep.season}E${ep.episode}: ${episodeData.title} (avec métadonnées)`)
            }
            stats.newEpisodes++
            episodesSaved++
          }
          
          // Petite pause pour éviter le rate limiting TMDB
          if (tmdbData?.id) await new Promise(r => setTimeout(r, 50))
        } else if (tmdbData?.id && (!existingEp.still_url || !existingEp.overview)) {
          // 🔄 Mettre à jour les épisodes existants sans métadonnées TMDB
          const tmdbEpisode = await fetchTmdbEpisode(tmdbData.id, ep.season, ep.episode)
          
          if (tmdbEpisode) {
            const updateData: Record<string, unknown> = {}
            
            if (!existingEp.still_url && tmdbEpisode.still_path) {
              updateData.still_url = `https://image.tmdb.org/t/p/w500${tmdbEpisode.still_path}`
            }
            if (!existingEp.overview && tmdbEpisode.overview) {
              updateData.overview = tmdbEpisode.overview
            }
            if (tmdbEpisode.air_date) updateData.air_date = tmdbEpisode.air_date
            if (tmdbEpisode.vote_average) updateData.rating = tmdbEpisode.vote_average
            if (tmdbEpisode.runtime) updateData.runtime = tmdbEpisode.runtime
            
            if (Object.keys(updateData).length > 0) {
              const { error: updateError } = await supabase
                .from('episodes')
                .update(updateData)
                .eq('id', existingEp.id)
              
              if (!updateError) {
                console.log(`[SCAN] S${ep.season}E${ep.episode}: métadonnées enrichies`)
                episodesUpdated++
              }
            }
          }
          
          await new Promise(r => setTimeout(r, 50))
        }
      }
      
      console.log(`[SCAN] ${episodesSaved} nouveaux épisodes, ${episodesUpdated} enrichis`)
      
      // Mettre à jour les stats enrichies
      stats.enrichedEpisodes = (stats.enrichedEpisodes || 0) + episodesUpdated

      stats.totalSeries++
      stats.totalEpisodes += episodes.length
      
      // Incrémenter le compteur de progression
      scanState.progress.processedSeries++
    }

    console.log('[SCAN] RÉSUMÉ DU SCAN SÉRIES')
    console.log(`[SCAN] Total séries: ${stats.totalSeries}`)
    console.log(`[SCAN] Nouvelles: ${stats.newSeries}`)
    console.log(`[SCAN] Mises à jour: ${stats.updatedSeries}`)
    console.log(`[SCAN] Total épisodes: ${stats.totalEpisodes}`)
    console.log(`[SCAN] Nouveaux épisodes: ${stats.newEpisodes}`)
    console.log(`[SCAN] Épisodes enrichis: ${stats.enrichedEpisodes}`)

    // Marquer le scan comme terminé
    scanState.isRunning = false
    scanState.currentSeries = null
    scanState.completedAt = new Date().toISOString()
    console.log('[SCAN] Scan terminé avec succès')

  } catch (error) {
    console.error('[SCAN] Erreur scan séries:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    const errorStack = error instanceof Error ? error.stack : ''
    console.error('[SCAN] Stack:', errorStack)
    
    // Marquer l'erreur dans l'état
    scanState.error = errorMessage
    scanState.isRunning = false
    scanState.completedAt = new Date().toISOString()
    
    throw error
  }
}

/**
 * Scanner récursivement un dossier de série pour trouver tous les épisodes
 * Gère 2 cas :
 * 1. Fichiers directement dans le dossier série (ex: Chernobyl/Chernobyl.S01E01.mkv)
 * 2. Fichiers dans des sous-dossiers (ex: Better Call Saul/Better Call Saul S01/episode.mkv)
 */
async function scanSeriesFolder(seriesPath: string, seriesName: string): Promise<Episode[]> {
  const episodes: Episode[] = []

  async function scanDirectory(dirPath: string, depth: number = 0) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        // Ignorer les fichiers cachés
        if (entry.name.startsWith('.')) continue

        const fullPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
          // Scanner les sous-dossiers (limiter à 2 niveaux de profondeur)
          if (depth < 2) {
            await scanDirectory(fullPath, depth + 1)
          }
        } else {
          // C'est un fichier
          const ext = path.extname(entry.name).toLowerCase()
          if (VIDEO_EXTENSIONS.includes(ext)) {
            // Extraire S01E01 du nom de fichier
            const episodeMatch = entry.name.match(/S(\d+)E(\d+)/i)
            if (episodeMatch) {
                episodes.push({
                filename: entry.name,
                filepath: fullPath,
                season: parseInt(episodeMatch[1]),
                episode: parseInt(episodeMatch[2]),
                seriesName
              })
            }
          }
        }
      }
    } catch (error) {
      console.error(`[SCAN] Erreur lecture dossier ${dirPath}:`, error)
    }
  }

  await scanDirectory(seriesPath, 0)
  
  return episodes.sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season
    return a.episode - b.episode
  })
}

/**
 * Rechercher une série sur TMDB
 */
async function searchSeriesOnTMDB(seriesName: string): Promise<any | null> {
  const TMDB_API_KEY = process.env.TMDB_API_KEY
  if (!TMDB_API_KEY) return null

  try {
    const cleanName = seriesName
      .replace(/\(\d{4}\)/g, '') // Enlever l'année
      .replace(/[._-]/g, ' ')
      .trim()

    // 1. Rechercher la série
    const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanName)}&language=fr-FR`
    const response = await fetch(searchUrl)
    const data = await response.json()

    if (data.results && data.results.length > 0) {
      const seriesId = data.results[0].id
      
      // 2. Récupérer les détails complets (avec genres, vidéos pour les trailers)
      const detailsUrl = `https://api.themoviedb.org/3/tv/${seriesId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=videos`
      const detailsResponse = await fetch(detailsUrl)
      const detailsData = await detailsResponse.json()
      
      if (detailsData && detailsData.id) {
        console.log(`[SCAN] Genres TMDB: ${detailsData.genres?.map((g: any) => g.name).join(', ') || 'aucun'}`)
        
        // Extraire le trailer YouTube (priorité: français, puis anglais)
        let trailer = detailsData.videos?.results?.find((v: { type: string; site: string }) => 
          v.type === 'Trailer' && v.site === 'YouTube'
        )
        
        // Fallback: chercher les vidéos en anglais si pas de trailer français
        if (!trailer) {
          try {
            const enVideosUrl = `https://api.themoviedb.org/3/tv/${seriesId}/videos?api_key=${TMDB_API_KEY}&language=en-US`
            const enVideosResponse = await fetch(enVideosUrl)
            const enVideosData = await enVideosResponse.json()
            trailer = enVideosData.results?.find((v: { type: string; site: string }) => 
              v.type === 'Trailer' && v.site === 'YouTube'
            )
            if (trailer) {
              console.log(`[SCAN] Bande-annonce: trouvée (EN)`)
            }
          } catch (e) {
            // Ignore l'erreur du fallback
          }
        } else {
          console.log(`[SCAN] Bande-annonce: trouvée`)
        }
        
        if (trailer) {
          detailsData.trailer_url = `https://www.youtube.com/watch?v=${trailer.key}`
        }
        
        return detailsData
      }
      
      return data.results[0]
    }

    return null
  } catch (error) {
    console.error('[SCAN] Erreur recherche TMDB:', error)
    return null
  }
}

