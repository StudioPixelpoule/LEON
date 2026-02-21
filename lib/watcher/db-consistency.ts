/**
 * Vérifications de cohérence base de données.
 * - Détecte les fichiers sur disque absents de la BDD
 * - Vérifie les séries sans métadonnées (poster)
 * - Déclenche les scans d'enrichissement TMDB
 */

import path from 'path'
import { MEDIA_DIR, SERIES_DIR } from './types'
import { extractMovieTitle, extractEpisodeInfo } from './filename-parser'

/**
 * Déclencher un scan d'enrichissement via l'API interne.
 */
export async function triggerEnrichmentScan(): Promise<void> {
  try {
    const response = await fetch('http://localhost:3000/api/scan-series?background=true', {
      method: 'POST'
    })

    if (!response.ok) {
      console.warn('[WATCHER] Échec du scan d\'enrichissement')
    }
  } catch (error) {
    console.error('[WATCHER] Erreur scan d\'enrichissement:', error)
  }
}

/**
 * Vérifier au démarrage s'il y a des séries sans poster.
 * Si oui, déclencher automatiquement un scan d'enrichissement.
 */
export async function checkSeriesNeedingEnrichment(): Promise<void> {
  try {
    const { supabase } = await import('../supabase')

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

    await triggerEnrichmentScan()
  } catch (error) {
    console.error('[WATCHER] Erreur checkSeriesNeedingEnrichment:', error)
  }
}

/**
 * Nettoyer les séries fantômes (doublons créés par erreur de parsing).
 * Une série fantôme a un `local_folder_path` qui n'est pas un enfant direct de SERIES_DIR.
 * Pour chaque fantôme : transfert des épisodes vers la série parente, puis suppression.
 */
export async function cleanupDuplicateSeries(): Promise<void> {
  try {
    const { supabase } = await import('../supabase')

    // Récupérer toutes les séries avec leur chemin local
    const { data: allSeries, error } = await supabase
      .from('series')
      .select('id, title, local_folder_path')

    if (error || !allSeries) {
      console.error('[WATCHER] Erreur récupération séries pour nettoyage:', error?.message)
      return
    }

    // Identifier les séries fantômes : celles dont le parent du local_folder_path n'est PAS SERIES_DIR
    const normalizedSeriesDir = path.resolve(SERIES_DIR)
    const ghostSeries = allSeries.filter(s => {
      if (!s.local_folder_path) return false
      const parentDir = path.resolve(path.dirname(s.local_folder_path))
      return parentDir !== normalizedSeriesDir
    })

    if (ghostSeries.length === 0) {
      return
    }

    console.log(`[WATCHER] Nettoyage: ${ghostSeries.length} série(s) fantôme(s) détectée(s)`)

    let cleaned = 0
    for (const ghost of ghostSeries) {
      try {
        // Trouver la série parente (premier enfant de SERIES_DIR dans l'arborescence)
        let parentPath = path.resolve(ghost.local_folder_path)
        while (
          path.resolve(path.dirname(parentPath)) !== normalizedSeriesDir &&
          path.resolve(parentPath) !== normalizedSeriesDir
        ) {
          parentPath = path.dirname(parentPath)
        }

        // Chercher la série parente en BDD
        const { data: parentSeries } = await supabase
          .from('series')
          .select('id, title')
          .eq('local_folder_path', parentPath)
          .limit(1)
          .maybeSingle()

        if (parentSeries) {
          // Transférer les épisodes de la série fantôme vers la série parente
          const { data: ghostEpisodes } = await supabase
            .from('episodes')
            .select('id, season_number, episode_number')
            .eq('series_id', ghost.id)

          if (ghostEpisodes && ghostEpisodes.length > 0) {
            // Vérifier les doublons avant de transférer
            for (const ep of ghostEpisodes) {
              const { data: existing } = await supabase
                .from('episodes')
                .select('id')
                .eq('series_id', parentSeries.id)
                .eq('season_number', ep.season_number)
                .eq('episode_number', ep.episode_number)
                .single()

              if (existing) {
                // L'épisode existe déjà chez le parent — supprimer le doublon fantôme
                await supabase.from('episodes').delete().eq('id', ep.id)
              } else {
                // Transférer vers la série parente
                await supabase
                  .from('episodes')
                  .update({ series_id: parentSeries.id })
                  .eq('id', ep.id)
              }
            }
            console.log(`[WATCHER] Nettoyage: ${ghostEpisodes.length} épisode(s) transféré(s) de "${ghost.title}" → "${parentSeries.title}"`)
          }
        }

        // Supprimer la série fantôme (ses épisodes ont été transférés ou n'existent plus)
        const { error: deleteError } = await supabase
          .from('series')
          .delete()
          .eq('id', ghost.id)

        if (deleteError) {
          console.error(`[WATCHER] Erreur suppression série fantôme "${ghost.title}":`, deleteError.message)
        } else {
          console.log(`[WATCHER] Nettoyage: série fantôme supprimée "${ghost.title}" (path: ${ghost.local_folder_path})`)
          cleaned++
        }
      } catch (ghostError) {
        console.error(`[WATCHER] Erreur nettoyage série "${ghost.title}":`, ghostError)
      }
    }

    if (cleaned > 0) {
      console.log(`[WATCHER] Nettoyage terminé: ${cleaned}/${ghostSeries.length} série(s) fantôme(s) supprimée(s)`)
    }
  } catch (error) {
    console.error('[WATCHER] Erreur cleanupDuplicateSeries:', error)
  }
}

