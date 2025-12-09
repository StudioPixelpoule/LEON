/**
 * API Route: Sous-titres VTT pré-transcodés
 * GET /api/hls/subtitles?path=/chemin/vers/video.mkv&file=sub_fre_0.vtt
 */

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const TRANSCODED_DIR = process.env.TRANSCODED_DIR || '/leon/transcoded'

/**
 * Trouver le dossier pré-transcodé pour un fichier
 */
function getPreTranscodedDir(filepath: string): { dir: string; found: boolean } {
  const filename = path.basename(filepath, path.extname(filepath))
  const safeName = filename.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s\-_.()[\]]/gi, '_')
  
  // Vérifier dans le dossier racine (films)
  const mainDir = path.join(TRANSCODED_DIR, safeName)
  if (existsSync(mainDir) && existsSync(path.join(mainDir, '.done'))) {
    return { dir: mainDir, found: true }
  }
  
  // Vérifier dans le sous-dossier series/ (épisodes)
  const seriesDir = path.join(TRANSCODED_DIR, 'series', safeName)
  if (existsSync(seriesDir) && existsSync(path.join(seriesDir, '.done'))) {
    return { dir: seriesDir, found: true }
  }
  
  return { dir: mainDir, found: false }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepath = searchParams.get('path')
  const vttFile = searchParams.get('file') // ex: sub_fre_0.vtt
  
  if (!filepath) {
    return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })
  }
  
  if (!vttFile) {
    return NextResponse.json({ error: 'Fichier VTT manquant' }, { status: 400 })
  }
  
  const preTranscoded = getPreTranscodedDir(filepath)
  
  if (!preTranscoded.found) {
    return NextResponse.json({ error: 'Fichier non pré-transcodé' }, { status: 404 })
  }
  
  // Sécurité : s'assurer que le fichier est bien un .vtt et pas un chemin malicieux
  if (!vttFile.endsWith('.vtt') || vttFile.includes('..') || vttFile.includes('/')) {
    return NextResponse.json({ error: 'Fichier invalide' }, { status: 400 })
  }
  
  const vttPath = path.join(preTranscoded.dir, vttFile)
  
  if (!existsSync(vttPath)) {
    console.log(`[SUBTITLES] ❌ Fichier VTT non trouvé: ${vttPath}`)
    return NextResponse.json({ error: 'Sous-titre non trouvé' }, { status: 404 })
  }
  
  try {
    const vttContent = await readFile(vttPath, 'utf-8')
    console.log(`[SUBTITLES] ✅ VTT servi: ${vttFile}`)
    
    return new NextResponse(vttContent, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000', // Cache long car fichier statique
        'X-Pre-Transcoded': 'true',
      }
    })
  } catch (error) {
    console.error('[SUBTITLES] ❌ Erreur lecture VTT:', error)
    return NextResponse.json({ error: 'Erreur lecture sous-titre' }, { status: 500 })
  }
}


