/**
 * Synchronisation du statut is_transcoded en BDD (Supabase)
 * Marque les médias comme transcodés après encodage FFmpeg
 */

import path from 'path'
import { getOutputDir, isAlreadyTranscoded } from './media-scanner'

/**
 * Marquer un média comme transcodé en BDD
 * Met à jour is_transcoded = true pour permettre l'affichage dans l'interface
 */
export async function markAsTranscoded(filepath: string): Promise<boolean> {
  const filename = path.basename(filepath)
  let success = false

  try {
    const { supabase } = await import('../supabase')

    const isSeries = filepath.includes('/series/')

    if (isSeries) {
      // Épisode de série
      const { data, error } = await supabase
        .from('episodes')
        .update({ is_transcoded: true })
        .eq('filepath', filepath)
        .select('id, season_number, episode_number')

      if (error) {
        console.error(`[TRANSCODE] ❌ markAsTranscoded épisode ERREUR ${filename}:`, error.message)
      } else if (data && data.length > 0) {
        console.log(`[TRANSCODE] ✅ Épisode S${data[0].season_number}E${data[0].episode_number} → is_transcoded=true → VISIBLE`)
        success = true
      } else {
        console.warn(`[TRANSCODE] ⚠️ Aucun épisode trouvé par filepath exact: ${filepath}`)

        // Stratégie 1: Pattern S00E00
        const episodeMatch = filename.match(/S(\d+)E(\d+)/i)
        if (episodeMatch) {
          const { data: fallbackData } = await supabase
            .from('episodes')
            .update({ is_transcoded: true })
            .eq('season_number', parseInt(episodeMatch[1]))
            .eq('episode_number', parseInt(episodeMatch[2]))
            .ilike('filepath', `%${filename}%`)
            .select('id')

          if (fallbackData && fallbackData.length > 0) {
            console.log(`[TRANSCODE] ✅ Épisode (fallback S00E00) → is_transcoded=true → VISIBLE`)
            success = true
          }
        }

        // Stratégie 2: Pattern E00 sans saison (mini-séries)
        if (!success) {
          const simpleMatch = filename.match(/[^S]E(\d+)/i) || filename.match(/^E(\d+)/i)
          if (simpleMatch) {
            const { data: fallbackData } = await supabase
              .from('episodes')
              .update({ is_transcoded: true })
              .eq('episode_number', parseInt(simpleMatch[1]))
              .ilike('filepath', `%${filename}%`)
              .select('id')

            if (fallbackData && fallbackData.length > 0) {
              console.log(`[TRANSCODE] ✅ Épisode (fallback E00) → is_transcoded=true → VISIBLE`)
              success = true
            }
          }
        }

        // Stratégie 3: Recherche par nom de fichier (dernier recours)
        if (!success) {
          const baseName = filename.replace(/\.(mkv|mp4|avi|m4v)$/i, '')
          const { data: fallbackData } = await supabase
            .from('episodes')
            .update({ is_transcoded: true })
            .ilike('filepath', `%${baseName}%`)
            .select('id, season_number, episode_number')

          if (fallbackData && fallbackData.length > 0) {
            console.log(`[TRANSCODE] ✅ Épisode (fallback basename) S${fallbackData[0].season_number}E${fallbackData[0].episode_number} → is_transcoded=true → VISIBLE`)
            success = true
          } else {
            console.error(`[TRANSCODE] ❌ IMPOSSIBLE marquer épisode comme transcodé: ${filename} — RESTERA INVISIBLE`)
          }
        }
      }
    } else {
      // Film
      const { data, error } = await supabase
        .from('media')
        .update({ is_transcoded: true })
        .eq('pcloud_fileid', filepath)
        .select('id, title')

      if (error) {
        console.error(`[TRANSCODE] ❌ markAsTranscoded film ERREUR ${filename}:`, error.message)
      } else if (data && data.length > 0) {
        console.log(`[TRANSCODE] ✅ Film "${data[0].title}" → is_transcoded=true → VISIBLE`)
        success = true
      } else {
        console.warn(`[TRANSCODE] ⚠️ Aucun film trouvé par pcloud_fileid exact: ${filepath}`)
        const { data: fallbackData } = await supabase
          .from('media')
          .update({ is_transcoded: true })
          .ilike('pcloud_fileid', `%${filename}%`)
          .select('id, title')

        if (fallbackData && fallbackData.length > 0) {
          console.log(`[TRANSCODE] ✅ Film "${fallbackData[0].title}" (fallback filename) → is_transcoded=true → VISIBLE`)
          success = true
        } else {
          console.error(`[TRANSCODE] ❌ IMPOSSIBLE marquer film comme transcodé: ${filename} (pcloud_fileid: ${filepath}) — RESTERA INVISIBLE`)
          console.error(`[TRANSCODE] ❌ Vérifier que le film existe en BDD et que pcloud_fileid correspond`)
        }
      }
    }
  } catch (error) {
    console.error(`[TRANSCODE] ❌ markAsTranscoded EXCEPTION ${filename}:`, error)
  }

  if (!success) {
    console.error(`[TRANSCODE] ❌ ÉCHEC markAsTranscoded pour: ${filepath}`)
    console.error(`[TRANSCODE] ❌ syncTranscodedStatus tentera de corriger au prochain cycle (5 min)`)
  }

  return success
}

