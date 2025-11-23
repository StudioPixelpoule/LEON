import { NextRequest, NextResponse } from 'next/server'

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')

    if (!query) {
      return NextResponse.json(
        { error: 'Le paramètre query est requis' },
        { status: 400 }
      )
    }

    if (!TMDB_API_KEY) {
      console.error('❌ TMDB_API_KEY non configurée')
      return NextResponse.json(
        { error: 'TMDB API key non configurée' },
        { status: 500 }
      )
    }

    // Recherche de films sur TMDB
    const tmdbUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}&include_adult=false`
    
    console.log(`🔍 Recherche TMDB: "${query}"`)
    
    const response = await fetch(tmdbUrl)
    
    if (!response.ok) {
      console.error(`❌ Erreur TMDB API: ${response.status}`)
      return NextResponse.json(
        { error: 'Erreur lors de la recherche TMDB' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    console.log(`✅ ${data.results?.length || 0} résultats trouvés pour "${query}"`)

    return NextResponse.json({
      success: true,
      results: data.results || [],
      total_results: data.total_results || 0
    })

  } catch (error) {
    console.error('❌ Erreur recherche TMDB:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la recherche' },
      { status: 500 }
    )
  }
}
