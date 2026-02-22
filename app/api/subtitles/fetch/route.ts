/**
 * API: Télécharger des sous-titres depuis OpenSubtitles REST API
 * GET /api/subtitles/fetch?path=/chemin/vers/video.mp4&lang=fr&forced=false
 * Retourne les sous-titres en WebVTT pour affichage direct dans le lecteur
 * 
 * Stratégie de recherche (du plus précis au moins précis) :
 * 1. Hash du fichier (correspondance exacte, synchro garantie)
 * 2. TMDB ID depuis la base Supabase (correspondance par film)
 * 3. Titre extrait du nom de fichier (fallback)
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import path from 'path'
import { promises as fs, createReadStream } from 'fs'
import { validateMediaPath } from '@/lib/path-validator'
import { supabase } from '@/lib/supabase'

const OPENSUBTITLES_API_KEY = process.env.OPENSUBTITLES_API_KEY
const OPENSUBTITLES_BASE = 'https://api.opensubtitles.com/api/v1'

const VALID_LANGS: Record<string, string> = {
  'fr': 'fr', 'en': 'en', 'es': 'es', 'de': 'de',
  'it': 'it', 'pt': 'pt-BR', 'nl': 'nl', 'ja': 'ja',
  'ko': 'ko', 'zh': 'zh-CN',
}

/**
 * Calcule le hash OpenSubtitles d'un fichier vidéo.
 * Algorithme : taille du fichier + somme des premiers et derniers 64KB (little-endian uint64).
 */
