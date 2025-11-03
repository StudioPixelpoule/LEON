import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const imageUrl = searchParams.get('url')

  if (!imageUrl) {
    return NextResponse.json({ error: 'URL manquante' }, { status: 400 })
  }

  try {
    // Vérifier que c'est bien une URL TMDB
    if (!imageUrl.startsWith('https://image.tmdb.org/')) {
      return NextResponse.json({ error: 'URL non autorisée' }, { status: 403 })
    }

    // Récupérer l'image depuis TMDB
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LEON/1.0)',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const buffer = await response.arrayBuffer()

    // Retourner l'image avec les bons headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Erreur proxy image:', error)
    return NextResponse.json({ error: 'Erreur récupération image' }, { status: 500 })
  }
}
