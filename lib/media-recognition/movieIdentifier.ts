/**
 * Système d'identification intelligente des films
 * Utilise TMDB API + algorithmes de similarité + cache d'apprentissage
 */

import { searchMovie, getMovieDetails, type TMDBMovie } from '@/lib/tmdb';
import { calculateSimilarity, jaroWinklerSimilarity } from './similarityUtils';
import { getManualMatch, type ManualMatch } from './learningCache';

export interface MovieMatch {
  tmdbId: number;
  title: string;
  originalTitle: string;
  year: number;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  confidence: number;
  needsReview: boolean;
}

interface CleanedInfo {
  title: string;
  year: number | null;
  quality: string | null;
}

// Patterns de nettoyage des noms de fichiers
const QUALITY_PATTERNS = /\b(1080p|720p|2160p|4K|UHD|HDR|BluRay|BDRip|WEB-DL|WEBRip|DVDRip|HDTV)\b/gi;
const CODEC_PATTERNS = /\b(x264|x265|h264|h265|HEVC|AVC|DivX|XviD)\b/gi;
const AUDIO_PATTERNS = /\b(DTS|AC3|AAC|MP3|FLAC|TrueHD|Atmos|5\.1|7\.1)\b/gi;
const LANGUAGE_PATTERNS = /\b(FRENCH|MULTI|TRUEFRENCH|VFF|VOSTFR|SUBFRENCH|VO|VF)\b/gi;
const RELEASE_PATTERNS = /\b(PROPER|REPACK|EXTENDED|UNRATED|DC|DIRECTORS\.CUT|THEATRICAL)\b/gi;
const GROUP_PATTERNS = /\-[A-Z0-9]+$/; // Release groups comme -SPARKS

/**
 * Identifie un film à partir de son nom de fichier
 */
export async function identifyMovie(filename: string): Promise<MovieMatch | null> {
  try {
    // 1. Vérifier d'abord le cache manuel
    const manualMatch = await getManualMatch(filename);
    if (manualMatch) {
      return convertManualMatchToMovieMatch(manualMatch);
    }

    // 2. Nettoyer le nom de fichier
    const cleanedInfo = cleanFilename(filename);
    
    if (!cleanedInfo.title || cleanedInfo.title.length < 2) {
      console.warn(`Titre trop court après nettoyage: ${cleanedInfo.title}`);
      return null;
    }
    
    // 3. Recherche progressive sur TMDB
    let results: TMDBMovie[] = [];
    
    // Tentative 1: Titre + année (si disponible)
    if (cleanedInfo.year) {
      results = await searchMovie(cleanedInfo.title, cleanedInfo.year);
    }
    
    // Tentative 2: Titre seul
    if (!results?.length) {
      results = await searchMovie(cleanedInfo.title);
    }
    
    // Tentative 3: Recherche par mots-clés si titre trop long
    if (!results?.length && cleanedInfo.title.split(' ').length > 4) {
      const keywords = extractKeywords(cleanedInfo.title);
      results = await searchMovie(keywords);
    }
    
    // 4. Calculer les scores de confiance
    if (results && results.length > 0) {
      const matches = results.map(movie => {
        const match = convertTMDBMovieToMatch(movie, cleanedInfo);
        return match;
      });
      
      // Trier par confiance
      matches.sort((a, b) => b.confidence - a.confidence);
      
      // Filtrer les résultats avec confiance trop faible
      if (matches[0].confidence < 20) {
        return null;
      }
      
      // Marquer pour review si confiance < 70%
      if (matches[0].confidence < 70) {
        matches[0].needsReview = true;
      }
      
      return matches[0];
    }
    
    return null;
  } catch (error) {
    console.error('Erreur identification film:', error);
    return null;
  }
}

/**
 * Nettoie un nom de fichier pour extraire les informations
 */
function cleanFilename(filename: string): CleanedInfo {
  // Retirer l'extension
  let clean = filename.replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i, '');
  
  // Extraire l'année
  const yearMatch = clean.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[0]) : null;
  
  // Extraire la qualité
  const qualityMatch = clean.match(QUALITY_PATTERNS);
  const quality = qualityMatch ? qualityMatch[0] : null;
  
  // Nettoyer le titre
  clean = clean
    // Remplacer les séparateurs par des espaces
    .replace(/[\._\-\[\](){}]/g, ' ')
    // Retirer les tags de qualité
    .replace(QUALITY_PATTERNS, '')
    // Retirer les codecs
    .replace(CODEC_PATTERNS, '')
    // Retirer les infos audio
    .replace(AUDIO_PATTERNS, '')
    // Retirer les langues
    .replace(LANGUAGE_PATTERNS, '')
    // Retirer les releases
    .replace(RELEASE_PATTERNS, '')
    // Retirer les groupes de release
    .replace(GROUP_PATTERNS, '')
    // Retirer l'année du titre
    .replace(year ? year.toString() : '', '')
    // Normaliser les espaces
    .replace(/\s+/g, ' ')
    .trim();
  
  return { title: clean, year, quality };
}

/**
 * Normalise les numéros de suite pour la comparaison
 * "Dune 2" → ["Dune 2", "Dune Part Two", "Dune Part 2", "Dune Deuxième Partie"]
 */
function normalizeSequelNumbers(title: string): string[] {
  const variants = [title];
  
  // Mapping chiffres → texte
  const numberWords: Record<string, string[]> = {
    '2': ['Two', 'II', 'Deuxième Partie', 'Part Two', 'Part 2', 'Partie 2'],
    '3': ['Three', 'III', 'Troisième Partie', 'Part Three', 'Part 3', 'Partie 3'],
    '4': ['Four', 'IV', 'Part Four', 'Part 4', 'Partie 4'],
    '5': ['Five', 'V', 'Part Five', 'Part 5', 'Partie 5'],
  };
  
  // Chercher un chiffre à la fin du titre
  const match = title.match(/^(.+?)\s*(\d)$/);
  if (match) {
    const baseName = match[1].trim();
    const number = match[2];
    
    if (numberWords[number]) {
      for (const word of numberWords[number]) {
        variants.push(`${baseName} ${word}`);
        variants.push(`${baseName}: ${word}`);
      }
    }
  }
  
  return variants;
}

