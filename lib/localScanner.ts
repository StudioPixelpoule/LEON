/**
 * Scanner de fichiers local pour pCloud Drive
 * Remplace l'API pCloud par une lecture directe du système de fichiers
 */

import fs from 'fs/promises';
import path from 'path';

// Extensions vidéo supportées
const VIDEO_EXTENSIONS = [
  '.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'
];

// Extensions de sous-titres supportées
const SUBTITLE_EXTENSIONS = [
  '.srt', '.vtt', '.sub', '.ass', '.ssa'
];

export interface LocalMediaFile {
  filename: string;
  filepath: string;
  size: number;
  extension: string;
  lastModified: Date;
}

export interface LocalSubtitleFile {
  filename: string;
  filepath: string;
  language?: string;
  forced?: boolean;
  sdh?: boolean;
}

/**
 * Scanne récursivement un dossier pour trouver tous les fichiers vidéo
 */
export async function scanLocalFolder(folderPath: string): Promise<LocalMediaFile[]> {
  const mediaFiles: LocalMediaFile[] = [];

  try {
    const items = await fs.readdir(folderPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(folderPath, item.name);

      // Ignorer les fichiers cachés
      if (item.name.startsWith('.')) {
        continue;
      }

      if (item.isDirectory()) {
        // Scanner récursivement les sous-dossiers
        const subFiles = await scanLocalFolder(fullPath);
        mediaFiles.push(...subFiles);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        
        // Vérifier si c'est un fichier vidéo
        if (VIDEO_EXTENSIONS.includes(ext)) {
          const stats = await fs.stat(fullPath);
          
          mediaFiles.push({
            filename: item.name,
            filepath: fullPath,
            size: stats.size,
            extension: ext,
            lastModified: stats.mtime
          });
        }
      }
    }
  } catch (error) {
    console.error(`Erreur lors du scan de ${folderPath}:`, error);
  }

  return mediaFiles;
}

/**
 * Trouve les sous-titres associés à un fichier vidéo
 */
export async function findLocalSubtitles(
  videoPath: string
): Promise<LocalSubtitleFile[]> {
  const subtitles: LocalSubtitleFile[] = [];
  const videoDir = path.dirname(videoPath);
  const videoBasename = path.basename(videoPath, path.extname(videoPath));

  try {
    const items = await fs.readdir(videoDir);

    for (const item of items) {
      const ext = path.extname(item).toLowerCase();
      
      // Vérifier si c'est un fichier de sous-titres
      if (SUBTITLE_EXTENSIONS.includes(ext)) {
        const subtitleBasename = path.basename(item, ext);
        
        // Vérifier si le nom correspond au fichier vidéo
        if (subtitleBasename.toLowerCase().includes(videoBasename.toLowerCase())) {
          const fullPath = path.join(videoDir, item);
          
          // Détecter la langue et les flags
          const language = detectLanguage(item);
          const forced = item.toLowerCase().includes('forced');
          const sdh = item.toLowerCase().includes('sdh') || item.toLowerCase().includes('cc');

          subtitles.push({
            filename: item,
            filepath: fullPath,
            language,
            forced,
            sdh
          });
        }
      }
    }
  } catch (error) {
    console.error(`Erreur lors de la recherche de sous-titres pour ${videoPath}:`, error);
  }

  return subtitles;
}

/**
 * Détecte la langue d'un fichier de sous-titres à partir de son nom
 */
function detectLanguage(filename: string): string | undefined {
  const lowerName = filename.toLowerCase();
  
  // Codes de langue courants
  const languageCodes: Record<string, string> = {
    'fr': 'Français',
    'en': 'Anglais',
    'es': 'Espagnol',
    'de': 'Allemand',
    'it': 'Italien',
    'pt': 'Portugais',
    'ru': 'Russe',
    'ja': 'Japonais',
    'zh': 'Chinois',
    'ar': 'Arabe'
  };

  // Noms de langue complets
  const languageNames: Record<string, string> = {
    'french': 'Français',
    'francais': 'Français',
    'english': 'Anglais',
    'spanish': 'Espagnol',
    'german': 'Allemand',
    'italian': 'Italien',
    'portuguese': 'Portugais',
    'russian': 'Russe',
    'japanese': 'Japonais',
    'chinese': 'Chinois',
    'arabic': 'Arabe'
  };

  // Chercher les codes de langue (ex: .fr.srt, .en.srt)
  for (const [code, name] of Object.entries(languageCodes)) {
    if (lowerName.includes(`.${code}.`) || lowerName.includes(`_${code}_`) || lowerName.includes(`-${code}-`)) {
      return name;
    }
  }

  // Chercher les noms complets
  for (const [name, fullName] of Object.entries(languageNames)) {
    if (lowerName.includes(name)) {
      return fullName;
    }
  }

  return undefined;
}

/**
 * Formate la taille d'un fichier en format lisible
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Détermine la qualité vidéo à partir de la taille du fichier et du nom
 */
export function detectVideoQuality(filename: string, fileSize: number): string {
  const lowerName = filename.toLowerCase();
  
  // Détection par le nom du fichier
  if (lowerName.includes('2160p') || lowerName.includes('4k') || lowerName.includes('uhd')) {
    return '4K';
  }
  if (lowerName.includes('1080p') || lowerName.includes('fullhd') || lowerName.includes('fhd')) {
    return '1080p';
  }
  if (lowerName.includes('720p') || lowerName.includes('hd')) {
    return '720p';
  }
  if (lowerName.includes('480p') || lowerName.includes('sd')) {
    return '480p';
  }

  // Détection par la taille du fichier (approximatif)
  // Pour un film de ~2h
  const sizeGB = fileSize / (1024 * 1024 * 1024);
  
  if (sizeGB > 15) return '4K';
  if (sizeGB > 5) return '1080p';
  if (sizeGB > 2) return '720p';
  return '480p';
}

/**
 * Vérifie si un chemin est accessible
 */
export async function checkPathAccess(folderPath: string): Promise<boolean> {
  try {
    await fs.access(folderPath);
    return true;
  } catch {
    return false;
  }
}




