/**
 * Système d'association intelligente des sous-titres
 * Détecte et associe les fichiers de sous-titres même avec des noms différents
 */

import { calculateSimilarity, normalizeString, jaroWinklerSimilarity } from './similarityUtils';

export interface SubtitleMatch {
  filename: string;
  language: string;
  confidence: 'high' | 'medium' | 'low';
  score: number;
  isForced: boolean;
  isSDH: boolean; // Sous-titres pour sourds et malentendants
}

const SUBTITLE_EXTENSIONS = /\.(srt|vtt|ass|ssa|sub|sbv)$/i;

const LANGUAGE_CODES: Record<string, string[]> = {
  fr: ['fr', 'fra', 'fre', 'french', 'francais', 'vf', 'vff', 'truefrench'],
  en: ['en', 'eng', 'english', 'anglais', 'vo'],
  es: ['es', 'esp', 'spa', 'spanish', 'espagnol'],
  de: ['de', 'deu', 'ger', 'german', 'allemand'],
  it: ['it', 'ita', 'italian', 'italien'],
  pt: ['pt', 'por', 'portuguese', 'portugais'],
  ja: ['ja', 'jpn', 'japanese', 'japonais'],
  ko: ['ko', 'kor', 'korean', 'coreen'],
  zh: ['zh', 'chi', 'chinese', 'chinois'],
  ar: ['ar', 'ara', 'arabic', 'arabe'],
  ru: ['ru', 'rus', 'russian', 'russe'],
  nl: ['nl', 'dut', 'nld', 'dutch', 'neerlandais'],
  sv: ['sv', 'swe', 'swedish', 'suedois'],
  no: ['no', 'nor', 'norwegian', 'norvegien'],
  da: ['da', 'dan', 'danish', 'danois'],
  fi: ['fi', 'fin', 'finnish', 'finnois'],
  pl: ['pl', 'pol', 'polish', 'polonais'],
  tr: ['tr', 'tur', 'turkish', 'turc'],
  he: ['he', 'heb', 'hebrew', 'hebreu'],
  hi: ['hi', 'hin', 'hindi'],
};

/**
 * Trouve et associe les sous-titres à un fichier vidéo
 */
export async function findSubtitles(
  videoFile: string, 
  allFiles: string[]
): Promise<SubtitleMatch[]> {
  const videoBase = extractBaseName(videoFile);
  const subtitles: SubtitleMatch[] = [];
  
  // Filtrer les fichiers de sous-titres
  const subtitleFiles = allFiles.filter(file => SUBTITLE_EXTENSIONS.test(file));
  
  for (const subFile of subtitleFiles) {
    const subBase = extractBaseName(subFile);
    
    // Calculer le score de similarité
    const score = calculateMatchScore(videoBase, subBase);
    
    // Seuil minimum de 30% pour considérer une correspondance
    if (score > 30) {
      const language = detectLanguage(subFile);
      const isForced = detectForced(subFile);
      const isSDH = detectSDH(subFile);
      
      subtitles.push({
        filename: subFile,
        language,
        confidence: score > 80 ? 'high' : score > 60 ? 'medium' : 'low',
        score,
        isForced,
        isSDH
      });
    }
  }
  
  // Trier par score décroissant, puis par langue (français en premier)
  return subtitles.sort((a, b) => {
    if (Math.abs(a.score - b.score) < 5) {
      // Si les scores sont proches, privilégier le français
      if (a.language === 'fr' && b.language !== 'fr') return -1;
      if (a.language !== 'fr' && b.language === 'fr') return 1;
    }
    return b.score - a.score;
  });
}

/**
 * Extrait le nom de base d'un fichier (sans chemin ni extension)
 */
function extractBaseName(filename: string): string {
  // Retirer le chemin et l'extension
  const name = filename.split('/').pop() || filename;
  return name.replace(/\.[^.]+$/, '');
}

/**
 * Calcule le score de correspondance entre vidéo et sous-titre
 */
