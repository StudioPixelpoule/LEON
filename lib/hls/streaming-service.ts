/**
 * Service de streaming HLS temps réel
 * Gère la distribution des segments TS (avec cache) et des playlists M3U8.
 * Utilisé pour le transcodage en temps réel (pas pré-transcodé).
 */

import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { detectHardwareCapabilities } from '@/lib/hardware-detection'
import { getCacheInstance } from '@/lib/segment-cache'

/**
 * Servir un segment TS depuis le cache ou le répertoire de session.
 * Vérifie d'abord le cache LRU, sinon lit le fichier depuis sessionDir
 * et le sauvegarde en cache pour les prochaines requêtes.
 */
export async function serveSegment(
  sessionDir: string,
  segment: string,
  filepath: string,
  audioTrack: string,
  timestamp: string
): Promise<NextResponse> {
  const segmentPath = path.join(sessionDir, segment)
  
  // Vérifier d'abord le cache
  const segmentMatch = segment.match(/segment(\d+)\.ts/)
  if (segmentMatch) {
    const segmentIndex = parseInt(segmentMatch[1])
    const cache = getCacheInstance()
    const hardware = await detectHardwareCapabilities()
    
    const cachedPath = await cache.get({
      filepath,
      audioTrack,
      segmentIndex,
      videoCodec: hardware.encoder,
      resolution: '1080p'
    })
    
    if (cachedPath) {
      const segmentData = await readFile(cachedPath)
      return new NextResponse(segmentData as unknown as BodyInit, {
        headers: {
          'Content-Type': 'video/mp2t',
          'Cache-Control': 'public, max-age=31536000',
          'X-Cache': 'HIT',
        }
      })
    }
  }
  
  // Segment pas en cache, lire depuis sessionDir
  try {
    const segmentData = await readFile(segmentPath)
    
    // Sauvegarder en cache pour la prochaine fois (fire-and-forget)
    if (segmentMatch) {
      const segmentIndex = parseInt(segmentMatch[1])
      const cache = getCacheInstance()
      const hardware = await detectHardwareCapabilities()
      
      cache.set({
        filepath,
        audioTrack,
        segmentIndex,
        videoCodec: hardware.encoder,
        resolution: '1080p'
      }, segmentPath).catch(err => {
        console.error(`[${timestamp}] [CACHE] ❌ Erreur sauvegarde segment${segmentIndex}:`, err.message)
      })
    }
    
    return new NextResponse(segmentData as unknown as BodyInit, {
      headers: {
        'Content-Type': 'video/mp2t',
        'Cache-Control': 'public, max-age=31536000',
        'X-Cache': 'MISS',
      }
    })
  } catch {
    return NextResponse.json({ error: 'Segment non trouvé' }, { status: 404 })
  }
}

/**
 * Attendre que le playlist M3U8 contienne des segments.
 * Polling toutes les 500ms jusqu'à maxWaitSeconds.
 * 
 * @returns true si le playlist est prêt, false si timeout
 */
export async function waitForPlaylistReady(
  playlistPath: string,
  maxWaitSeconds: number = 60
): Promise<boolean> {
  const checkIntervalMs = 500
  const maxAttempts = (maxWaitSeconds * 1000) / checkIntervalMs
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs))
    
    if (existsSync(playlistPath)) {
      try {
        const content = await readFile(playlistPath, 'utf-8')
        if (content.includes('.ts')) {
          const waitTime = ((attempt * checkIntervalMs) / 1000).toFixed(1)
          console.log(`[${new Date().toISOString()}] [HLS] ✅ Playlist prêt après ${waitTime}s`)
          return true
        }
      } catch {
        // Fichier en cours d'écriture, on réessaie
      }
    }
  }
  
  return false
}

/**
 * Servir un playlist M3U8 avec réécriture des URLs de segments.
 * Remplace les chemins locaux (segmentX.ts) par des URLs API (/api/hls?...)
 */
export async function servePlaylist(
  playlistPath: string,
  filepath: string,
  audioTrack: string
): Promise<NextResponse> {
  let playlistContent = await readFile(playlistPath, 'utf-8')
  
  // Réécrire les chemins locaux par des URLs API
  // Propager le paramètre audio aux segments pour que le player utilise la bonne piste
  const lines = playlistContent.split('\n')
  const modifiedLines = lines.map(line => {
    if (line.endsWith('.ts')) {
      const segmentName = path.basename(line)
      return `/api/hls?path=${encodeURIComponent(filepath)}&segment=${segmentName}&audio=${audioTrack}`
    }
    return line
  })
  
  playlistContent = modifiedLines.join('\n')

  return new NextResponse(playlistContent, {
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache',
    }
  })
}
