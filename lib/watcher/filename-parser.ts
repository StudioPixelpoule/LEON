/**
 * Extraction d'informations depuis les noms de fichiers vidéo.
 * Fonctions pures : pas d'état, pas de side-effects.
 */

import path from 'path'
import { SERIES_DIR } from './types'

/**
 * Extraire le titre d'un film depuis le nom de fichier.
 * Retire l'extension, l'année, et nettoie les séparateurs.
 */
export function extractMovieTitle(filename: string): string {
  let title = filename
  // Retirer l'extension
  title = title.replace(/\.(mkv|mp4|avi|mov|m4v|webm|flv|wmv)$/i, '')
  // Retirer l'année entre parenthèses ou après un point
  title = title.replace(/[\s._-]*\(?\d{4}\)?[\s._-]*$/, '')
  // Nettoyer les séparateurs
  title = title.replace(/[._]/g, ' ').trim()
  return title.toLowerCase()
}

/**
 * Extraire les infos d'un épisode depuis le chemin.
 * Supporte plusieurs formats de nommage :
 * - S01E02, s01e02 (standard)
 * - E02, e02 (sans saison — utilise le dossier parent)
 * - 1x02 (format alternatif)
 * - Episode 02, Ep 02, Ep.02
 * - Pilote 01
 */
export function extractEpisodeInfo(filepath: string): { seriesName: string; season: number; episode: number } | null {
  const filename = path.basename(filepath)
  let season: number | null = null
  let episode: number | null = null

  // Pattern 1: S01E02 (standard)
  const standardMatch = filename.match(/S(\d{1,2})E(\d{1,3})/i)
  if (standardMatch) {
    season = parseInt(standardMatch[1])
    episode = parseInt(standardMatch[2])
  }

  // Pattern 2: 1x02 (format alternatif)
  if (!episode) {
    const altMatch = filename.match(/(\d{1,2})x(\d{1,3})/i)
    if (altMatch) {
      season = parseInt(altMatch[1])
      episode = parseInt(altMatch[2])
    }
  }

  // Pattern 3: E02 sans saison (mini-séries, youtube)
  if (!episode) {
    const simpleMatch = filename.match(/[^S]E(\d{1,3})/i) || filename.match(/^E(\d{1,3})/i)
    if (simpleMatch) {
      episode = parseInt(simpleMatch[1])
    }
  }

  // Pattern 4: Episode 02, Ep 02, Ep.02
  if (!episode) {
    const epMatch = filename.match(/(?:Episode|Ep\.?)\s*(\d{1,3})/i)
    if (epMatch) {
      episode = parseInt(epMatch[1])
    }
  }

  // Pattern 5: Pilote 01, Pilote01
  if (!episode) {
    const pilotMatch = filename.match(/Pilote\s*(\d{1,3})/i)
    if (pilotMatch) {
      episode = parseInt(pilotMatch[1])
      season = 0 // Les pilotes vont dans la saison 0
    }
  }

  if (!episode) return null

  // Extraire le nom de la série depuis le dossier parent.
  // Approche structurelle : remonter jusqu'au premier enfant de SERIES_DIR.
  const normalizedSeriesDir = path.resolve(SERIES_DIR)
  let seriesPath = path.dirname(filepath)
  let folderName = path.basename(seriesPath)

  // Si dans un dossier de saison, extraire le numéro de saison avant de remonter
  const seasonPatterns = [
    /^Season\s*(\d+)$/i,
    /^Saison\s*(\d+)$/i,
    /^S(\d{1,2})$/i,
    /\sS(\d{1,2})$/i,
    /^Livre\s*(\d+)/i,   // Pour Kaamelott
    /^Specials?$/i        // Saison 0 pour les spéciaux
  ]

  // Extraire la saison depuis les dossiers intermédiaires en remontant
  while (
    path.resolve(path.dirname(seriesPath)) !== normalizedSeriesDir &&
    path.resolve(seriesPath) !== normalizedSeriesDir
  ) {
    // Tenter d'extraire un numéro de saison du dossier courant
    if (season === null) {
      for (const pattern of seasonPatterns) {
        const match = folderName.match(pattern)
        if (match) {
          season = /Specials?/i.test(folderName) ? 0 : parseInt(match[1])
          break
        }
      }
    }
    seriesPath = path.dirname(seriesPath)
    folderName = path.basename(seriesPath)
  }

  // Default saison 1 si toujours pas trouvé
  if (season === null) season = 1

  return { seriesName: folderName.toLowerCase(), season, episode }
}

/**
 * Nettoyer le titre d'un épisode.
 * Retire les infos de codec, release group, numéro SxxExx, et le nom de la série.
 */
export function cleanEpisodeTitle(filename: string, seriesName: string): string {
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
