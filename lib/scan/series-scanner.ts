/**
 * Orchestration principale du scan de séries
 * Coordonne : filesystem scan, TMDB lookups, sauvegarde DB
 */

import fs from 'fs/promises'
import path from 'path'
import { supabase } from '@/lib/supabase'
import { invalidateMediaCaches } from '@/lib/cache-invalidation'
import type { TmdbEpisodeData, TmdbSeriesDetails, TmdbGenre, Episode } from './types'
import { getScanStateRef, completeScan } from './scan-state'
import { scanSeriesFolder } from './series-parser'
import { cleanEpisodeTitle } from './title-cleaner'

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// ─────────────────────────────────────────────
// TMDB API
// ─────────────────────────────────────────────

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
 * Rechercher une série sur TMDB et récupérer les détails complets
 */
/**
 * Wrapper fetch avec retry automatique sur rate limit TMDB (429)
 * Attend le délai indiqué dans le header Retry-After avant de réessayer
 */
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url)

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '10', 10)
      console.warn(`[SCAN] TMDB rate limit (429) — attente ${retryAfter}s avant retry ${attempt}/${maxRetries}`)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      continue
    }

    return response
  }

  throw new Error(`TMDB rate limit dépassé après ${maxRetries} tentatives`)
}

async function searchSeriesOnTMDB(seriesName: string): Promise<TmdbSeriesDetails | null> {
  if (!TMDB_API_KEY) return null

  try {
    const cleanName = seriesName
      .replace(/\(\d{4}\)/g, '') // Enlever l'année
      .replace(/[._-]/g, ' ')
      .trim()

    // 1. Rechercher la série
    const searchUrl = `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanName)}&language=fr-FR`
    const response = await fetchWithRetry(searchUrl)

    if (!response.ok) {
      console.error(`[SCAN] TMDB search HTTP ${response.status} pour "${cleanName}"`)
      return null
    }

    const data = await response.json()

    if (data.results && data.results.length > 0) {
      const seriesId = data.results[0].id

      // 2. Récupérer les détails complets (avec genres, vidéos pour les trailers)
      const detailsUrl = `${TMDB_BASE_URL}/tv/${seriesId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=videos`
      const detailsResponse = await fetchWithRetry(detailsUrl)

      if (!detailsResponse.ok) {
        console.error(`[SCAN] TMDB details HTTP ${detailsResponse.status} pour ID ${seriesId}`)
        return data.results[0]
      }

      const detailsData: TmdbSeriesDetails = await detailsResponse.json()

      if (detailsData && detailsData.id) {
        console.log(`[SCAN] Genres TMDB: ${detailsData.genres?.map((g: TmdbGenre) => g.name).join(', ') || 'aucun'}`)

        // Extraire le trailer YouTube (priorité: français, puis anglais)
        let trailer = detailsData.videos?.results?.find((v) =>
          v.type === 'Trailer' && v.site === 'YouTube'
        )

        // Fallback: chercher les vidéos en anglais si pas de trailer français
        if (!trailer) {
          try {
            const enVideosUrl = `${TMDB_BASE_URL}/tv/${seriesId}/videos?api_key=${TMDB_API_KEY}&language=en-US`
            const enVideosResponse = await fetchWithRetry(enVideosUrl)
            const enVideosData = await enVideosResponse.json()
            trailer = enVideosData.results?.find((v: { type: string; site: string }) =>
              v.type === 'Trailer' && v.site === 'YouTube'
            )
            if (trailer) {
              console.log(`[SCAN] Bande-annonce: trouvée (EN)`)
            }
          } catch {
            // Ignore l'erreur du fallback trailer EN
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

// ─────────────────────────────────────────────
// Sauvegarde DB : série sans TMDB
// ─────────────────────────────────────────────

/**
 * Sauvegarder une série sans données TMDB (uniquement titre + chemin local)
 * Retourne l'ID de la série ou null en cas d'erreur
 */
async function saveSeriesWithoutTmdb(
  seriesName: string,
  seriesPath: string,
  stats: { newSeries: number }
): Promise<string | null> {
  // Chercher d'abord par chemin local (plus fiable)
  // .limit(1) + maybeSingle() évite l'erreur si plusieurs lignes existent
  const { data: seriesByPath } = await supabase
    .from('series')
    .select('id')
    .eq('local_folder_path', seriesPath)
    .limit(1)
    .maybeSingle()

  if (seriesByPath) {
    console.log(`[SCAN] Série trouvée par chemin local (ID: ${seriesByPath.id})`)
    return seriesByPath.id
  }

  // Sinon chercher par titre (prend la première occurrence pour éviter les doublons)
  const { data: seriesByTitle } = await supabase
    .from('series')
    .select('id')
    .eq('title', seriesName)
    .limit(1)
    .maybeSingle()

  if (seriesByTitle) {
    console.log(`[SCAN] Série trouvée par titre (ID: ${seriesByTitle.id})`)
    return seriesByTitle.id
  }

  // Créer la série
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
    return null
  }

  console.log(`[SCAN] Série créée (ID: ${newSeries.id})`)
  stats.newSeries++
  return newSeries.id
}

/**
 * Sauvegarder les épisodes d'une série sans données TMDB
 */
async function saveEpisodesWithoutTmdb(
  episodes: Episode[],
  seriesId: string,
  seriesName: string,
  stats: { newEpisodes: number }
): Promise<void> {
  console.log(`[SCAN] Sauvegarde de ${episodes.length} épisodes...`)

  for (const ep of episodes) {
    const { data: existingEp } = await supabase
      .from('episodes')
      .select('id')
      .eq('series_id', seriesId)
      .eq('season_number', ep.season)
      .eq('episode_number', ep.episode)
      .limit(1)
      .maybeSingle()

    if (!existingEp) {
      const cleanTitle = cleanEpisodeTitle(ep.filename, seriesName)
      const { error: epError } = await supabase.from('episodes').insert({
        series_id: seriesId,
        season_number: ep.season,
        episode_number: ep.episode,
        title: cleanTitle,
        filepath: ep.filepath,
        is_transcoded: false // Masqué jusqu'à la fin du transcodage
      })

      if (epError) {
        console.error(`[SCAN] Erreur épisode S${ep.season}E${ep.episode}:`, epError.message)
      } else {
        stats.newEpisodes++
      }
    }
  }

  console.log(`[SCAN] ${stats.newEpisodes} nouveaux épisodes sauvegardés`)
}

// ─────────────────────────────────────────────
// Sauvegarde DB : série avec TMDB
// ─────────────────────────────────────────────

/**
 * Sauvegarder ou mettre à jour une série avec données TMDB
 * Retourne l'ID de la série ou null en cas d'erreur
 */
async function saveSeriesWithTmdb(
  seriesPath: string,
  seriesName: string,
  tmdbData: TmdbSeriesDetails,
  stats: { newSeries: number; updatedSeries: number }
): Promise<string | null> {
  // Chercher d'abord par chemin local (plus fiable pour les rescans)
  // .limit(1) + maybeSingle() résiste aux doublons éventuels en base
  const { data: seriesByPath } = await supabase
    .from('series')
    .select('id')
    .eq('local_folder_path', seriesPath)
    .limit(1)
    .maybeSingle()

  let existingSeries: { id: string } | null = seriesByPath || null

  if (!existingSeries) {
    // Sinon chercher par tmdb_id (prend la première occurrence)
    const { data: seriesByTmdb } = await supabase
      .from('series')
      .select('id')
      .eq('tmdb_id', tmdbData.id)
      .limit(1)
      .maybeSingle()

    if (seriesByTmdb) {
      existingSeries = seriesByTmdb
      console.log(`[SCAN] Série trouvée par TMDB ID (ID: ${seriesByTmdb.id})`)
    }
  } else {
    console.log(`[SCAN] Série trouvée par chemin local (ID: ${existingSeries.id})`)
  }

  const seriesPayload = {
    tmdb_id: tmdbData.id,
    title: tmdbData.name,
    original_title: tmdbData.original_name,
    overview: tmdbData.overview,
    poster_url: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : null,
    backdrop_url: tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}` : null,
    rating: tmdbData.vote_average,
    first_air_date: tmdbData.first_air_date,
    genres: tmdbData.genres?.map((g: TmdbGenre) => g.name) || [],
    trailer_url: tmdbData.trailer_url || null,
    local_folder_path: seriesPath
  }

  if (existingSeries) {
    // Récupérer les valeurs actuelles pour ne pas écraser les modifications admin
    const { data: currentData } = await supabase
      .from('series')
      .select('poster_url, backdrop_url, trailer_url')
      .eq('id', existingSeries.id)
      .limit(1)
      .maybeSingle()

    // Préserver les valeurs déjà définies (possiblement modifiées par l'admin)
    const safePayload = {
      ...seriesPayload,
      poster_url: currentData?.poster_url || seriesPayload.poster_url,
      backdrop_url: currentData?.backdrop_url || seriesPayload.backdrop_url,
      trailer_url: currentData?.trailer_url || seriesPayload.trailer_url,
      updated_at: new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('series')
      .update(safePayload)
      .eq('id', existingSeries.id)

    if (updateError) {
      console.error(`[SCAN] Erreur mise à jour série ${seriesName}:`, updateError.message)
      console.error(`[SCAN] Détails:`, JSON.stringify(updateError, null, 2))
      return null
    }

    console.log(`[SCAN] Série mise à jour (ID: ${existingSeries.id})`)
    stats.updatedSeries++
    return existingSeries.id
  }

  // Créer
  const { data: newSeries, error: insertError } = await supabase
    .from('series')
    .insert(seriesPayload)
    .select('id')
    .single()

  if (insertError || !newSeries) {
    console.error(`[SCAN] Erreur création série ${seriesName}:`, insertError?.message || 'newSeries est null')
    console.error(`[SCAN] Détails:`, JSON.stringify(insertError, null, 2))
    return null
  }

  console.log(`[SCAN] Série créée (ID: ${newSeries.id})`)
  stats.newSeries++
  return newSeries.id
}

/**
 * Sauvegarder les épisodes avec enrichissement TMDB
 */
async function saveEpisodesWithTmdb(
  episodes: Episode[],
  seriesId: string,
  seriesName: string,
  tmdbData: TmdbSeriesDetails,
  stats: { newEpisodes: number; enrichedEpisodes: number }
): Promise<void> {
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
      .limit(1)
      .maybeSingle()

    if (!existingEp) {
      // Récupérer les métadonnées TMDB de l'épisode
      const tmdbEpisode = tmdbData?.id
        ? await fetchTmdbEpisode(tmdbData.id, ep.season, ep.episode)
        : null

      const episodeData: Record<string, unknown> = {
        series_id: seriesId,
        tmdb_series_id: tmdbData?.id || null,
        season_number: ep.season,
        episode_number: ep.episode,
        title: tmdbEpisode?.name || cleanEpisodeTitle(ep.filename, seriesName),
        filepath: ep.filepath,
        is_transcoded: false // Masqué jusqu'à la fin du transcodage
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
      // Mettre à jour les épisodes existants sans métadonnées TMDB
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
}

// ─────────────────────────────────────────────
// Orchestration principale
// ─────────────────────────────────────────────

/**
 * Exécute le scan complet des séries (peut être appelé en sync ou async)
 * Modifie l'état global via getScanStateRef()
 */
export async function runScan(): Promise<void> {
  const state = getScanStateRef()

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
    state.progress.totalSeries = seriesNames.length

    const { stats } = state

    // 2. Scanner chaque série
    for (const seriesName of seriesNames) {
      // Mettre à jour l'état du scan
      state.currentSeries = seriesName
      state.progress.currentEpisode = null

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
        // Sans données TMDB
        console.log(`[SCAN] Non trouvé sur TMDB, création sans métadonnées...`)

        const seriesId = await saveSeriesWithoutTmdb(seriesName, seriesPath, stats)
        if (!seriesId) continue

        await saveEpisodesWithoutTmdb(episodes, seriesId, seriesName, stats)

        stats.totalSeries++
        stats.totalEpisodes += episodes.length
        scanState_incrementProcessed(state)
        continue
      }

      // Avec données TMDB
      console.log(`[SCAN] Trouvé sur TMDB (ID: ${tmdbData.id}) - ${tmdbData.name}`)
      console.log(`[SCAN] Sauvegarde dans la base...`)

      const seriesId = await saveSeriesWithTmdb(seriesPath, seriesName, tmdbData, stats)
      if (!seriesId) continue

      await saveEpisodesWithTmdb(episodes, seriesId, seriesName, tmdbData, stats)

      stats.totalSeries++
      stats.totalEpisodes += episodes.length

      // Incrémenter le compteur de progression
      scanState_incrementProcessed(state)
    }

    console.log('[SCAN] RÉSUMÉ DU SCAN SÉRIES')
    console.log(`[SCAN] Total séries: ${stats.totalSeries}`)
    console.log(`[SCAN] Nouvelles: ${stats.newSeries}`)
    console.log(`[SCAN] Mises à jour: ${stats.updatedSeries}`)
    console.log(`[SCAN] Total épisodes: ${stats.totalEpisodes}`)
    console.log(`[SCAN] Nouveaux épisodes: ${stats.newEpisodes}`)
    console.log(`[SCAN] Épisodes enrichis: ${stats.enrichedEpisodes}`)

    // Marquer le scan comme terminé et rafraîchir les caches
    completeScan()
    invalidateMediaCaches()
    console.log('[SCAN] Scan terminé avec succès')

  } catch (error) {
    console.error('[SCAN] Erreur scan séries:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    const errorStack = error instanceof Error ? error.stack : ''
    console.error('[SCAN] Stack:', errorStack)

    // Marquer l'erreur dans l'état
    state.error = errorMessage
    state.isRunning = false
    state.completedAt = new Date().toISOString()

    throw error
  }
}

/** Incrémenter le compteur de séries traitées */
function scanState_incrementProcessed(state: { progress: { processedSeries: number } }): void {
  state.progress.processedSeries++
}
