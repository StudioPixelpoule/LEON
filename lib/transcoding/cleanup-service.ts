/**
 * Service de nettoyage des transcodages incomplets/interrompus
 */

import { readdir, readFile, writeFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { TRANSCODED_DIR } from './types'

/**
 * Nettoyer les transcodages en cours (interrompus au démarrage)
 * Supprime les dossiers avec .transcoding
 * @returns Le nombre de transcodages nettoyés
 */
export async function cleanupInProgress(): Promise<number> {
  try {
    if (!existsSync(TRANSCODED_DIR)) return 0

    const entries = await readdir(TRANSCODED_DIR, { withFileTypes: true })
    let cleanedCount = 0

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const dirPath = path.join(TRANSCODED_DIR, entry.name)
      const transcodingPath = path.join(dirPath, '.transcoding')

      if (existsSync(transcodingPath)) {
        console.log(`[TRANSCODE] Nettoyage transcodage interrompu: ${entry.name}`)
        await rm(dirPath, { recursive: true, force: true })
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      console.log(`[TRANSCODE] ${cleanedCount} transcodage(s) interrompu(s) nettoyé(s)`)
    }

    return cleanedCount
  } catch (error) {
    console.error('[TRANSCODE] Erreur nettoyage en cours:', error)
    return 0
  }
}

/**
 * Nettoyer les transcodages incomplets
 * Supprime les dossiers avec .transcoding ou qui n'ont pas assez de segments
 */
export async function cleanupIncomplete(): Promise<{ cleaned: string[], kept: string[] }> {
  const cleaned: string[] = []
  const kept: string[] = []

  const scanDir = async (baseDir: string, prefix: string = '') => {
    if (!existsSync(baseDir)) return

    const entries = await readdir(baseDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === 'series' && prefix === '') continue

      const dirPath = path.join(baseDir, entry.name)
      const donePath = path.join(dirPath, '.done')
      const transcodingPath = path.join(dirPath, '.transcoding')
      const masterPlaylistPath = path.join(dirPath, 'playlist.m3u8')
      const videoPlaylistPath = path.join(dirPath, 'video.m3u8')
      const streamPlaylistPath = path.join(dirPath, 'stream_0.m3u8')

      // Si .transcoding existe, transcodage interrompu - supprimer
      if (existsSync(transcodingPath)) {
        console.log(`[TRANSCODE] Suppression transcodage interrompu: ${prefix}${entry.name}`)
        await rm(dirPath, { recursive: true, force: true })
        cleaned.push(prefix + entry.name)
        continue
      }

      // Si .done existe, garder
      if (existsSync(donePath)) {
        kept.push(prefix + entry.name)
        continue
      }

      // Compter les segments (tous formats)
      const files = await readdir(dirPath)
      const oldSegments = files.filter(f => f.match(/^segment\d+\.ts$/)).length
      const videoSegments = files.filter(f => f.match(/^video_segment\d+\.ts$/)).length
      const segmentCount = oldSegments + videoSegments

      // Vérifier si le playlist est complet
      let playlistComplete = false
      const playlistToCheck = existsSync(videoPlaylistPath) ? videoPlaylistPath :
                              existsSync(streamPlaylistPath) ? streamPlaylistPath :
                              existsSync(masterPlaylistPath) ? masterPlaylistPath : null

      if (playlistToCheck) {
        try {
          const content = await readFile(playlistToCheck, 'utf-8')
          playlistComplete = content.includes('#EXT-X-ENDLIST')
        } catch (error) {
          console.error('[TRANSCODE] Erreur lecture playlist:', error instanceof Error ? error.message : error)
        }
      }

      if (segmentCount < 10 || !playlistComplete) {
        console.log(`[TRANSCODE] Suppression transcodage incomplet: ${prefix}${entry.name} (${segmentCount} segments, playlist: ${playlistComplete})`)
        await rm(dirPath, { recursive: true, force: true })
        cleaned.push(prefix + entry.name)
      } else {
        console.log(`[TRANSCODE] Création .done pour: ${prefix}${entry.name} (${segmentCount} segments)`)
        await writeFile(donePath, new Date().toISOString())
        kept.push(prefix + entry.name)
      }
    }
  }

  try {
    await scanDir(TRANSCODED_DIR)
    const seriesDir = path.join(TRANSCODED_DIR, 'series')
    await scanDir(seriesDir, 'series/')
  } catch (error) {
    console.error('[TRANSCODE] Erreur cleanup incomplets:', error)
  }

  return { cleaned, kept }
}
