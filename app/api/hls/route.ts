/**
 * API Route: Streaming HLS (HTTP Live Streaming)
 * GET /api/hls?path=/chemin/vers/video.mkv
 * 
 * FONCTIONNEMENT :
 * 1. Vérifie si un fichier pré-transcodé existe → Seek instantané
 * 2. Sinon, transcode en temps réel avec support du seek par redémarrage FFmpeg
 * 
 * Ce fichier est un contrôleur HTTP mince : la logique métier est dans lib/hls/
 */

import { NextRequest, NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { stat, mkdir, readFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import ffmpegManager from '@/lib/ffmpeg-manager'
import { ErrorHandler, createErrorResponse } from '@/lib/error-handler'
import { validateMediaPath } from '@/lib/path-validator'
import { HLS_TEMP_DIR } from '@/lib/hls/types'
import { getPreTranscodedDir, hasPreTranscoded, servePreTranscoded } from '@/lib/hls/pre-transcoded'
import { serveSegment, waitForPlaylistReady, servePlaylist } from '@/lib/hls/streaming-service'
import { cleanupGhostSession, startRealtimeTranscode } from '@/lib/hls/realtime-transcoder'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams

  // 1. Parser les paramètres de la requête
  const filepathRaw = searchParams.get('path')
  const segment = searchParams.get('segment')
  const variant = searchParams.get('variant')
  const playlist = searchParams.get('playlist')
  const audioTrack = searchParams.get('audio') || '0'
  const seekTo = searchParams.get('seek')
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
    audioTrack,
    preTranscoded: usePreTranscoded,
    seekTo: seekTo || 'none'
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

  // 5. Si pré-transcodé : servir directement (seek instantané)
  if (usePreTranscoded) {
    return servePreTranscoded(filepath, preTranscodedDir, segment, variant, timestamp)
  }

  // 6. Sinon : transcodage temps réel
  const sessionId = ffmpegManager.generateSessionId(filepath, audioTrack)
  const fileHash = crypto.createHash('md5').update(sessionId).digest('hex')
  const sessionDir = path.join(HLS_TEMP_DIR, fileHash)

  ffmpegManager.touchSession(sessionId)

  if (!existsSync(sessionDir)) {
    await mkdir(sessionDir, { recursive: true })
  }

  const playlistPath = path.join(sessionDir, 'playlist.m3u8')

  // 6a. Si on demande un segment spécifique
  if (segment) {
    return serveSegment(sessionDir, segment, filepath, audioTrack, timestamp)
  }

  // 6b. Assurer que le transcodage est lancé et le playlist prêt
  if (playlist || !existsSync(playlistPath)) {
    let playlistHasSegments = false
    if (existsSync(playlistPath)) {
      try {
        const content = await readFile(playlistPath, 'utf-8')
        playlistHasSegments = content.includes('.ts')
      } catch (error) {
        console.warn('[HLS] Erreur lecture playlist existant:', error instanceof Error ? error.message : error)
      }
    }

    // Nettoyer les sessions fantômes
    await cleanupGhostSession(sessionId)

    // Lancer le transcodage si pas déjà en cours
    if (!playlistHasSegments && !ffmpegManager.hasActiveSession(sessionId)) {
      await startRealtimeTranscode(sessionId, filepath, audioTrack, sessionDir, playlistPath, startTime)
    }

    // Attendre que des segments soient générés
    if (!playlistHasSegments) {
      console.log(`[${new Date().toISOString()}] [HLS] ⏳ Attente génération segments...`)
      const maxWaitSeconds = 60
      playlistHasSegments = await waitForPlaylistReady(playlistPath, maxWaitSeconds)

      if (!playlistHasSegments) {
        const duration = Date.now() - startTime
        console.error(`[${new Date().toISOString()}] [HLS] ❌ Timeout après ${(duration / 1000).toFixed(1)}s`)
        const error = ErrorHandler.createError('PROCESS_TIMEOUT', {
          filepath: filepath.split('/').pop(),
          waitedSeconds: maxWaitSeconds
        })
        return NextResponse.json(
          { error: error.userMessage, code: error.code },
          { status: 503, headers: { 'Retry-After': '10' } }
        )
      }
    }
  }

  // 7. Servir le playlist M3U8
  try {
    const duration = Date.now() - startTime
    console.log(`[${new Date().toISOString()}] [HLS] ✅ Playlist servi (${duration}ms)`)
    return servePlaylist(playlistPath, filepath, audioTrack)
  } catch (error) {
    ErrorHandler.log('HLS', error as Error, { 
      action: 'read playlist',
      filepath: filepath.split('/').pop()
    })
    const errorResponse = createErrorResponse(error as Error)
    return NextResponse.json(errorResponse.body, { status: errorResponse.status })
  }
}

// Nettoyer les anciens fichiers HLS
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepath = searchParams.get('path')

  if (!filepath) {
    return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })
  }

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
