/**
 * Nettoyage des titres d'épisodes
 * Retire les infos techniques (codec, résolution, release group)
 * et extrait un titre lisible depuis le nom de fichier
 */

/**
 * Nettoyer le titre d'un épisode
 * "Bref - S01E01 - Bref. J'ai dragué cette fille x265-Amen.mkv"
 * → "J'ai dragué cette fille"
 */
export function cleanEpisodeTitle(filename: string, seriesName: string): string {
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
