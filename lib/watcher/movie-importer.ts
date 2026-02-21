/**
 * Import de films dans la base de données.
 * - Recherche TMDB automatique
 * - Détection sous-titres locaux
 * - Marquage is_transcoded pour fichiers pré-transcodés
 */

import path from 'path'

/**
 * Importer un fichier film dans la base de données avec métadonnées TMDB.
 */
export async function importMovieToDatabase(filepath: string, fileSize: number): Promise<void> {
  try {
    const filename = path.basename(filepath)

    // Imports dynamiques pour éviter les dépendances circulaires
    const { supabase } = await import('../supabase')
    const { searchMovie, getMovieDetails, getTMDBImageUrl, getYearFromDate } = await import('../tmdb')
    const { findLocalSubtitles, formatFileSize, detectVideoQuality } = await import('../localScanner')
    const { sanitizeFilename } = await import('../media-recognition/filenameSanitizer')

    // Vérifier si le fichier existe déjà en base
    const { data: existing } = await supabase
      .from('media')
      .select('id')
      .eq('pcloud_fileid', filepath)
      .limit(1)
      .maybeSingle()

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
    } catch {
      // Pas de résultat TMDB — on continue sans métadonnées
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
      is_transcoded: false // Sera mis à true par markAsTranscoded après transcodage
    }

    // Vérifier si le fichier est déjà transcodé sur disque
    // (cas fréquent : redémarrage du conteneur avec des fichiers pré-transcodés)
    try {
      const transcodingModule = await import('../transcoding-service')
      const transcodedPath = await transcodingModule.default.getTranscodedPath(filepath)
      if (transcodedPath) {
        mediaData.is_transcoded = true
        console.log(`[WATCHER] Film déjà transcodé sur disque → is_transcoded=true dès l'import`)
      }
    } catch {
      // Pas grave si la vérification échoue, syncTranscodedStatus rattrapera
    }

    // Insérer en base
    const { error } = await supabase
      .from('media')
      .insert(mediaData)

    if (error) {
      console.error(`[WATCHER] Erreur insertion base ${filename}: ${error.message}`)
    } else {
      console.log(`[WATCHER] Film importé en BDD: ${mediaData.title}${mediaData.year ? ` (${mediaData.year})` : ''} — is_transcoded: ${mediaData.is_transcoded} — pcloud_fileid: ${filepath}`)
    }
  } catch (error) {
    console.error(`[WATCHER] Erreur import automatique:`, error instanceof Error ? error.message : error)
  }
}

/**
 * Force is_transcoded = true en BDD pour un fichier déjà transcodé sur disque.
 * Appelé quand addToQueue retourne null (fichier déjà transcodé).
 * Gère les films ET les épisodes.
 */
export async function forceMarkAsTranscoded(filepath: string): Promise<void> {
  const filename = path.basename(filepath)
  try {
    const { supabase } = await import('../supabase')
    const isSeries = filepath.includes('/series/') || /S\d{1,2}E\d{1,2}/i.test(filename)

    if (isSeries) {
      // Épisode : chercher par filepath exact
      const { data, error } = await supabase
        .from('episodes')
        .update({ is_transcoded: true })
        .eq('filepath', filepath)
        .select('id, season_number, episode_number')

      if (error) {
        console.error(`[WATCHER] forceMarkAsTranscoded épisode erreur:`, error.message)
      } else if (data && data.length > 0) {
        console.log(`[WATCHER] Épisode S${data[0].season_number}E${data[0].episode_number} → is_transcoded=true (déjà transcodé)`)
      } else {
        // Fallback par ilike
        const { data: fallback } = await supabase
          .from('episodes')
          .update({ is_transcoded: true })
          .ilike('filepath', `%${filename}%`)
          .select('id')
        if (fallback && fallback.length > 0) {
          console.log(`[WATCHER] Épisode (fallback) → is_transcoded=true`)
        } else {
          console.warn(`[WATCHER] Épisode non trouvé en BDD pour forceMarkAsTranscoded: ${filename}`)
        }
      }
    } else {
      // Film : chercher par pcloud_fileid
      const { data, error } = await supabase
        .from('media')
        .update({ is_transcoded: true })
        .eq('pcloud_fileid', filepath)
        .select('id, title')

      if (error) {
        console.error(`[WATCHER] forceMarkAsTranscoded film erreur:`, error.message)
      } else if (data && data.length > 0) {
        console.log(`[WATCHER] Film "${data[0].title}" → is_transcoded=true (déjà transcodé)`)
      } else {
        // Fallback par ilike sur le nom de fichier
        const { data: fallback } = await supabase
          .from('media')
          .update({ is_transcoded: true })
          .ilike('pcloud_fileid', `%${filename}%`)
          .select('id, title')
        if (fallback && fallback.length > 0) {
          console.log(`[WATCHER] Film "${fallback[0].title}" (fallback) → is_transcoded=true`)
        } else {
          console.warn(`[WATCHER] Film non trouvé en BDD pour forceMarkAsTranscoded: ${filename}`)
        }
      }
    }
  } catch (error) {
    console.error(`[WATCHER] Erreur forceMarkAsTranscoded ${filename}:`, error)
  }
}
