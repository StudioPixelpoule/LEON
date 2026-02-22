/**
 * API: Rechercher des sous-titres sur OpenSubtitles REST API
 * GET /api/subtitles/search?path=/chemin/vers/video.mp4&lang=fr
 * Retourne la liste des sous-titres disponibles
 * 
 * Remplace l'ancienne dépendance subliminal (Python) par l'API REST OpenSubtitles.
 */

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { validateMediaPath } from '@/lib/path-validator'

export const dynamic = 'force-dynamic'

const OPENSUBTITLES_API_KEY = process.env.OPENSUBTITLES_API_KEY
const OPENSUBTITLES_BASE = 'https://api.opensubtitles.com/api/v1'

const VALID_LANGS: Record<string, string> = {
  'fr': 'fr', 'en': 'en', 'es': 'es', 'de': 'de',
  'it': 'it', 'pt': 'pt-BR', 'nl': 'nl', 'ja': 'ja',
  'ko': 'ko', 'zh': 'zh-CN',
  'fra': 'fr', 'eng': 'en', 'spa': 'es', 'deu': 'de',
  'ita': 'it', 'por': 'pt-BR',
}

function extractTitleFromFilename(filename: string): string {
  const basename = path.basename(filename, path.extname(filename))
  return basename
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .replace(/\(\d{4}\)/, '')
    .replace(/\[\w+\]/g, '')
    .replace(/\b(1080p|720p|2160p|4k|BluRay|BDRip|WEBRip|WEB-DL|HDRip|x264|x265|HEVC|AAC|DTS|REMUX)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepathRaw = searchParams.get('path')
  const lang = searchParams.get('lang') || 'fr'

  if (!filepathRaw) {
    return NextResponse.json({ error: 'Paramètre path manquant' }, { status: 400 })
  }

  const validation = validateMediaPath(filepathRaw)
  if (!validation.valid) {
    return NextResponse.json({ error: 'Chemin non autorisé' }, { status: 403 })
  }

  const osLang = VALID_LANGS[lang]
  if (!osLang) {
    return NextResponse.json({ error: `Langue non supportée: ${lang}` }, { status: 400 })
  }

  if (!OPENSUBTITLES_API_KEY) {
    return NextResponse.json({
      error: 'Clé API OpenSubtitles non configurée',
      suggestion: 'Ajoutez OPENSUBTITLES_API_KEY dans votre .env (gratuit sur opensubtitles.com/consumers)'
    }, { status: 500 })
  }

  const filepath = validation.normalized || filepathRaw.normalize('NFC')
  const title = extractTitleFromFilename(filepath)

  console.log(`[SUBTITLES] Recherche: "${title}" (${osLang})`)

  try {
    const searchUrl = new URL(`${OPENSUBTITLES_BASE}/subtitles`)
    searchUrl.searchParams.set('query', title)
    searchUrl.searchParams.set('languages', osLang)

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'Api-Key': OPENSUBTITLES_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'LEON v1.0',
      }
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[SUBTITLES] Erreur recherche (${response.status}):`, errorBody.slice(0, 300))
      return NextResponse.json({
        error: `Erreur OpenSubtitles (${response.status})`,
        details: errorBody.slice(0, 200)
      }, { status: 502 })
    }

    const data = await response.json()

    if (!data.data || data.data.length === 0) {
      return NextResponse.json({
        error: 'Aucun sous-titre disponible pour ce film',
        suggestion: 'Essayez de chercher manuellement sur opensubtitles.com'
      }, { status: 404 })
    }

    interface OpenSubtitlesResult {
      id: string
      attributes: {
        release?: string
        language?: string
        download_count?: number
        hearing_impaired?: boolean
        foreign_parts_only?: boolean
        files?: Array<{ file_id: number; file_name?: string }>
        feature_details?: {
          title?: string
          year?: number
        }
      }
    }

    const results = data.data.map((item: OpenSubtitlesResult) => ({
      id: item.id,
      release: item.attributes?.release,
      language: item.attributes?.language,
      downloadCount: item.attributes?.download_count,
      hearingImpaired: item.attributes?.hearing_impaired,
      foreignPartsOnly: item.attributes?.foreign_parts_only,
      fileId: item.attributes?.files?.[0]?.file_id,
      fileName: item.attributes?.files?.[0]?.file_name,
      movieTitle: item.attributes?.feature_details?.title,
      year: item.attributes?.feature_details?.year,
    }))

    console.log(`[SUBTITLES] ${results.length} résultats trouvés pour "${title}"`)

    return NextResponse.json({
      success: true,
      query: title,
      language: osLang,
      count: results.length,
      results
    })

  } catch (error) {
    console.error('❌ Erreur recherche sous-titres:', error)
    return NextResponse.json({
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}
