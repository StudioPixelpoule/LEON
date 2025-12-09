/**
 * API Route: Récupérer la bande-annonce YouTube d'un film/série
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TMDB_KEY = process.env.TMDB_API_KEY || ''
const TMDB_BASE = 'https://api.themoviedb.org/3'

interface TMDBVideo {
  key: string
  site: string
  type: string
  official: boolean
  name: string
  published_at: string
}

interface TMDBVideosResponse {
  results: TMDBVideo[]
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tmdbId = searchParams.get('tmdb_id')
    const type = searchParams.get('type') || 'movie' // 'movie' ou 'tv'

    if (!tmdbId) {
      return NextResponse.json({ 
        success: false, 
        error: 'tmdb_id requis' 
      }, { status: 400 })
    }

    if (!TMDB_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: 'TMDB_API_KEY non configurée' 
      }, { status: 500 })
    }

    // Récupérer les vidéos depuis TMDB
    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      language: 'fr-FR'
    })

    const response = await fetch(
      `${TMDB_BASE}/${type}/${tmdbId}/videos?${params}`
    )

    if (!response.ok) {
      // Essayer en anglais si pas de résultat en français
      const enParams = new URLSearchParams({
        api_key: TMDB_KEY,
        language: 'en-US'
      })
      
      const enResponse = await fetch(
        `${TMDB_BASE}/${type}/${tmdbId}/videos?${enParams}`
      )
      
      if (!enResponse.ok) {
        return NextResponse.json({ 
          success: false, 
          error: 'Erreur TMDB' 
        }, { status: 500 })
      }
      
      const enData: TMDBVideosResponse = await enResponse.json()
      const trailer = findBestTrailer(enData.results)
      
      return NextResponse.json({
        success: true,
        trailer: trailer ? {
          key: trailer.key,
          name: trailer.name,
          site: trailer.site,
          type: trailer.type
        } : null
      })
    }

    const data: TMDBVideosResponse = await response.json()
    
    // Chercher d'abord en français, sinon en anglais
    let trailer = findBestTrailer(data.results)
    
    if (!trailer) {
      // Fallback anglais
      const enParams = new URLSearchParams({
        api_key: TMDB_KEY,
        language: 'en-US'
      })
      
      const enResponse = await fetch(
        `${TMDB_BASE}/${type}/${tmdbId}/videos?${enParams}`
      )
      
      if (enResponse.ok) {
        const enData: TMDBVideosResponse = await enResponse.json()
        trailer = findBestTrailer(enData.results)
      }
    }

    return NextResponse.json({
      success: true,
      trailer: trailer ? {
        key: trailer.key,
        name: trailer.name,
        site: trailer.site,
        type: trailer.type
      } : null
    })
  } catch (error) {
    console.error('❌ Erreur récupération trailer:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Erreur serveur' 
    }, { status: 500 })
  }
}

/**
 * Trouver le meilleur trailer
 * Priorité: Trailer officiel YouTube > Teaser > Autre vidéo
 */
function findBestTrailer(videos: TMDBVideo[]): TMDBVideo | null {
  if (!videos || videos.length === 0) return null

  // 1. Trailer officiel YouTube
  const officialTrailer = videos.find(
    v => v.type === 'Trailer' && v.site === 'YouTube' && v.official
  )
  if (officialTrailer) return officialTrailer

  // 2. Tout trailer YouTube
  const anyTrailer = videos.find(
    v => v.type === 'Trailer' && v.site === 'YouTube'
  )
  if (anyTrailer) return anyTrailer

  // 3. Teaser YouTube
  const teaser = videos.find(
    v => v.type === 'Teaser' && v.site === 'YouTube'
  )
  if (teaser) return teaser

  // 4. N'importe quelle vidéo YouTube
  const anyYouTube = videos.find(v => v.site === 'YouTube')
  return anyYouTube || null
}

