/**
 * Wrapper pour l'API pCloud
 * Gestion du scan de dossiers et téléchargements
 * 
 * Note: pCloud n'a pas de SDK npm officiel stable.
 * On utilise directement l'API REST: https://docs.pcloud.com/
 */

const PCLOUD_API_BASE = 'https://api.pcloud.com'
const PCLOUD_ACCESS_TOKEN = process.env.PCLOUD_ACCESS_TOKEN || ''
const PCLOUD_MEDIA_FOLDER_ID = process.env.PCLOUD_MEDIA_FOLDER_ID

export type PCloudFile = {
  fileid: string
  name: string
  size: number // en bytes
  contenttype: string
  created: string
  modified: string
  path: string
}

export type PCloudFolder = {
  folderid: string
  name: string
  contents: Array<PCloudFile | PCloudFolder>
}

/**
 * Liste le contenu d'un dossier pCloud
 */
export async function listFolder(folderId?: string): Promise<PCloudFolder | null> {
  try {
    if (!PCLOUD_ACCESS_TOKEN) {
      throw new Error('PCLOUD_ACCESS_TOKEN manquante dans .env')
    }
    
    const targetFolder = folderId || PCLOUD_MEDIA_FOLDER_ID
    
    if (!targetFolder) {
      throw new Error('Aucun folderId fourni et PCLOUD_MEDIA_FOLDER_ID non définie')
    }
    
    const params = new URLSearchParams({
      access_token: PCLOUD_ACCESS_TOKEN,
      folderid: targetFolder,
      recursive: '0', // Non récursif par défaut
    })
    
    const response = await fetch(`${PCLOUD_API_BASE}/listfolder?${params}`)
    const data = await response.json()
    
    if (data.result !== 0) {
      throw new Error(`pCloud API error: ${data.error}`)
    }
    
    return data.metadata
  } catch (error) {
    console.error('Erreur listFolder pCloud:', error)
    return null
  }
}

/**
 * Filtre uniquement les fichiers vidéo MP4
 */
export function filterVideoFiles(folder: PCloudFolder): PCloudFile[] {
  if (!folder.contents) return []
  
  return folder.contents.filter((item): item is PCloudFile => {
    return 'fileid' in item && 
           item.name.toLowerCase().endsWith('.mp4')
  })
}

/**
 * Génère un lien de téléchargement temporaire pour un fichier
 * Le lien expire après quelques heures
 */
export async function getDownloadLink(fileId: string): Promise<string | null> {
  try {
    if (!PCLOUD_ACCESS_TOKEN) {
      throw new Error('PCLOUD_ACCESS_TOKEN manquante dans .env')
    }
    
    const params = new URLSearchParams({
      access_token: PCLOUD_ACCESS_TOKEN,
      fileid: fileId,
    })
    
    const response = await fetch(`${PCLOUD_API_BASE}/getfilelink?${params}`)
    const data = await response.json()
    
    if (data.result !== 0) {
      throw new Error(`pCloud API error: ${data.error}`)
    }
    
    // L'API retourne plusieurs hosts, on prend le premier
    const host = data.hosts[0]
    const path = data.path
    
    return `https://${host}${path}`
  } catch (error) {
    console.error('Erreur getDownloadLink pCloud:', error)
    return null
  }
}

/**
 * Recherche les fichiers de sous-titres associés à une vidéo
 * Cherche les fichiers .srt et .vtt avec le même nom de base
 */
export async function findSubtitles(
  videoFile: PCloudFile, 
  folderId?: string
): Promise<PCloudFile[]> {
  try {
    const folder = await listFolder(folderId)
    if (!folder) return []
    
    // Nom de base sans extension
    const baseName = videoFile.name.replace(/\.mp4$/i, '')
    
    // Filtre les fichiers de sous-titres
    const subtitleFiles = folder.contents.filter((item): item is PCloudFile => {
      if (!('fileid' in item)) return false
      
      const name = item.name.toLowerCase()
      const matchesBaseName = name.startsWith(baseName.toLowerCase())
      const isSubtitle = name.endsWith('.srt') || name.endsWith('.vtt')
      
      return matchesBaseName && isSubtitle
    })
    
    return subtitleFiles
  } catch (error) {
    console.error('Erreur findSubtitles:', error)
    return []
  }
}

/**
 * Extrait les métadonnées basiques d'un nom de fichier
 * Patterns courants: "Film (2020) 1080p.mp4" ou "Film.2020.720p.mp4"
 */
export function parseFileName(fileName: string): {
  title: string
  year: number | null
  quality: string | null
} {
  // Enlève l'extension
  const nameWithoutExt = fileName.replace(/\.mp4$/i, '')
  
  // Cherche l'année (4 chiffres entre parenthèses ou après un point)
  const yearMatch = nameWithoutExt.match(/[\(\.](\d{4})[\)\.]/)
  const year = yearMatch ? parseInt(yearMatch[1]) : null
  
  // Cherche la qualité (720p, 1080p, 4K, etc.)
  const qualityMatch = nameWithoutExt.match(/(4K|2160p|1080p|720p|480p)/i)
  const quality = qualityMatch ? qualityMatch[1].toUpperCase() : null
  
  // Extrait le titre (tout avant l'année ou la qualité)
  let title = nameWithoutExt
  if (yearMatch) {
    title = nameWithoutExt.substring(0, yearMatch.index).trim()
  } else if (qualityMatch) {
    title = nameWithoutExt.substring(0, qualityMatch.index).trim()
  }
  
  // Nettoie le titre (remplace points et underscores par espaces)
  title = title.replace(/[\._]/g, ' ').trim()
  
  return { title, year, quality }
}

/**
 * Formatte la taille de fichier en format lisible
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
}

