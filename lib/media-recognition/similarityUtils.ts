/**
 * Utilitaires de calcul de similarité entre chaînes
 * Utilisé pour la reconnaissance intelligente des médias
 */

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calcule un score de similarité entre 0 et 1
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  
  return 1 - (distance / maxLength);
}

/**
 * Normalise une chaîne pour la comparaison
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    // Retirer les accents
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Remplacer les caractères spéciaux par des espaces
    .replace(/[^a-z0-9\s]/gi, ' ')
    // Normaliser les espaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Vérifie si deux chaînes sont similaires (seuil configurable)
 */
export function areSimilar(str1: string, str2: string, threshold: number = 0.7): boolean {
  return calculateSimilarity(normalizeString(str1), normalizeString(str2)) >= threshold;
}

/**
 * Trouve le meilleur match dans une liste
 */
export function findBestMatch(target: string, candidates: string[]): { match: string; score: number } | null {
  if (!candidates.length) return null;
  
  const scores = candidates.map(candidate => ({
    match: candidate,
    score: calculateSimilarity(normalizeString(target), normalizeString(candidate))
  }));
  
  scores.sort((a, b) => b.score - a.score);
  
  return scores[0].score > 0 ? scores[0] : null;
}

/**
 * Calcule le score de Jaro-Winkler (plus adapté pour les noms courts)
 */
export function jaroWinklerSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  // Jaro distance
  const s1Len = str1.length;
  const s2Len = str2.length;
  
  if (s1Len === 0 && s2Len === 0) return 1;
  
  const matchDistance = Math.floor(Math.max(s1Len, s2Len) / 2) - 1;
  
  const s1Matches = new Array(s1Len).fill(false);
  const s2Matches = new Array(s2Len).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  // Identifier les matches
  for (let i = 0; i < s1Len; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2Len);
    
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || str1[i] !== str2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0;
  
  // Compter les transpositions
  let k = 0;
  for (let i = 0; i < s1Len; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }
  
  const jaro = (
    matches / s1Len +
    matches / s2Len +
    (matches - transpositions / 2) / matches
  ) / 3;
  
  // Winkler modification
  let prefixLength = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1Len, s2Len)); i++) {
    if (str1[i] === str2[i]) prefixLength++;
    else break;
  }
  
  const jaroWinkler = jaro + (prefixLength * 0.1 * (1 - jaro));
  
  return jaroWinkler;
}




