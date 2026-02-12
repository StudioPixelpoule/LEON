/**
 * Parsing des noms de fichiers et dossiers pour extraire
 * les informations de saison/épisode/titre
 */

import fs from 'fs/promises'
import path from 'path'
import type { Episode } from './types'
import { VIDEO_EXTENSIONS } from './types'

/**
 * Extraire le numéro de saison d'un nom de dossier
 * Supporte : "Season 1", "Saison 1", "S01", "Livre 3", "Specials"
 */
export function extractSeasonFromFolder(folderName: string): number | null {
  const patterns = [
    /^Season\s*(\d+)$/i,
    /^Saison\s*(\d+)$/i,
    /^S(\d{1,2})$/i,
    /\sS(\d{1,2})$/i,
    /^Livre\s*(\d+)/i,  // Pour Kaamelott
  ]

  for (const pattern of patterns) {
    const match = folderName.match(pattern)
    if (match) return parseInt(match[1])
  }

  if (/^Specials?$/i.test(folderName)) return 0

  return null
}

/**
 * Extraire le numéro d'épisode d'un nom de fichier
 * Supporte plusieurs formats : S01E02, E02, 1x02, Episode 02, Pilote 01
 */
export function extractEpisodeNumber(filename: string): { season: number | null; episode: number } | null {
  // Pattern 1: S01E02 (standard)
  const standardMatch = filename.match(/S(\d{1,2})E(\d{1,3})/i)
  if (standardMatch) {
    return { season: parseInt(standardMatch[1]), episode: parseInt(standardMatch[2]) }
  }

  // Pattern 2: 1x02 (format alternatif)
  const altMatch = filename.match(/(\d{1,2})x(\d{1,3})/i)
  if (altMatch) {
    return { season: parseInt(altMatch[1]), episode: parseInt(altMatch[2]) }
  }

  // Pattern 3: E02 sans saison (mini-séries, youtube)
  const simpleMatch = filename.match(/[^S]E(\d{1,3})/i) || filename.match(/^E(\d{1,3})/i)
  if (simpleMatch) {
    return { season: null, episode: parseInt(simpleMatch[1]) }
  }

  // Pattern 4: Episode 02, Ep 02, Ep.02
  const epMatch = filename.match(/(?:Episode|Ep\.?)\s*(\d{1,3})/i)
  if (epMatch) {
    return { season: null, episode: parseInt(epMatch[1]) }
  }

  // Pattern 5: Pilote 01
  const pilotMatch = filename.match(/Pilote\s*(\d{1,3})/i)
  if (pilotMatch) {
    return { season: 0, episode: parseInt(pilotMatch[1]) }
  }

  return null
}

/**
 * Scanner récursivement un dossier de série pour trouver tous les épisodes
 * Gère plusieurs cas :
 * 1. Fichiers directement dans le dossier série (ex: Chernobyl/Chernobyl.S01E01.mkv)
 * 2. Fichiers dans des sous-dossiers de saison (ex: Better Call Saul/Season 1/episode.mkv)
 * 3. Formats alternatifs : E01, 1x01, Episode 01, Pilote 01
 */
export async function scanSeriesFolder(seriesPath: string, seriesName: string): Promise<Episode[]> {
  const episodes: Episode[] = []

  async function scanDirectory(dirPath: string, folderSeason: number | null = null, depth: number = 0) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        // Ignorer les fichiers cachés
        if (entry.name.startsWith('.')) continue

        const fullPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
          // Scanner les sous-dossiers (limiter à 2 niveaux de profondeur)
          if (depth < 2) {
            // Essayer d'extraire le numéro de saison du nom du dossier
            const seasonFromFolder = extractSeasonFromFolder(entry.name)
            await scanDirectory(fullPath, seasonFromFolder ?? folderSeason, depth + 1)
          }
        } else {
          // C'est un fichier
          const ext = path.extname(entry.name).toLowerCase()
          if (VIDEO_EXTENSIONS.includes(ext)) {
            // Extraire les infos d'épisode du nom de fichier
            const episodeInfo = extractEpisodeNumber(entry.name)
            if (episodeInfo) {
              // Utiliser la saison du fichier, sinon celle du dossier, sinon 1
              const season = episodeInfo.season ?? folderSeason ?? 1
              episodes.push({
                filename: entry.name,
                filepath: fullPath,
                season,
                episode: episodeInfo.episode,
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

  await scanDirectory(seriesPath, null, 0)

  return episodes.sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season
    return a.episode - b.episode
  })
}