/**
 * Calcule le score de confiance d'une correspondance
 */
function calculateConfidence(fileInfo: CleanedInfo, tmdbMovie: TMDBMovie): number {
  let score = 0;
  
  // Générer les variantes du titre pour les suites
  const titleVariants = normalizeSequelNumbers(fileInfo.title);
  
  // Similarité du titre français (40 points max)
  // Tester toutes les variantes et prendre le meilleur score
  let bestTitleScore = 0;
  for (const variant of titleVariants) {
    const titleSimilarity = calculateSimilarity(
      variant.toLowerCase(),
      tmdbMovie.title.toLowerCase()
    );
    const jaroScore = jaroWinklerSimilarity(
      variant.toLowerCase(),
      tmdbMovie.title.toLowerCase()
    );
    const combinedScore = (titleSimilarity * 0.6 + jaroScore * 0.4);
    bestTitleScore = Math.max(bestTitleScore, combinedScore);
  }
  score += bestTitleScore * 40;
  
  // Correspondance de l'année (30 points)
  if (fileInfo.year && tmdbMovie.release_date) {
    const movieYear = new Date(tmdbMovie.release_date).getFullYear();
    if (fileInfo.year === movieYear) {
      score += 30;
    } else if (Math.abs(fileInfo.year - movieYear) === 1) {
      score += 15; // Année proche (±1)
    } else if (Math.abs(fileInfo.year - movieYear) === 2) {
      score += 5; // Année éloignée (±2)
    }
  } else if (!fileInfo.year) {
    // Pas de pénalité si pas d'année dans le fichier
    score += 10; // Bonus neutre
  }
  
  // Popularité du film (20 points)
  if (tmdbMovie.popularity > 50) score += 20;
  else if (tmdbMovie.popularity > 20) score += 15;
  else if (tmdbMovie.popularity > 10) score += 10;
  else score += 5;
  
  // Titre original si différent (10 points bonus)
  if (tmdbMovie.original_title && tmdbMovie.original_title !== tmdbMovie.title) {
    // Tester toutes les variantes contre le titre original aussi
    for (const variant of titleVariants) {
      const origSimilarity = calculateSimilarity(
        variant.toLowerCase(),
        tmdbMovie.original_title.toLowerCase()
      );
      if (origSimilarity > 0.8) {
        score += 10;
        break;
      }
    }
  }
  
  return Math.min(100, Math.round(score));
}

/**
 * Extrait les mots-clés importants d'un titre
 */
function extractKeywords(title: string): string {
  // Garder les mots importants (> 3 caractères) ET les chiffres (pour les suites)
  const words = title.split(' ')
    .filter(word => word.length > 3 || /^\d+$/.test(word))
    .slice(0, 4); // Max 4 mots-clés
  return words.join(' ');
}

/**
 * Convertit un ManualMatch en MovieMatch
 */
function convertManualMatchToMovieMatch(match: ManualMatch): MovieMatch {
  return {
    tmdbId: match.tmdbId,
    title: match.title,
    originalTitle: match.title,
    year: match.year,
    posterPath: match.posterPath,
    backdropPath: null,
    overview: '',
    confidence: 100,
    needsReview: false
  };
}

/**
 * Convertit un TMDBMovie en MovieMatch avec calcul de confiance
 */
function convertTMDBMovieToMatch(movie: TMDBMovie, fileInfo: CleanedInfo): MovieMatch {
  const confidence = calculateConfidence(fileInfo, movie);
  
  return {
    tmdbId: movie.id,
    title: movie.title,
    originalTitle: movie.original_title,
    year: movie.release_date ? new Date(movie.release_date).getFullYear() : 0,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    overview: movie.overview,
    confidence,
    needsReview: confidence < 70
  };
}

/**
 * Identifie plusieurs films en batch (optimisé)
 */
export async function identifyMovieBatch(filenames: string[]): Promise<Map<string, MovieMatch | null>> {
  const results = new Map<string, MovieMatch | null>();
  
  // Traiter par lots de 5 pour éviter de surcharger l'API
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < filenames.length; i += BATCH_SIZE) {
    const batch = filenames.slice(i, i + BATCH_SIZE);
    
    const promises = batch.map(async filename => {
      const match = await identifyMovie(filename);
      return { filename, match };
    });
    
    const batchResults = await Promise.all(promises);
    
    batchResults.forEach(({ filename, match }) => {
      results.set(filename, match);
    });
    
    // Petit délai entre les batchs pour respecter les rate limits
    if (i + BATCH_SIZE < filenames.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

/**
 * Retourne des suggestions alternatives pour un fichier
 */
export async function getSuggestions(filename: string, limit: number = 5): Promise<MovieMatch[]> {
  try {
    const cleanedInfo = cleanFilename(filename);
    
    if (!cleanedInfo.title) return [];
    
    // Recherche large
    const results = await searchMovie(cleanedInfo.title);
    
    if (!results?.length) return [];
    
    // Convertir et trier par confiance
    const matches = results
      .slice(0, limit * 2) // Prendre plus de résultats pour filtrer
      .map(movie => convertTMDBMovieToMatch(movie, cleanedInfo))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
    
    return matches;
  } catch (error) {
    console.error('Erreur récupération suggestions:', error);
    return [];
  }
}




