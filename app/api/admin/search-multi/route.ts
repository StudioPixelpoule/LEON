/**
 * API Admin: Recherche multi-sources (TMDB + OMDb)
 * POST /api/admin/search-multi
 * Body: { query: string, year?: number }
 * 
 * Retourne les 4 meilleurs résultats agrégés de plusieurs sources
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

const TMDB_API_KEY = process.env.TMDB_API_KEY
const OMDB_API_KEY = process.env.OMDB_API_KEY || 'b9a5c8f8' // Clé publique OMDb

interface SearchResult {
  id: string // Format: "tmdb_12345" ou "imdb_tt1234567"
  source: 'tmdb' | 'omdb'
  title: string
  original_title: string
  year: number | null
  poster_url: string | null
  poster_high_res: string | null // Haute résolution si disponible
  backdrop_url: string | null
  overview: string
  rating: number
  confidence: number // Score de pertinence 0-100
}

export async function POST(request: NextRequest) {
  // Vérification admin OBLIGATOIRE
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

  try {
    const body = await request.json()
    const { query, year } = body
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Requête trop courte' },
        { status: 400 }
      )
    }
    
    const results: SearchResult[] = []
    
    // 1. Recherche TMDB (source principale)
    if (TMDB_API_KEY) {
      try {
        const tmdbUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=fr-FR${year ? `&year=${year}` : ''}`
        const tmdbResponse = await fetch(tmdbUrl)
        const tmdbData = await tmdbResponse.json()
        
        if (tmdbData.results && tmdbData.results.length > 0) {
          tmdbData.results.slice(0, 6).forEach((movie: any) => {
            const confidence = calculateConfidence(query, movie.title, movie.original_title, year, movie.release_date?.split('-')[0])
            
            results.push({
              id: `tmdb_${movie.id}`,
              source: 'tmdb',
              title: movie.title,
              original_title: movie.original_title || movie.title,
              year: movie.release_date ? parseInt(movie.release_date.split('-')[0]) : null,
              poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
              poster_high_res: movie.poster_path ? `https://image.tmdb.org/t/p/original${movie.poster_path}` : null,
              backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
              overview: movie.overview || '',
              rating: movie.vote_average || 0,
              confidence
            })
          })
        }
      } catch (error) {
        console.error('❌ Erreur recherche TMDB:', error)
      }
    }
    
    // 2. Recherche OMDb (source alternative pour jaquettes différentes)
    if (OMDB_API_KEY) {
      try {
        const omdbUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(query)}&type=movie${year ? `&y=${year}` : ''}`
        const omdbResponse = await fetch(omdbUrl)
        const omdbData = await omdbResponse.json()
        
        if (omdbData.Search && omdbData.Search.length > 0) {
          // Récupérer les détails complets pour chaque résultat
          const detailsPromises = omdbData.Search.slice(0, 3).map(async (movie: any) => {
            try {
              const detailUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${movie.imdbID}&plot=full`
              const detailResponse = await fetch(detailUrl)
              return await detailResponse.json()
            } catch {
              return null
            }
          })
          
          const details = await Promise.all(detailsPromises)
          
          details.forEach((movie: any) => {
            if (!movie || movie.Response === 'False') return
            
            // Éviter les doublons avec TMDB (même année + titre similaire)
            const isDuplicate = results.some(r => 
              r.year === parseInt(movie.Year) && 
              similarity(r.title.toLowerCase(), movie.Title.toLowerCase()) > 0.8
            )
            
            if (!isDuplicate) {
              const confidence = calculateConfidence(query, movie.Title, movie.Title, year, movie.Year)
              
              results.push({
                id: `imdb_${movie.imdbID}`,
                source: 'omdb',
                title: movie.Title,
                original_title: movie.Title,
                year: movie.Year ? parseInt(movie.Year) : null,
                poster_url: movie.Poster !== 'N/A' ? movie.Poster : null,
                poster_high_res: movie.Poster !== 'N/A' ? movie.Poster : null,
                backdrop_url: null,
                overview: movie.Plot !== 'N/A' ? movie.Plot : '',
                rating: movie.imdbRating !== 'N/A' ? parseFloat(movie.imdbRating) : 0,
                confidence
              })
            }
          })
        }
      } catch (error) {
        console.error('❌ Erreur recherche OMDb:', error)
      }
    }
    
    // Trier par confiance et limiter à 6 résultats
    const sortedResults = results
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 6)
    
    return NextResponse.json({
      success: true,
      count: sortedResults.length,
      results: sortedResults
    })
    
  } catch (error) {
    console.error('❌ Erreur recherche multi-sources:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recherche' },
      { status: 500 }
    )
  }
}

/**
 * Calcule un score de confiance entre 0 et 100
 */
function calculateConfidence(
  query: string,
  title: string,
  originalTitle: string,
  queryYear: number | undefined,
  resultYear: string | number | undefined
): number {
  let score = 0
  
  const normalizedQuery = query.toLowerCase().trim()
  const normalizedTitle = title.toLowerCase().trim()
  const normalizedOriginal = originalTitle.toLowerCase().trim()
  
  // Correspondance exacte du titre
  if (normalizedQuery === normalizedTitle || normalizedQuery === normalizedOriginal) {
    score += 50
  } else {
    // Similarité du titre
    const titleSim = similarity(normalizedQuery, normalizedTitle)
    const originalSim = similarity(normalizedQuery, normalizedOriginal)
    score += Math.max(titleSim, originalSim) * 40
  }
  
  // Correspondance de l'année
  if (queryYear && resultYear) {
    const yearDiff = Math.abs(queryYear - (typeof resultYear === 'string' ? parseInt(resultYear) : resultYear))
    if (yearDiff === 0) score += 30
    else if (yearDiff === 1) score += 20
    else if (yearDiff <= 3) score += 10
  } else {
    score += 15 // Bonus si pas de contrainte d'année
  }
  
  // Bonus si présence de poster
  score += 10
  
  return Math.min(100, Math.round(score))
}

/**
 * Calcule la similarité entre deux chaînes (algorithme de Jaro-Winkler simplifié)
 */
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  
  if (longer.length === 0) return 1.0
  
  const editDistance = levenshtein(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

/**
 * Distance de Levenshtein
 */
function levenshtein(s1: string, s2: string): number {
  const costs: number[] = []
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else if (j > 0) {
        let newValue = costs[j - 1]
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
        }
        costs[j - 1] = lastValue
        lastValue = newValue
      }
    }
    if (i > 0) costs[s2.length] = lastValue
  }
  return costs[s2.length]
}




