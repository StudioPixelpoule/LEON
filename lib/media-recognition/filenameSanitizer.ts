/**
 * Sanitization et normalisation des noms de fichiers
 * Corrige les problèmes d'encodage et nettoie les noms de fichiers
 */

/**
 * Corrige les caractères mal encodés (UTF-8, Latin-1, etc.)
 */
export function fixEncoding(text: string): string {
  // Mapping des caractères mal encodés courants
  const encodingFixes: Record<string, string> = {
    'Ã©': 'é',
    'Ã¨': 'è',
    'Ãª': 'ê',
    'Ã ': 'à',
    'Ã¢': 'â',
    'Ã´': 'ô',
    'Ã®': 'î',
    'Ã¹': 'ù',
    'Ã»': 'û',
    'Ã§': 'ç',
    'Ã«': 'ë',
    'Ã¯': 'ï',
    'Ã¼': 'ü',
    'Ã‰': 'É',
    'Ã€': 'À',
    'Ãˆ': 'È',
    'ÃŠ': 'Ê',
    'Ã‡': 'Ç',
    'Å"': 'œ',
    'Ì€': 'è',
    'Ì‚': 'ê',
    'Ì': 'é',
    'Ìˆ': 'ë',
    'Ã±': 'ñ',
    'Ã': 'Ñ',
    // Ajout des patterns observés dans vos fichiers
    'eÌ€': 'è',
    'eÌ‚': 'ê',
    'eÌ': 'é',
    'aÌ€': 'à',
    'aÌ‚': 'â',
    'oÌ‚': 'ô',
    'iÌ‚': 'î',
    'uÌ€': 'ù',
    'uÌ‚': 'û',
    'cÌ§': 'ç',
  }

  let fixed = text
  for (const [bad, good] of Object.entries(encodingFixes)) {
    fixed = fixed.replace(new RegExp(bad, 'g'), good)
  }

  // Supprimer les caractères de contrôle restants
  fixed = fixed.replace(/[\u0300-\u036f]/g, '') // Diacritiques combinés
  
  return fixed
}

/**
 * Détecte si un fichier est une série TV
 */
export function isTVShow(filename: string): boolean {
  const tvPatterns = [
    /S\d{1,2}E\d{1,2}/i, // S01E01
    /\d{1,2}x\d{1,2}/i, // 1x01
    /Season\s*\d+/i, // Season 1
    /Saison\s*\d+/i, // Saison 1
    /Episode\s*\d+/i, // Episode 1
    /\bS\d{1,2}\b/i, // S01
    /\d{3,4}p.*S\d{2}/i, // 1080p.S01
  ]

  return tvPatterns.some(pattern => pattern.test(filename))
}

/**
 * Extrait les informations de série (saison, épisode)
 */
export function extractTVInfo(filename: string): {
  showName: string
  season: number | null
  episode: number | null
} | null {
  if (!isTVShow(filename)) {
    return null
  }

  let showName = filename
  let season: number | null = null
  let episode: number | null = null

  // Pattern S01E01
  const s01e01 = filename.match(/S(\d{1,2})E(\d{1,2})/i)
  if (s01e01) {
    season = parseInt(s01e01[1], 10)
    episode = parseInt(s01e01[2], 10)
    showName = filename.split(/S\d{1,2}E\d{1,2}/i)[0]
  }

  // Pattern 1x01
  const x01 = filename.match(/(\d{1,2})x(\d{1,2})/i)
  if (x01 && !s01e01) {
    season = parseInt(x01[1], 10)
    episode = parseInt(x01[2], 10)
    showName = filename.split(/\d{1,2}x\d{1,2}/i)[0]
  }

  // Pattern Season/Saison
  const seasonMatch = filename.match(/(?:Season|Saison)\s*(\d+)/i)
  if (seasonMatch) {
    season = parseInt(seasonMatch[1], 10)
    showName = filename.split(/(?:Season|Saison)\s*\d+/i)[0]
  }

  // Nettoyer le nom de la série
  showName = showName
    .replace(/\.(mkv|mp4|avi|mov|webm)$/i, '')
    .replace(/[._-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    showName,
    season,
    episode,
  }
}

/**
 * Nettoie un nom de fichier pour la recherche TMDB
 */
export function cleanFilenameForSearch(filename: string): string {
  // 1. Corriger l'encodage
  let cleaned = fixEncoding(filename)

  // 2. Supprimer l'extension
  cleaned = cleaned.replace(/\.(mkv|mp4|avi|mov|webm|m4v|flv|wmv)$/i, '')

  // 3. Remplacer les séparateurs par des espaces
  cleaned = cleaned.replace(/[._-]/g, ' ')

  // 4. Supprimer les tags de qualité et release
  const tagsToRemove = [
    /\b(1080p|720p|480p|2160p|4K|UHD|HDR|BluRay|BRRip|WEBRip|WEB-DL|DVDRip|HDTV)\b/gi,
    /\b(x264|x265|H264|H265|HEVC|AAC|AC3|DTS|DD5\.1)\b/gi,
    /\b(FRENCH|VOSTFR|SUBFRENCH|MULTI|TRUEFRENCH|VFF|VFQ|VO)\b/gi,
    /\b(REPACK|PROPER|EXTENDED|UNRATED|DC|Director'?s?\s*Cut)\b/gi,
    /\[(.*?)\]/g, // Contenu entre crochets
    /\{(.*?)\}/g, // Contenu entre accolades
    /\((19|20)\d{2}\)/g, // Année entre parenthèses (on la garde ailleurs)
  ]

  tagsToRemove.forEach(pattern => {
    cleaned = cleaned.replace(pattern, ' ')
  })

  // 5. Supprimer les groupes de release (souvent après un tiret)
  cleaned = cleaned.replace(/\s*-\s*[A-Z0-9]+\s*$/i, '')

  // 6. Nettoyer les espaces multiples
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  return cleaned
}

/**
 * Extrait l'année d'un nom de fichier
 */
export function extractYear(filename: string): number | null {
  // Chercher une année entre 1900 et 2099
  const yearMatch = filename.match(/\b(19\d{2}|20\d{2})\b/)
  if (yearMatch) {
    return parseInt(yearMatch[1], 10)
  }
  return null
}

/**
 * Sanitize complet d'un nom de fichier
 */
export function sanitizeFilename(filename: string): {
  cleanName: string
  year: number | null
  isTVShow: boolean
  tvInfo: ReturnType<typeof extractTVInfo>
} {
  const fixed = fixEncoding(filename)
  const year = extractYear(fixed)
  const tvShow = isTVShow(fixed)
  const tvInfo = tvShow ? extractTVInfo(fixed) : null
  const cleanName = cleanFilenameForSearch(fixed)

  return {
    cleanName,
    year,
    isTVShow: tvShow,
    tvInfo,
  }
}