/**
 * Vérifier si des fichiers connus manquent en base de données
 * et les ajouter automatiquement (version optimisée).
 * 
 * @param knownFiles - Set des fichiers connus sur disque
 * @param processNewFile - Callback pour traiter un fichier manquant
 * @param saveState - Callback pour sauvegarder l'état après traitement
 * @param scheduleEnrichmentScan - Callback pour programmer un scan d'enrichissement
 */
export async function checkMissingInDatabase(
  knownFiles: Set<string>,
  processNewFile: (filepath: string) => Promise<void>,
  saveState: () => Promise<void>,
  scheduleEnrichmentScan: () => void
): Promise<void> {
  try {
    const { supabase } = await import('../supabase')

    // Récupérer tous les films en BDD avec titre ET chemin fichier
    const { data: movies } = await supabase
      .from('media')
      .select('title, pcloud_fileid')

    // Créer des sets pour recherche rapide (par filepath ET par titre normalisé)
    const movieFilepaths = new Set((movies || []).map(m => m.pcloud_fileid).filter(Boolean))
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

    for (const filepath of knownFiles) {
      const filename = path.basename(filepath)

      if (filepath.startsWith(SERIES_DIR)) {
        // C'est un épisode
        if (episodeFilepaths.has(filepath)) continue

        // Vérifier par clé série+saison+episode
        const info = extractEpisodeInfo(filepath)
        if (info) {
          const key = `${info.seriesName}|s${info.season}e${info.episode}`
          if (episodeKeys.has(key)) continue
        }

        missingFiles.push(filepath)

      } else if (filepath.startsWith(MEDIA_DIR)) {
        // C'est un film
        if (movieFilepaths.has(filepath)) continue

        // Vérifier par titre normalisé
        const title = extractMovieTitle(filename)
        if (movieTitles.has(title)) continue

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
    const sortedMissing = [...missingSeries, ...missingMovies]

    console.log(`[WATCHER] Cohérence: ${missingFiles.length} fichier(s) manquant(s) en BDD (${missingMovies.length} films, ${missingSeries.length} épisodes)`)

    let processed = 0
    for (const filepath of sortedMissing) {
      try {
        // Supprimer temporairement de knownFiles pour que processNewFile le re-traite
        knownFiles.delete(filepath)
        await processNewFile(filepath)
        processed++

        // Pause courte entre chaque fichier
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (err) {
        // Re-ajouter à knownFiles même en cas d'erreur pour éviter la boucle infinie
        knownFiles.add(filepath)
        console.error(`[WATCHER] Erreur traitement ${path.basename(filepath)}:`, err instanceof Error ? err.message : err)
      }
    }

    await saveState()

    console.log(`[WATCHER] Cohérence terminée: ${processed}/${missingFiles.length} fichiers traités`)

    if (processed > 0) {
      scheduleEnrichmentScan()
    }

  } catch (error) {
    console.error('[WATCHER] Erreur vérification cohérence:', error)
  }
}