async function computeOpenSubtitlesHash(filepath: string): Promise<{ hash: string; bytesize: number } | null> {
  try {
    const stat = await fs.stat(filepath)
    const bytesize = stat.size
    const CHUNK_SIZE = 65536 // 64KB

    if (bytesize < CHUNK_SIZE * 2) return null

    const readChunk = (start: number, size: number): Promise<Buffer> => {
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        const stream = createReadStream(filepath, { start, end: start + size - 1 })
        stream.on('data', (chunk: string | Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
        stream.on('end', () => resolve(Buffer.concat(chunks)))
        stream.on('error', reject)
      })
    }

    const head = await readChunk(0, CHUNK_SIZE)
    const tail = await readChunk(bytesize - CHUNK_SIZE, CHUNK_SIZE)

    let hash = BigInt(bytesize)
    for (let i = 0; i < CHUNK_SIZE; i += 8) {
      hash += head.readBigUInt64LE(i)
      hash += tail.readBigUInt64LE(i)
      hash = hash & BigInt('0xFFFFFFFFFFFFFFFF')
    }

    return { hash: hash.toString(16).padStart(16, '0'), bytesize }
  } catch (error) {
    console.warn('[SUBTITLES] Impossible de calculer le hash:', error)
    return null
  }
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

/**
 * Cherche le TMDB ID dans la base Supabase à partir du chemin du fichier.
 */
async function findTmdbId(filepath: string): Promise<number | null> {
  try {
    const filename = path.basename(filepath)
    const { data } = await supabase
      .from('media')
      .select('tmdb_id')
      .ilike('title', `%${extractTitleFromFilename(filepath)}%`)
      .not('tmdb_id', 'is', null)
      .limit(1)
      .maybeSingle()

    if (data?.tmdb_id) return data.tmdb_id

    // Fallback : chercher par nom de fichier dans le chemin
    const { data: byPath } = await supabase
      .from('media')
      .select('tmdb_id')
      .ilike('pcloud_link', `%${filename}%`)
      .not('tmdb_id', 'is', null)
      .limit(1)
      .maybeSingle()

    return byPath?.tmdb_id || null
  } catch {
    return null
  }
}

interface SearchResult {
  fileId: number | null
  method: string
  release: string
}

/**
 * Recherche OpenSubtitles avec fallback progressif : hash → TMDB → titre.
 */
async function searchOpenSubtitles(
  filepath: string,
  osLang: string,
  forced: boolean,
  headers: Record<string, string>
): Promise<SearchResult> {
  const foreignParts = forced ? 'include' : 'exclude'

  // 1) Recherche par hash (la plus précise)
  const hashData = await computeOpenSubtitlesHash(filepath)
  if (hashData) {
    console.log(`[SUBTITLES] Recherche par hash: ${hashData.hash} (${(hashData.bytesize / 1e9).toFixed(2)} GB)`)
    const url = new URL(`${OPENSUBTITLES_BASE}/subtitles`)
    url.searchParams.set('moviehash', hashData.hash)
    url.searchParams.set('languages', osLang)
    url.searchParams.set('foreign_parts_only', foreignParts)

    try {
      const res = await fetch(url.toString(), { headers })
      if (res.ok) {
        const data = await res.json()
        const fileId = data.data?.[0]?.attributes?.files?.[0]?.file_id
        if (fileId) {
          const release = data.data[0].attributes?.release || 'N/A'
          console.log(`[SUBTITLES] Match par hash: file_id=${fileId}, release="${release}"`)
          return { fileId, method: 'hash', release }
        }
      }
    } catch (error) {
      console.warn('[SUBTITLES] Erreur recherche par hash:', error)
    }
  }

  // 2) Recherche par TMDB ID
  const tmdbId = await findTmdbId(filepath)
  if (tmdbId) {
    console.log(`[SUBTITLES] Recherche par TMDB ID: ${tmdbId}`)
    const url = new URL(`${OPENSUBTITLES_BASE}/subtitles`)
    url.searchParams.set('tmdb_id', String(tmdbId))
    url.searchParams.set('languages', osLang)
    url.searchParams.set('foreign_parts_only', foreignParts)

    try {
      const res = await fetch(url.toString(), { headers })
      if (res.ok) {
        const data = await res.json()
        const fileId = data.data?.[0]?.attributes?.files?.[0]?.file_id
        if (fileId) {
          const release = data.data[0].attributes?.release || 'N/A'
          console.log(`[SUBTITLES] Match par TMDB: file_id=${fileId}, release="${release}"`)
          return { fileId, method: 'tmdb', release }
        }
      }
    } catch (error) {
      console.warn('[SUBTITLES] Erreur recherche par TMDB:', error)
    }
  }

  // 3) Recherche par titre (fallback)
  const title = extractTitleFromFilename(filepath)
  console.log(`[SUBTITLES] Recherche par titre: "${title}"`)
  const url = new URL(`${OPENSUBTITLES_BASE}/subtitles`)
  url.searchParams.set('query', title)
  url.searchParams.set('languages', osLang)
  url.searchParams.set('foreign_parts_only', foreignParts)

  const res = await fetch(url.toString(), { headers })
  if (res.ok) {
    const data = await res.json()
    const fileId = data.data?.[0]?.attributes?.files?.[0]?.file_id
    if (fileId) {
      const release = data.data[0].attributes?.release || 'N/A'
      console.log(`[SUBTITLES] Match par titre: file_id=${fileId}, release="${release}"`)
      return { fileId, method: 'title', release }
    }
  }

  return { fileId: null, method: 'none', release: '' }
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

    // Vérifier le cache SRT local
    const suffix = forced ? `.${lang}.forced.srt` : `.${lang}.srt`
    const cachedSrtPath = path.join(videoDir, `${videoBasename}${suffix}`)

    try {
      await fs.access(cachedSrtPath)
      const srtContent = await fs.readFile(cachedSrtPath, 'utf-8')
      if (srtContent.trim().length > 50) {
        console.log(`[SUBTITLES] Cache local: ${path.basename(cachedSrtPath)}`)
        return new NextResponse(convertSRTtoWebVTT(srtContent, offset), {
          headers: {
            'Content-Type': 'text/vtt; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          }
        })
      }
    } catch {
      // Pas de cache
    }

    if (!OPENSUBTITLES_API_KEY) {
      return NextResponse.json({
        success: false,
        message: 'Clé API OpenSubtitles non configurée. Ajoutez OPENSUBTITLES_API_KEY dans .env',
        vtt: null
      }, { status: 500 })
    }

    const headers = {
      'Api-Key': OPENSUBTITLES_API_KEY,
      'Content-Type': 'application/json',
      'User-Agent': 'LEON v1.0',
    }

    console.log(`[SUBTITLES] Recherche: ${path.basename(filepath)} (${osLang}, forced=${forced})`)

    const { fileId, method, release } = await searchOpenSubtitles(filepath, osLang, forced, headers)

    if (!fileId) {
      const title = extractTitleFromFilename(filepath)
      return NextResponse.json({
        success: false,
        message: `Aucun sous-titre ${forced ? 'forcé ' : ''}${lang.toUpperCase()} trouvé pour "${title}"`,
        vtt: null
      }, { status: 404 })
    }

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
          message: 'Limite de téléchargement OpenSubtitles atteinte (20/jour gratuit)',
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
        message: 'Lien de téléchargement manquant',
        vtt: null
      }, { status: 502 })
    }

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
      console.warn('[SUBTITLES] Impossible de sauvegarder le cache:', writeError)
    }

    const vttContent = convertSRTtoWebVTT(srtContent, offset)
    console.log(`[SUBTITLES] ${forced ? 'Forced ' : ''}${lang.toUpperCase()} OK (${method}, "${release}", ${vttContent.length} chars, remaining=${downloadData.remaining})`)

    return new NextResponse(vttContent, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      }
    })

  } catch (error) {
    console.error('[SUBTITLES] Erreur:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erreur serveur',
      vtt: null
    }, { status: 500 })
  }
}

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
