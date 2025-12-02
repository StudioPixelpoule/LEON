/**
 * Identification universelle de médias (films ET séries TV)
 * Utilise la sanitization et recherche TMDB films + séries
 */

import { sanitizeFilename } from './filenameSanitizer'
import { searchMedia, type MediaType, type TMDBMovie, type TMDBTVShow } from '../tmdb'
import { calculateSimilarity } from './similarityUtils'
import { getManualMatch, saveManualMatch } from './learningCache'

export type UniversalMediaMatch = {
  type: MediaType
  tmdbId: number
  title: string
  originalTitle: string
  year: number | null
  posterPath: string | null
  backdropPath: string | null
  overview: string
  confidence: number
  // Champs spécifiques aux séries
  seasonNumber?: number
  episodeNumber?: number
  showName?: string
}

/**
 * Identifie un média (film ou série) depuis un nom de fichier
 */
export async function identifyMedia(
  filename: string
): Promise<UniversalMediaMatch | null> {
  console.log(`\n🔍 Identification: ${filename}`)

  // 1. Vérifier le cache d'apprentissage
  const cached = await getManualMatch(filename)
  if (cached) {
    console.log(`✅ Trouvé dans le cache: ${cached.title}`)
    return {
      type: 'movie', // Le cache actuel ne gère que les films, à étendre
      tmdbId: cached.tmdbId,
      title: cached.title,
      originalTitle: cached.title,
      year: cached.year,
      posterPath: cached.posterPath,
      backdropPath: null,
      overview: '',
      confidence: 100,
    }
  }

  // 2. Sanitizer le nom de fichier
  const { cleanName, year, isTVShow, tvInfo } = sanitizeFilename(filename)
  console.log(`📝 Nom nettoyé: "${cleanName}"`)
  console.log(`📅 Année détectée: ${year || 'N/A'}`)
  console.log(`📺 Type détecté: ${isTVShow ? 'Série TV' : 'Film'}`)

  if (tvInfo) {
    console.log(`📺 Info série: ${tvInfo.showName} S${tvInfo.season}E${tvInfo.episode}`)
  }

  // 3. Rechercher sur TMDB (films ET séries)
  const mediaType: MediaType | undefined = isTVShow ? 'tv' : undefined // undefined = chercher les deux
  // Pour les séries, chercher UNIQUEMENT le nom de la série (sans S01E01)
  const searchQuery = isTVShow && tvInfo ? tvInfo.showName : cleanName
  console.log(`🔎 Recherche TMDB: "${searchQuery}"${year ? ` (${year})` : ''}`)
  const results = await searchMedia(searchQuery, year ?? undefined, mediaType)

  if (results.length === 0) {
    console.log(`❌ Aucun résultat TMDB`)
    return null
  }

  // 4. Calculer les scores de similarité
  type ScoredResult = {
    result: typeof results[0]
    similarity: number
    yearMatch: boolean
    totalScore: number
  }

  const scoredResults: ScoredResult[] = results.map(result => {
    const resultTitle = result.type === 'movie' 
      ? (result.data as TMDBMovie).title 
      : (result.data as TMDBTVShow).name
    
    const resultOriginalTitle = result.type === 'movie'
      ? (result.data as TMDBMovie).original_title
      : (result.data as TMDBTVShow).original_name

    const resultYear = result.type === 'movie'
      ? new Date((result.data as TMDBMovie).release_date).getFullYear()
      : new Date((result.data as TMDBTVShow).first_air_date).getFullYear()

    // Similarité du titre (0-1) converti en pourcentage (0-100)
    const titleSimilarity = Math.max(
      calculateSimilarity(cleanName.toLowerCase(), resultTitle.toLowerCase()),
      calculateSimilarity(cleanName.toLowerCase(), resultOriginalTitle.toLowerCase())
    ) * 100

    // Bonus si l'année correspond
    const yearMatch = year ? resultYear === year : false
    const yearBonus = yearMatch ? 20 : 0

    // Bonus si le type correspond
    const typeBonus = (isTVShow && result.type === 'tv') || (!isTVShow && result.type === 'movie') ? 10 : 0

    const totalScore = titleSimilarity + yearBonus + typeBonus

    return {
      result,
      similarity: titleSimilarity,
      yearMatch,
      totalScore,
    }
  })

  // Trier par score total
  scoredResults.sort((a, b) => b.totalScore - a.totalScore)

  const best = scoredResults[0]
  console.log(`🎯 Meilleur match: ${best.result.type === 'movie' ? (best.result.data as TMDBMovie).title : (best.result.data as TMDBTVShow).name} (score: ${best.totalScore})`)

  // Seuil de confiance minimum: 50 (abaissé pour accepter plus de correspondances)
  // Les correspondances exactes auront un score élevé grâce au calcul de similarité
  if (best.totalScore < 50) {
    console.log(`⚠️  Confiance trop faible: ${best.totalScore}`)
    return null
  }

  // 5. Construire le résultat
  const match: UniversalMediaMatch = {
    type: best.result.type,
    tmdbId: best.result.data.id,
    title: best.result.type === 'movie' 
      ? (best.result.data as TMDBMovie).title 
      : (best.result.data as TMDBTVShow).name,
    originalTitle: best.result.type === 'movie'
      ? (best.result.data as TMDBMovie).original_title
      : (best.result.data as TMDBTVShow).original_name,
    year: best.result.type === 'movie'
      ? new Date((best.result.data as TMDBMovie).release_date).getFullYear()
      : new Date((best.result.data as TMDBTVShow).first_air_date).getFullYear(),
    posterPath: best.result.data.poster_path,
    backdropPath: best.result.data.backdrop_path,
    overview: best.result.data.overview,
    confidence: Math.round(best.totalScore),
  }

  // Ajouter les infos de série si applicable
  if (best.result.type === 'tv' && tvInfo) {
    match.seasonNumber = tvInfo.season ?? undefined
    match.episodeNumber = tvInfo.episode ?? undefined
    match.showName = tvInfo.showName
  }

  return match
}