function calculateMatchScore(videoName: string, subtitleName: string): number {
  // Normaliser les deux noms
  const normVideo = normalizeString(videoName);
  const normSub = normalizeString(subtitleName);
  
  // Score de base : similarité directe (Levenshtein)
  let score = calculateSimilarity(normVideo, normSub) * 60;
  
  // Ajouter Jaro-Winkler pour améliorer la précision
  const jaroScore = jaroWinklerSimilarity(normVideo, normSub) * 40;
  score = (score + jaroScore) / 2;
  
  // Bonus si le nom du sous-titre commence par le nom de la vidéo
  if (normSub.startsWith(normVideo.substring(0, Math.min(normVideo.length, 10)))) {
    score += 20;
  }
  
  // Bonus pour les mots-clés communs importants
  const videoWords = normVideo.split(/\s+/).filter(w => w.length > 3);
  const subWords = normSub.split(/\s+/).filter(w => w.length > 3);
  
  const commonWords = videoWords.filter(word => 
    subWords.some(subWord => calculateSimilarity(word, subWord) > 0.8)
  );
  
  // Ajouter des points pour chaque mot commun (max 30 points)
  const wordBonus = Math.min(30, (commonWords.length / Math.max(videoWords.length, 1)) * 30);
  score += wordBonus;
  
  // Pénalité si le nom du sous-titre est beaucoup plus long
  const lengthRatio = normSub.length / Math.max(normVideo.length, 1);
  if (lengthRatio > 2) {
    score *= 0.8; // Réduction de 20%
  }
  
  return Math.min(100, Math.round(score));
}

/**
 * Détecte la langue d'un fichier de sous-titre
 */
function detectLanguage(filename: string): string {
  const lowerName = filename.toLowerCase();
  
  for (const [langCode, patterns] of Object.entries(LANGUAGE_CODES)) {
    for (const pattern of patterns) {
      // Chercher le pattern comme mot séparé
      const regex = new RegExp(`[._\\-\\s\\[\\(]${pattern}[._\\-\\s\\]\\)]`, 'i');
      if (regex.test(lowerName)) {
        return langCode;
      }
    }
  }
  
  // Si aucune langue détectée, essayer de deviner par le contexte
  // Les fichiers sans indication sont souvent dans la langue originale
  return 'unknown';
}

/**
 * Détecte si le sous-titre est "forcé" (pour dialogues en langue étrangère uniquement)
 */
function detectForced(filename: string): boolean {
  return /forced|forcé|force/i.test(filename);
}

/**
 * Détecte si le sous-titre est SDH (pour sourds et malentendants)
 */
function detectSDH(filename: string): boolean {
  return /sdh|cc|deaf|malentendant|sourds|hearing.impaired/i.test(filename);
}

/**
 * Formate les informations d'un sous-titre pour affichage
 */
export function formatSubtitleInfo(subtitle: SubtitleMatch): string {
  const parts = [];
  
  // Langue
  const langNames: Record<string, string> = {
    fr: 'Français',
    en: 'Anglais',
    es: 'Espagnol',
    de: 'Allemand',
    it: 'Italien',
    pt: 'Portugais',
    ja: 'Japonais',
    ko: 'Coréen',
    zh: 'Chinois',
    ar: 'Arabe',
    ru: 'Russe',
    nl: 'Néerlandais',
    sv: 'Suédois',
    no: 'Norvégien',
    da: 'Danois',
    fi: 'Finnois',
    pl: 'Polonais',
    tr: 'Turc',
    he: 'Hébreu',
    hi: 'Hindi',
    unknown: 'Non défini'
  };
  parts.push(langNames[subtitle.language] || subtitle.language.toUpperCase());
  
  // Tags spéciaux
  if (subtitle.isForced) parts.push('Forcé');
  if (subtitle.isSDH) parts.push('SDH');
  
  // Niveau de confiance
  if (subtitle.confidence === 'low') {
    parts.push(`(${subtitle.score}% match)`);
  }
  
  return parts.join(' · ');
}

/**
 * Groupe les sous-titres par langue
 */
export function groupSubtitlesByLanguage(subtitles: SubtitleMatch[]): Record<string, SubtitleMatch[]> {
  const grouped: Record<string, SubtitleMatch[]> = {};
  
  for (const sub of subtitles) {
    if (!grouped[sub.language]) {
      grouped[sub.language] = [];
    }
    grouped[sub.language].push(sub);
  }
  
  return grouped;
}

/**
 * Sélectionne automatiquement le meilleur sous-titre (privilégie le français)
 */
export function selectBestSubtitle(subtitles: SubtitleMatch[]): SubtitleMatch | null {
  if (!subtitles.length) return null;
  
  // Chercher le meilleur sous-titre français
  const frenchSubs = subtitles.filter(s => s.language === 'fr' && !s.isForced);
  if (frenchSubs.length > 0) {
    return frenchSubs[0]; // Déjà trié par score
  }
  
  // Sinon retourner le premier (meilleur score toutes langues confondues)
  return subtitles[0];
}