/**
 * Synchroniser le statut is_transcoded en BDD avec les fichiers sur disque
 * Phase 1 : Legacy fix (médias pré-migration)
 * Phase 2 : Disk check (médias récents)
 */
export async function syncTranscodedStatus(): Promise<number> {
  let fixed = 0
  try {
    const { supabase } = await import('../supabase')

    // === Phase 1 : Legacy fix ===
    const MIGRATION_DATE = '2026-02-06T00:00:00Z'

    const { data: legacyMovies, error: legacyMoviesError } = await supabase
      .from('media')
      .select('id, title')
      .eq('is_transcoded', false)
      .lt('created_at', MIGRATION_DATE)

    if (!legacyMoviesError && legacyMovies && legacyMovies.length > 0) {
      const ids = legacyMovies.map(m => m.id)
      const { error: updateError } = await supabase
        .from('media')
        .update({ is_transcoded: true })
        .in('id', ids)

      if (!updateError) {
        console.log(`[TRANSCODE] Legacy fix: ${legacyMovies.length} film(s) pré-migration remis à is_transcoded=true`)
        fixed += legacyMovies.length
      } else {
        console.error('[TRANSCODE] Erreur legacy fix films:', updateError.message)
      }
    }

    const { data: legacyEpisodes, error: legacyEpisodesError } = await supabase
      .from('episodes')
      .select('id')
      .eq('is_transcoded', false)
      .lt('created_at', MIGRATION_DATE)

    if (!legacyEpisodesError && legacyEpisodes && legacyEpisodes.length > 0) {
      const ids = legacyEpisodes.map(e => e.id)
      const { error: updateError } = await supabase
        .from('episodes')
        .update({ is_transcoded: true })
        .in('id', ids)

      if (!updateError) {
        console.log(`[TRANSCODE] Legacy fix: ${legacyEpisodes.length} épisode(s) pré-migration remis à is_transcoded=true`)
        fixed += legacyEpisodes.length
      } else {
        console.error('[TRANSCODE] Erreur legacy fix épisodes:', updateError.message)
      }
    }

    // === Phase 2 : Disk check (médias récents) ===
    const { data: untranscodedMedia } = await supabase
      .from('media')
      .select('id, title, pcloud_fileid')
      .eq('is_transcoded', false)

    if (untranscodedMedia) {
      for (const media of untranscodedMedia) {
        if (!media.pcloud_fileid) continue
        const outputDir = getOutputDir(media.pcloud_fileid)
        if (await isAlreadyTranscoded(outputDir)) {
          await supabase
            .from('media')
            .update({ is_transcoded: true })
            .eq('id', media.id)
          console.log(`[TRANSCODE] Sync disk: film "${media.title}" marqué comme transcodé`)
          fixed++
        }
      }
    }

    const { data: untranscodedEpisodes } = await supabase
      .from('episodes')
      .select('id, filepath, season_number, episode_number')
      .eq('is_transcoded', false)

    if (untranscodedEpisodes) {
      for (const ep of untranscodedEpisodes) {
        if (!ep.filepath) continue
        const outputDir = getOutputDir(ep.filepath)
        if (await isAlreadyTranscoded(outputDir)) {
          await supabase
            .from('episodes')
            .update({ is_transcoded: true })
            .eq('id', ep.id)
          console.log(`[TRANSCODE] Sync disk: épisode S${ep.season_number}E${ep.episode_number} marqué comme transcodé`)
          fixed++
        }
      }
    }

    if (fixed > 0) {
      console.log(`[TRANSCODE] Sync terminée: ${fixed} média(s) corrigé(s)`)
    } else {
      console.log('[TRANSCODE] Sync: tout est à jour')
    }
  } catch (error) {
    console.error('[TRANSCODE] Erreur sync statut transcodage:', error)
  }
  return fixed
}
