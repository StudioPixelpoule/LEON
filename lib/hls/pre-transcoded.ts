/**
 * Gestion des fichiers HLS pré-transcodés
 * Sert les playlists master, variantes et segments depuis le dossier pré-transcodé.
 * Permet le seek instantané sans transcodage temps réel.
 */

import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { TRANSCODED_DIR } from '@/lib/transcoding-service'

/**
 * Obtenir le répertoire pré-transcodé pour un fichier.
 * Vérifie à la fois le dossier racine (films) et le sous-dossier series/ (épisodes).
 */
export function getPreTranscodedDir(filepath: string): string {
  const filename = path.basename(filepath, path.extname(filepath))
  const safeName = filename.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s\-_.()[\]]/gi, '_')
  
  // Vérifier d'abord dans le dossier racine (films)
  const mainDir = path.join(TRANSCODED_DIR, safeName)
  if (existsSync(mainDir)) {
    return mainDir
  }
  
  // Sinon vérifier dans le sous-dossier series/ (épisodes)
  const seriesDir = path.join(TRANSCODED_DIR, 'series', safeName)
  if (existsSync(seriesDir)) {
    return seriesDir
  }
  
  // Par défaut, retourner le dossier racine
  return mainDir
}

/**
 * Vérifier si un fichier pré-transcodé est disponible.
 * Crée automatiquement .done si le transcodage est complet mais le marqueur manque.
 */
export async function hasPreTranscoded(filepath: string): Promise<boolean> {
  const preTranscodedDir = getPreTranscodedDir(filepath)
  const donePath = path.join(preTranscodedDir, '.done')
  const playlistPath = path.join(preTranscodedDir, 'playlist.m3u8')
  const videoPlaylistPath = path.join(preTranscodedDir, 'video.m3u8')
  
  // Vérifier si le dossier et le master playlist existent
  if (!existsSync(playlistPath)) {
    return false
  }
  
  // Si .done existe, c'est bon
  if (existsSync(donePath)) {
    return true
  }
  
  // Sinon, vérifier si video.m3u8 contient #EXT-X-ENDLIST (transcodage terminé)
  // et créer automatiquement .done
  if (existsSync(videoPlaylistPath)) {
    try {
      const videoContent = await readFile(videoPlaylistPath, 'utf-8')
      if (videoContent.includes('#EXT-X-ENDLIST')) {
        await writeFile(donePath, new Date().toISOString())
        console.log(`[HLS] 📝 .done créé automatiquement pour: ${preTranscodedDir}`)
        return true
      }
    } catch (err) {
      console.warn(`[HLS] ⚠️ Erreur vérification video.m3u8:`, err)
    }
  }
  
  return false
}

/**
 * Servir les fichiers HLS pré-transcodés (seek instantané!).
 * Gère le master playlist, les variantes et les segments.
 */
export async function servePreTranscoded(
  originalPath: string,
  preTranscodedDir: string,
  segment: string | null,
  variant: string | null,
  timestamp: string
): Promise<NextResponse> {
  // 1. Si on demande un SEGMENT (stream_X_segmentY.ts)
  if (segment) {
    return servePreTranscodedSegment(preTranscodedDir, segment)
  }
  
  // 2. Si on demande une VARIANTE (stream_X.m3u8)
  if (variant) {
    return servePreTranscodedVariant(originalPath, preTranscodedDir, variant, timestamp)
  }

  // 3. Sinon, servir le MASTER PLAYLIST (playlist.m3u8)
  return servePreTranscodedPlaylist(originalPath, preTranscodedDir, timestamp)
}

/** Servir un segment pré-transcodé */
async function servePreTranscodedSegment(
  preTranscodedDir: string,
  segment: string
): Promise<NextResponse> {
  const segmentPath = path.join(preTranscodedDir, segment)
  
  try {
    const segmentData = await readFile(segmentPath)
    return new NextResponse(segmentData as unknown as BodyInit, {
      headers: {
        'Content-Type': 'video/mp2t',
        'Content-Length': segmentData.length.toString(),
        'Cache-Control': 'public, max-age=31536000',
        'X-Pre-Transcoded': 'true',
      }
    })
  } catch {
    return NextResponse.json({ error: 'Segment non trouvé' }, { status: 404 })
  }
}

