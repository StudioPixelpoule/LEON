/**
 * API: Télécharger des sous-titres depuis OpenSubtitles REST API
 * GET /api/subtitles/fetch?path=/chemin/vers/video.mp4&lang=fr&forced=false
 * Retourne les sous-titres en WebVTT pour affichage direct dans le lecteur
 * 
 * Remplace l'ancienne dépendance subliminal (Python) par l'API REST OpenSubtitles.
 * Nécessite OPENSUBTITLES_API_KEY dans les variables d'environnement.
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import path from 'path'
import { promises as fs } from 'fs'
import { validateMediaPath } from '@/lib/path-validator'

const OPENSUBTITLES_API_KEY = process.env.OPENSUBTITLES_API_KEY
const OPENSUBTITLES_BASE = 'https://api.opensubtitles.com/api/v1'

const VALID_LANGS: Record<string, string> = {
  'fr': 'fr', 'en': 'en', 'es': 'es', 'de': 'de',
  'it': 'it', 'pt': 'pt-BR', 'nl': 'nl', 'ja': 'ja',
  'ko': 'ko', 'zh': 'zh-CN',
}

/**
 * Extrait un titre propre depuis un nom de fichier vidéo.
 * Ex: "Rental.Family.mkv" → "Rental Family"
 */
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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filepathRaw = searchParams.get('path')
    const lang = searchParams.get('lang') || 'fr'
    const offset = parseFloat(searchParams.get('offset') || '0')
    const forced = searchParams.get('forced') === 'true'

    if (!filepathRaw) {
      return NextResponse.json({ error: 'Chemin du fichier manquant' }, { status: 400 })
    }

    const validation = validateMediaPath(filepathRaw)
    if (!validation.valid) {
      console.error('[SUBTITLES] Chemin non autorisé:', validation.error)
      return NextResponse.json({ error: 'Chemin non autorisé' }, { status: 403 })
    }

    const osLang = VALID_LANGS[lang]
    if (!osLang) {
      return NextResponse.json({ error: `Langue non supportée: ${lang}` }, { status: 400 })
    }

    const filepath = validation.normalized || filepathRaw.normalize('NFC')
    const videoDir = path.dirname(filepath)
    const videoBasename = path.basename(filepath, path.extname(filepath))

    // Vérifier si un SRT existe déjà sur le disque (cache local)
    const suffix = forced ? `.${lang}.forced.srt` : `.${lang}.srt`
    const cachedSrtPath = path.join(videoDir, `${videoBasename}${suffix}`)

    try {
      await fs.access(cachedSrtPath)
      const srtContent = await fs.readFile(cachedSrtPath, 'utf-8')
      if (srtContent.trim().length > 50) {
        console.log(`[SUBTITLES] SRT local trouvé: ${path.basename(cachedSrtPath)}`)
        return new NextResponse(convertSRTtoWebVTT(srtContent, offset), {
          headers: {
            'Content-Type': 'text/vtt; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          }
        })
      }
    } catch {
      // Pas de cache local
    }

    // Vérifier la clé API
    if (!OPENSUBTITLES_API_KEY) {
      console.error('[SUBTITLES] OPENSUBTITLES_API_KEY non configurée')
      return NextResponse.json({
        success: false,
        message: 'Clé API OpenSubtitles non configurée. Ajoutez OPENSUBTITLES_API_KEY dans votre .env (gratuit sur opensubtitles.com/consumers)',
        vtt: null
      }, { status: 500 })
    }

    const headers = {
      'Api-Key': OPENSUBTITLES_API_KEY,
      'Content-Type': 'application/json',
      'User-Agent': 'LEON v1.0',
    }

    // Recherche sur OpenSubtitles
    const title = extractTitleFromFilename(filepath)
    console.log(`[SUBTITLES] Recherche OpenSubtitles: "${title}" (${osLang}, forced=${forced})`)

    const searchUrl = new URL(`${OPENSUBTITLES_BASE}/subtitles`)
    searchUrl.searchParams.set('query', title)
    searchUrl.searchParams.set('languages', osLang)
    if (forced) {
      searchUrl.searchParams.set('foreign_parts_only', 'include')
    } else {
      searchUrl.searchParams.set('foreign_parts_only', 'exclude')
    }

    const searchResponse = await fetch(searchUrl.toString(), { headers })

    if (!searchResponse.ok) {
      const errorBody = await searchResponse.text()
      console.error(`[SUBTITLES] Erreur recherche (${searchResponse.status}):`, errorBody.slice(0, 300))

      if (searchResponse.status === 401) {
        return NextResponse.json({
          success: false,
          message: 'Clé API OpenSubtitles invalide. Vérifiez OPENSUBTITLES_API_KEY dans votre .env',
          vtt: null
        }, { status: 401 })
      }

      return NextResponse.json({
        success: false,
        message: `Erreur recherche OpenSubtitles (${searchResponse.status})`,
        vtt: null
      }, { status: 502 })
    }

    const searchData = await searchResponse.json()

    if (!searchData.data || searchData.data.length === 0) {
      console.warn(`[SUBTITLES] Aucun résultat pour "${title}" (${osLang}, forced=${forced})`)
      return NextResponse.json({
        success: false,
        message: `Aucun sous-titre ${forced ? 'forcé ' : ''}${lang.toUpperCase()} trouvé pour "${title}"`,
        vtt: null
      }, { status: 404 })
    }

    // Prendre le meilleur résultat (trié par pertinence par OpenSubtitles)
    const bestResult = searchData.data[0]
    const fileId = bestResult.attributes?.files?.[0]?.file_id

    if (!fileId) {
      return NextResponse.json({
        success: false,
        message: 'Aucun fichier de sous-titres disponible dans les résultats',
        vtt: null
      }, { status: 404 })
    }

    console.log(`[SUBTITLES] Meilleur résultat: file_id=${fileId}, release="${bestResult.attributes?.release || 'N/A'}"`)

    // Télécharger le sous-titre
    const downloadResponse = await fetch(`${OPENSUBTITLES_BASE}/download`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ file_id: fileId }),
    })

    if (!downloadResponse.ok) {
      const errorBody = await downloadResponse.text()
      console.error(`[SUBTITLES] Erreur download (${downloadResponse.status}):`, errorBody.slice(0, 300))

      if (downloadResponse.status === 406) {
        return NextResponse.json({
          success: false,
          message: 'Limite de téléchargement OpenSubtitles atteinte (20/jour gratuit). Réessayez demain ou passez VIP.',
          requiresVip: true,
          vtt: null
        }, { status: 429 })
      }

      return NextResponse.json({
        success: false,
        message: `Erreur téléchargement (${downloadResponse.status})`,
        vtt: null
      }, { status: 502 })
    }

    const downloadData = await downloadResponse.json()
    const downloadLink = downloadData.link

    if (!downloadLink) {
      return NextResponse.json({
        success: false,
        message: 'Lien de téléchargement manquant dans la réponse',
        vtt: null
      }, { status: 502 })
    }

    console.log(`[SUBTITLES] Téléchargement: remaining=${downloadData.remaining}`)

    // Récupérer le contenu SRT
    const srtResponse = await fetch(downloadLink)
    const srtContent = await srtResponse.text()

    if (srtContent.trim().length < 50) {
      return NextResponse.json({
        success: false,
        message: 'Fichier SRT vide ou trop court',
        vtt: null
      }, { status: 500 })
    }

    // Sauvegarder le SRT pour cache local
    try {
      await fs.writeFile(cachedSrtPath, srtContent, 'utf-8')
      console.log(`[SUBTITLES] SRT sauvegardé: ${path.basename(cachedSrtPath)}`)
    } catch (writeError) {
      console.warn(`[SUBTITLES] Impossible de sauvegarder le cache SRT:`, writeError)
    }

    // Convertir en WebVTT et retourner
    const vttContent = convertSRTtoWebVTT(srtContent, offset)
    console.log(`[SUBTITLES] ${forced ? 'Forced ' : ''}${lang.toUpperCase()} téléchargé (${vttContent.length} chars, remaining=${downloadData.remaining})`)

    return new NextResponse(vttContent, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      }
    })

  } catch (error) {
    console.error('❌ Erreur API sous-titres:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erreur serveur',
      vtt: null
    }, { status: 500 })
  }
}

/**
 * Convertit un fichier SRT en WebVTT avec option d'offset temporel
 */
function convertSRTtoWebVTT(srtContent: string, offsetSeconds: number = 0): string {
  let vtt = srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')

  if (offsetSeconds !== 0) {
    vtt = vtt.replace(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/g, (_match, hours, minutes, seconds, milliseconds) => {
      const totalSeconds = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000
      const newTotalSeconds = Math.max(0, totalSeconds + offsetSeconds)

      const newHours = Math.floor(newTotalSeconds / 3600)
      const newMinutes = Math.floor((newTotalSeconds % 3600) / 60)
      const newSeconds = Math.floor(newTotalSeconds % 60)
      const newMilliseconds = Math.floor((newTotalSeconds % 1) * 1000)

      return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}.${String(newMilliseconds).padStart(3, '0')}`
    })
  }

  if (!vtt.trim().startsWith('WEBVTT')) {
    vtt = 'WEBVTT\n\n' + vtt
  }

  return vtt
}
