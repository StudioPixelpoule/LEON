/**
 * Import d'épisodes de séries dans la base de données.
 * - Détection du dossier série parent
 * - Récupération métadonnées TMDB par épisode
 * - Création automatique de la série si absente
 */

import path from 'path'
import { TMDB_API_KEY, TMDB_BASE_URL, SERIES_DIR } from './types'
import { cleanEpisodeTitle } from './filename-parser'
import { invalidateMediaCaches } from '@/lib/cache-invalidation'
import type { TmdbEpisodeMetadata } from './types'

/**
 * Récupérer les métadonnées TMDB d'un épisode.
 * Essaie en français d'abord, puis fallback en anglais.
 */
export async function fetchTmdbEpisodeMetadata(
  tmdbSeriesId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<TmdbEpisodeMetadata | null> {
  if (!TMDB_API_KEY) return null

  try {
    const baseUrl = `${TMDB_BASE_URL}/tv/${tmdbSeriesId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${TMDB_API_KEY}`

    const response = await fetch(`${baseUrl}&language=fr-FR`)
    let dataFr: TmdbEpisodeMetadata | null = null

    if (response.ok) {
      dataFr = await response.json()
      if (dataFr && (dataFr.overview || dataFr.still_path)) {
        return dataFr
      }
    }

    // Fallback anglais si FR echoue ou donnees FR incompletes
    const responseEn = await fetch(`${baseUrl}&language=en-US`)
    if (!responseEn.ok) return dataFr

    const dataEn: TmdbEpisodeMetadata = await responseEn.json()

    if (dataFr?.name) {
      return { ...dataEn, name: dataFr.name }
    }

    return dataEn
  } catch {
    return null
  }
}

/**
 * Importer un épisode de série dans la base de données.
 * Crée la série si elle n'existe pas encore.
 * 
 * @param filepath - Chemin complet du fichier épisode
 * @param onEnrichmentNeeded - Callback pour programmer un scan d'enrichissement différé
 */
export async function importSeriesEpisode(
  filepath: string,
  onEnrichmentNeeded: () => void
): Promise<void> {
  try {
    const filename = path.basename(filepath)

    // Extraire le numéro de saison/épisode
    const episodeMatch = filename.match(/S(\d+)E(\d+)/i)
    if (!episodeMatch) {
      return
    }

    const seasonNumber = parseInt(episodeMatch[1])
    const episodeNumber = parseInt(episodeMatch[2])

    // Trouver le dossier racine de la série.
    // Approche structurelle : remonter jusqu'au premier enfant de SERIES_DIR.
    // Fonctionne quelle que soit la structure de dossiers :
    //   /series/NomSerie/Season 1/fichier.mkv → NomSerie
    //   /series/NomSerie/NomSerie - Season 1/fichier.mkv → NomSerie
    //   /series/NomSerie/fichier.mkv → NomSerie
    const normalizedSeriesDir = path.resolve(SERIES_DIR)
    let seriesPath = path.dirname(filepath)
    let seriesName = path.basename(seriesPath)

    // Remonter tant qu'on n'est pas un enfant direct de SERIES_DIR
    while (
      path.resolve(path.dirname(seriesPath)) !== normalizedSeriesDir &&
      path.resolve(seriesPath) !== normalizedSeriesDir
    ) {
      seriesPath = path.dirname(seriesPath)
      seriesName = path.basename(seriesPath)
    }

    // Import dynamique pour éviter les dépendances circulaires
    const { supabase } = await import('../supabase')

    // Chercher la série existante par chemin local OU par titre
    const { data: seriesByPath } = await supabase
      .from('series')
      .select('id, title, tmdb_id')
      .eq('local_folder_path', seriesPath)
      .limit(1)
      .maybeSingle()

    const existingSeries = seriesByPath || await (async () => {
      const { data: seriesByTitle } = await supabase
        .from('series')
        .select('id, title, tmdb_id')
        .eq('title', seriesName)
        .limit(1)
        .maybeSingle()
      return seriesByTitle
    })()

    if (existingSeries) {
      await addEpisodeToExistingSeries(
        existingSeries,
        filepath,
        filename,
        seriesName,
        seasonNumber,
        episodeNumber,
        onEnrichmentNeeded
      )
    } else {
      await createSeriesAndAddEpisode(
        seriesName,
        seriesPath,
        filepath,
        filename,
        seasonNumber,
        episodeNumber,
        onEnrichmentNeeded
      )
    }
  } catch (error) {
    console.error(`[WATCHER] Erreur import épisode:`, error)
  }
}

/**
 * Ajouter un épisode à une série existante en BDD.
 */
async function addEpisodeToExistingSeries(
  existingSeries: { id: string; title: string; tmdb_id: number | null },
  filepath: string,
  filename: string,
  seriesName: string,
  seasonNumber: number,
  episodeNumber: number,
  onEnrichmentNeeded: () => void
): Promise<void> {
  const { supabase } = await import('../supabase')

  // Vérifier si l'épisode existe déjà
  const { data: existingEp } = await supabase
    .from('episodes')
    .select('id')
    .eq('series_id', existingSeries.id)
    .eq('season_number', seasonNumber)
    .eq('episode_number', episodeNumber)
    .limit(1)
    .maybeSingle()

  if (existingEp) {
    return
  }

  // Préparer les données de l'épisode
  const cleanTitle = cleanEpisodeTitle(filename, seriesName)

  // Vérifier si déjà transcodé sur disque
  let alreadyTranscoded = false
  try {
    const transcodingModule = await import('../transcoding-service')
    const transcodedPath = await transcodingModule.default.getTranscodedPath(filepath)
    if (transcodedPath) {
      alreadyTranscoded = true
      console.log(`[WATCHER] Épisode S${seasonNumber}E${episodeNumber} déjà transcodé sur disque → is_transcoded=true dès l'import`)
    }
  } catch {
    // syncTranscodedStatus rattrapera
  }

  const episodeData: Record<string, unknown> = {
    series_id: existingSeries.id,
    tmdb_series_id: existingSeries.tmdb_id,
    season_number: seasonNumber,
    episode_number: episodeNumber,
    title: cleanTitle,
    filepath: filepath,
    is_transcoded: alreadyTranscoded
  }

  // Récupérer les métadonnées TMDB si la série a un tmdb_id
  if (existingSeries.tmdb_id) {
    const tmdbEpisode = await fetchTmdbEpisodeMetadata(
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
  } else {
    console.log(`[WATCHER] Épisode importé: ${existingSeries.title} S${seasonNumber}E${episodeNumber} — is_transcoded: ${alreadyTranscoded}`)
    invalidateMediaCaches()
  }

  onEnrichmentNeeded()
}

// Lock en mémoire pour éviter la création simultanée de séries
const seriesCreationLocks = new Map<string, Promise<string | null>>()

/**
 * Créer une nouvelle série en BDD et ajouter le premier épisode.
 * Utilise un lock en mémoire pour éviter les doublons en cas d'appels concurrents.
 */
async function createSeriesAndAddEpisode(
  seriesName: string,
  seriesPath: string,
  filepath: string,
  filename: string,
  seasonNumber: number,
  episodeNumber: number,
  onEnrichmentNeeded: () => void
): Promise<void> {
  try {
    const { supabase } = await import('../supabase')

    // Attendre si une création est déjà en cours pour cette série
    const existingLock = seriesCreationLocks.get(seriesPath)
    if (existingLock) {
      const existingId = await existingLock
      if (existingId) {
        // La série a été créée par un autre appel concurrent → l'utiliser
        const { data: series } = await supabase
          .from('series')
          .select('id, title, tmdb_id')
          .eq('id', existingId)
          .limit(1)
          .maybeSingle()

        if (series) {
          await addEpisodeToExistingSeries(series, filepath, filename, seriesName, seasonNumber, episodeNumber, onEnrichmentNeeded)
          return
        }
      }
    }

    // Créer un lock pour cette série
    let resolveLock: (id: string | null) => void
    const lockPromise = new Promise<string | null>(resolve => { resolveLock = resolve })
    seriesCreationLocks.set(seriesPath, lockPromise)

    // Dernière vérification avant création (la série a pu être créée entre-temps)
    const { data: raceCheck } = await supabase
      .from('series')
      .select('id, title, tmdb_id')
      .or(`local_folder_path.eq.${seriesPath},title.eq.${seriesName}`)
      .limit(1)
      .maybeSingle()

    if (raceCheck) {
      resolveLock!(raceCheck.id)
      seriesCreationLocks.delete(seriesPath)
      await addEpisodeToExistingSeries(raceCheck, filepath, filename, seriesName, seasonNumber, episodeNumber, onEnrichmentNeeded)
      return
    }

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
      resolveLock!(null)
      seriesCreationLocks.delete(seriesPath)
      return
    }

    resolveLock!(newSeries.id)
    // Nettoyer le lock après 30s (les rafales sont passées)
    setTimeout(() => seriesCreationLocks.delete(seriesPath), 30000)

    // Vérifier si déjà transcodé sur disque
    const cleanTitle = cleanEpisodeTitle(filename, seriesName)
    let epAlreadyTranscoded = false
    try {
      const transcodingModule = await import('../transcoding-service')
      const transcodedPath = await transcodingModule.default.getTranscodedPath(filepath)
      if (transcodedPath) {
        epAlreadyTranscoded = true
        console.log(`[WATCHER] Nouvel épisode S${seasonNumber}E${episodeNumber} déjà transcodé sur disque`)
      }
    } catch {
      // syncTranscodedStatus rattrapera
    }

    await supabase.from('episodes').insert({
      series_id: newSeries.id,
      season_number: seasonNumber,
      episode_number: episodeNumber,
      title: cleanTitle,
      filepath: filepath,
      is_transcoded: epAlreadyTranscoded
    })

    invalidateMediaCaches()
    onEnrichmentNeeded()
  } catch (scanError) {
    console.error(`[WATCHER] Erreur lors du scan:`, scanError)
  }
}