/** Servir une playlist de variante pré-transcodée */
async function servePreTranscodedVariant(
  originalPath: string,
  preTranscodedDir: string,
  variant: string,
  timestamp: string
): Promise<NextResponse> {
  // Sécurité: vérifier que c'est bien un fichier .m3u8
  if (!variant.endsWith('.m3u8') || variant.includes('..') || variant.includes('/')) {
    return NextResponse.json({ error: 'Variante invalide' }, { status: 400 })
  }
  
  const variantPath = path.join(preTranscodedDir, variant)
  
  if (!existsSync(variantPath)) {
    return NextResponse.json({ error: `Variante ${variant} non trouvée` }, { status: 404 })
  }
  
  try {
    let variantContent = await readFile(variantPath, 'utf-8')
    
    // Réécrire les chemins des segments
    variantContent = rewriteSegmentUrls(variantContent, originalPath)
    console.log(`[${timestamp}] [HLS-PRE] ✅ Variante: ${variant}`)
    
    return new NextResponse(variantContent, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'public, max-age=3600',
        'X-Pre-Transcoded': 'true',
      }
    })
  } catch {
    return NextResponse.json({ error: 'Erreur lecture variante' }, { status: 500 })
  }
}

/** Servir le master playlist pré-transcodé */
async function servePreTranscodedPlaylist(
  originalPath: string,
  preTranscodedDir: string,
  timestamp: string
): Promise<NextResponse> {
  const playlistPath = path.join(preTranscodedDir, 'playlist.m3u8')
  
  if (!existsSync(playlistPath)) {
    return NextResponse.json({ error: 'Playlist non trouvé' }, { status: 404 })
  }
  
  // Lire les infos audio pour les logs
  const audioCount = await getAudioTrackCount(preTranscodedDir)
  
  try {
    let playlistContent = await readFile(playlistPath, 'utf-8')
    
    const isMasterPlaylist = playlistContent.includes('#EXT-X-STREAM-INF') || 
                             playlistContent.includes('#EXT-X-MEDIA')
    
    if (isMasterPlaylist) {
      playlistContent = rewriteMasterPlaylistUrls(playlistContent, originalPath)
      console.log(`[${timestamp}] [HLS-PRE] ✅ Master playlist (${audioCount} audio, multi-audio HLS)`)
    } else {
      playlistContent = rewriteSegmentUrls(playlistContent, originalPath)
      console.log(`[${timestamp}] [HLS-PRE] ✅ Playlist simple (${audioCount} audio)`)
    }

    return new NextResponse(playlistContent, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'public, max-age=3600',
        'X-Pre-Transcoded': 'true',
        'X-Seek-Mode': 'instant',
      }
    })
  } catch (error) {
    console.error(`[${timestamp}] [HLS-PRE] ❌ Erreur:`, error)
    return NextResponse.json({ error: 'Erreur playlist' }, { status: 500 })
  }
}

/** Réécrire les URLs des segments .ts vers l'API */
function rewriteSegmentUrls(content: string, originalPath: string): string {
  const lines = content.split('\n')
  const modifiedLines = lines.map(line => {
    if (line.endsWith('.ts')) {
      const segmentName = path.basename(line)
      return `/api/hls?path=${encodeURIComponent(originalPath)}&segment=${segmentName}`
    }
    return line
  })
  return modifiedLines.join('\n')
}

/** Réécrire les URLs d'un master playlist (variantes + audio alternates) */
function rewriteMasterPlaylistUrls(content: string, originalPath: string): string {
  const lines = content.split('\n')
  const modifiedLines = lines.map(line => {
    // Références aux playlists de variantes (stream_X.m3u8)
    if (line.endsWith('.m3u8') && !line.startsWith('#')) {
      const variantFile = path.basename(line)
      return `/api/hls?path=${encodeURIComponent(originalPath)}&variant=${variantFile}`
    }
    // URI dans EXT-X-MEDIA (audio alternates)
    if (line.includes('URI="') && line.includes('.m3u8')) {
      return line.replace(/URI="([^"]+\.m3u8)"/, (_, file) => {
        const variantFile = path.basename(file)
        return `URI="/api/hls?path=${encodeURIComponent(originalPath)}&variant=${variantFile}"`
      })
    }
    return line
  })
  return modifiedLines.join('\n')
}

/** Lire le nombre de pistes audio depuis audio_info.json */
async function getAudioTrackCount(preTranscodedDir: string): Promise<number> {
  const audioInfoPath = path.join(preTranscodedDir, 'audio_info.json')
  if (!existsSync(audioInfoPath)) {
    return 0
  }
  
  try {
    const audioInfo = JSON.parse(await readFile(audioInfoPath, 'utf-8'))
    return Array.isArray(audioInfo) ? audioInfo.length : 0
  } catch (error) {
    console.warn('[HLS] Erreur lecture audio_info.json:', error instanceof Error ? error.message : error)
    return 0
  }
}
