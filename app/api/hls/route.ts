/**
 * API Route: Streaming HLS (HTTP Live Streaming)
 * GET /api/hls?path=/chemin/vers/video.mkv
 * 
 * FONCTIONNEMENT :
 * Sert exclusivement les fichiers pré-transcodés (seek instantané).
 * Les médias non transcodés ne sont pas affichés dans l'interface (filtre is_transcoded).
 */

import { NextRequest, NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { stat, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { ErrorHandler, createErrorResponse } from '@/lib/error-handler'
import { validateMediaPath } from '@/lib/path-validator'
import { getPreTranscodedDir, hasPreTranscoded, servePreTranscoded } from '@/lib/hls/pre-transcoded'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams

  // 1. Parser les paramètres de la requête
  const filepathRaw = searchParams.get('path')
  const segment = searchParams.get('segment')
  const variant = searchParams.get('variant')
  const timestamp = new Date().toISOString()

  if (!filepathRaw) {
    return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })
  }

  // 2. Validation sécurisée du chemin (protection path traversal)
  const pathValidation = validateMediaPath(filepathRaw)
  if (!pathValidation.valid || !pathValidation.normalized) {
    console.error('[HLS] Chemin invalide:', pathValidation.error)
    return NextResponse.json({ error: pathValidation.error || 'Chemin invalide' }, { status: 400 })
  }
  const filepath = pathValidation.normalized

  // 3. Vérifier la disponibilité pré-transcodée
  const usePreTranscoded = await hasPreTranscoded(filepath)
  const preTranscodedDir = getPreTranscodedDir(filepath)

  console.log(`[${timestamp}] [HLS] Requête`, {
    file: filepath.split('/').pop(),
    segment: segment || variant || 'playlist',
    preTranscoded: usePreTranscoded,
  })

  // 4. Vérifier que le fichier source existe
  try {
    const stats = await stat(filepath)
    console.log(`[${timestamp}] [HLS] ✅ Fichier trouvé: ${(stats.size / (1024*1024*1024)).toFixed(2)}GB`)
  } catch (error) {
    const errorResponse = createErrorResponse(ErrorHandler.createError('VIDEO_NOT_FOUND', { filepath }))
    ErrorHandler.log('HLS', error as Error, { filepath })
    return NextResponse.json(errorResponse.body, { status: errorResponse.status })
  }

  // 5. Servir le contenu pré-transcodé (seek instantané)
  if (usePreTranscoded) {
    const duration = Date.now() - startTime
    console.log(`[${new Date().toISOString()}] [HLS] ✅ Pré-transcodé servi (${duration}ms)`)
    return servePreTranscoded(filepath, preTranscodedDir, segment, variant, timestamp)
  }

  // 6. Pas de pré-transcodage disponible — retourner une erreur claire
  // Les médias non transcodés ne sont pas affichés dans l'interface (filtre is_transcoded)
  console.warn(`[${timestamp}] [HLS] ⚠️ Fichier non pré-transcodé: ${filepath.split('/').pop()}`)
  return NextResponse.json(
    { error: 'Ce média n\'est pas encore transcodé. Il sera disponible une fois le transcodage terminé.' },
    { status: 404 }
  )
}

// Nettoyer les anciens fichiers HLS temporaires
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepath = searchParams.get('path')

  if (!filepath) {
    return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })
  }

  // Nettoyage des fichiers temporaires (legacy, conservé pour compatibilité)
  const HLS_TEMP_DIR = '/tmp/leon-hls'
  const crypto = await import('crypto')
  const fileHash = crypto.createHash('md5').update(filepath).digest('hex')
  const sessionDir = path.join(HLS_TEMP_DIR, fileHash)

  try {
    if (existsSync(sessionDir)) {
      await rm(sessionDir, { recursive: true, force: true })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur nettoyage HLS:', error)
    return NextResponse.json({ error: 'Erreur nettoyage' }, { status: 500 })
  }
}
