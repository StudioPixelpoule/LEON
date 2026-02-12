/**
 * Scanner de répertoires media pour le transcodage
 * Scan films + séries, vérification de transcodage existant
 */

import { readdir, stat, readFile, writeFile, access } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { TRANSCODED_DIR, MEDIA_DIR, SERIES_DIR, VIDEO_EXTENSIONS } from './types'
import type { ScannedMediaFile } from './types'

/**
 * Obtenir le répertoire de sortie pour un fichier
 * Organise les séries dans un sous-dossier 'series'
 */
export function getOutputDir(filepath: string): string {
  const filename = path.basename(filepath, path.extname(filepath))
  const safeName = filename.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s\-_.()[\]]/gi, '_')

  // Vérifier si c'est un épisode de série (contient SxxExx)
  const isSeriesEpisode = /S\d{1,2}E\d{1,2}/i.test(filename)

  if (isSeriesEpisode || filepath.includes(SERIES_DIR)) {
    return path.join(TRANSCODED_DIR, 'series', safeName)
  }

  return path.join(TRANSCODED_DIR, safeName)
}

/**
 * Vérifier si un fichier est déjà transcodé
 * Supporte l'ancien format (playlist.m3u8) et le nouveau format (stream_0.m3u8 + master.m3u8)
 * Retourne false si .transcoding existe (transcodage interrompu)
 */
export async function isAlreadyTranscoded(outputDir: string): Promise<boolean> {
  const donePath = path.join(outputDir, '.done')
  const transcodingPath = path.join(outputDir, '.transcoding')

  // Si .transcoding existe, c'est un transcodage interrompu
  if (existsSync(transcodingPath)) {
    return false
  }

  // Vérification rapide : fichier .done existe
  if (existsSync(donePath)) {
    return true
  }

  // Trouver une playlist (ancien ou nouveau format)
  const videoPlaylistPath = path.join(outputDir, 'video.m3u8')
  const newPlaylistPath = path.join(outputDir, 'stream_0.m3u8')
  const oldPlaylistPath = path.join(outputDir, 'playlist.m3u8')

  const playlistPath = existsSync(videoPlaylistPath) ? videoPlaylistPath :
                       existsSync(newPlaylistPath) ? newPlaylistPath :
                       existsSync(oldPlaylistPath) ? oldPlaylistPath : null

  if (!playlistPath) {
    return false
  }

  // Vérification approfondie : playlist + segments suffisants
  try {
    const playlistContent = await readFile(playlistPath, 'utf-8')
    if (playlistContent.includes('#EXT-X-ENDLIST')) {
      const oldSegments = (playlistContent.match(/segment\d+\.ts/g) || []).length
      const newSegments = (playlistContent.match(/stream_\d+_segment\d+\.ts/g) || []).length
      const segmentCount = oldSegments + newSegments

      if (segmentCount >= 10) {
        console.log(`[TRANSCODE] Création .done pour ${outputDir} (${segmentCount} segments détectés)`)
        await writeFile(donePath, new Date().toISOString())
        return true
      }
    }
  } catch (error) {
    console.error(`[TRANSCODE] Erreur lecture playlist ${playlistPath}:`, error)
  }

  return false
}

/**
 * Scanner le répertoire media (films + séries)
 * Mélange : alterne films et séries pour une queue équilibrée
 */
export async function scanMediaDirectory(): Promise<ScannedMediaFile[]> {
  const films: ScannedMediaFile[] = []
  const series: ScannedMediaFile[] = []

  const scanDir = async (dir: string, targetArray: ScannedMediaFile[]) => {
    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          await scanDir(fullPath, targetArray)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (VIDEO_EXTENSIONS.includes(ext)) {
            const stats = await stat(fullPath)
            targetArray.push({
              filepath: fullPath,
              filename: entry.name,
              mtime: stats.mtime,
              size: stats.size
            })
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`[TRANSCODE] Erreur scan ${dir}:`, error)
      }
    }
  }

  // Scanner les films
  await scanDir(MEDIA_DIR, films)
  console.log(`[TRANSCODE] ${films.length} films trouvés`)

  // Scanner les séries (si le dossier existe)
  try {
    await access(SERIES_DIR)
    await scanDir(SERIES_DIR, series)
    console.log(`[TRANSCODE] ${series.length} épisodes de séries trouvés`)
  } catch {
    // Le dossier series n'existe pas encore
  }

  // Trier chaque catégorie par date (plus récent en premier)
  films.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
  series.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

  // Mélanger : alterner films et séries
  const mixed: ScannedMediaFile[] = []
  const maxLength = Math.max(films.length, series.length)

  for (let i = 0; i < maxLength; i++) {
    if (i < films.length) mixed.push(films[i])
    if (i < series.length) mixed.push(series[i])
  }

  console.log(`[TRANSCODE] Queue mélangée: ${mixed.length} fichiers (alternance films/séries)`)
  return mixed
}
