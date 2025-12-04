/**
 * API Route: Seek HLS avec redémarrage FFmpeg
 * POST /api/hls/seek
 * 
 * Permet de seeker vers n'importe quelle position dans un fichier
 * en redémarrant FFmpeg à partir de cette position.
 * 
 * UNIQUEMENT pour les fichiers non pré-transcodés.
 */

import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { mkdir, writeFile, readFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import ffmpegManager from '@/lib/ffmpeg-manager'
import { detectHardwareCapabilities } from '@/lib/hardware-detection'
import { getBufferInstance } from '@/lib/adaptive-buffer'

export const dynamic = 'force-dynamic'

const HLS_TEMP_DIR = '/tmp/leon-hls'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const timestamp = new Date().toISOString()
  
  try {
    const body = await request.json()
    const { filepath: filepathRaw, seekTime, audioTrack = '0' } = body
    
    if (!filepathRaw || seekTime === undefined) {
      return NextResponse.json(
        { error: 'filepath et seekTime requis' },
        { status: 400 }
      )
    }
    
    const filepath = filepathRaw.normalize('NFD')
    const seekSeconds = Math.max(0, parseFloat(seekTime))
    
    console.log(`[${timestamp}] [HLS-SEEK] 🎯 Seek demandé`, {
      file: filepath.split('/').pop(),
      seekTime: `${seekSeconds}s`,
      audioTrack
    })
    
    // Générer un nouvel ID de session avec la position de seek
    // Cela permet d'avoir plusieurs sessions pour le même fichier à différentes positions
    const seekSessionId = `${filepath}_audio${audioTrack}_seek${Math.floor(seekSeconds)}`
    const fileHash = crypto.createHash('md5').update(seekSessionId).digest('hex')
    const sessionDir = path.join(HLS_TEMP_DIR, fileHash)
    
    // Tuer l'ancienne session si elle existe
    const oldSessionId = ffmpegManager.generateSessionId(filepath, audioTrack)
    if (ffmpegManager.hasActiveSession(oldSessionId)) {
      console.log(`[${timestamp}] [HLS-SEEK] 🔪 Arrêt ancienne session`)
      await ffmpegManager.killSession(oldSessionId)
    }
    
    // Créer le nouveau répertoire
    if (existsSync(sessionDir)) {
      await rm(sessionDir, { recursive: true, force: true })
    }
    await mkdir(sessionDir, { recursive: true })
    
    // Enregistrer la nouvelle session
    ffmpegManager.registerSession(seekSessionId, filepath, audioTrack)
    
    // Détecter le hardware
    const hardware = await detectHardwareCapabilities()
    
    const playlistPath = path.join(sessionDir, 'playlist.m3u8')
    
    // 🎯 CLEF : Utiliser -ss AVANT -i pour un seek rapide (input seeking)
    // FFmpeg va directement à la position sans décoder tout le début
    const ffmpegArgs = [
      // 🚀 SEEK RAPIDE : -ss avant -i = input seeking (très rapide)
      '-ss', String(seekSeconds),
      // Décodage matériel si disponible
      ...hardware.decoderArgs,
      '-i', filepath,
      // Mapper les pistes
      '-map', '0:v:0',
      ...(audioTrack && audioTrack !== '0' 
        ? ['-map', `0:${audioTrack}`]
        : ['-map', '0:a:0']),
      // Encodage
      ...(hardware.acceleration === 'vaapi' 
        ? [] 
        : ['-vf', 'format=yuv420p']),
      ...hardware.encoderArgs,
      // GOP et keyframes
      '-g', '48',
      '-keyint_min', '24',
      '-sc_threshold', '0',
      '-force_key_frames', 'expr:gte(t,n_forced*2)',
      // Audio
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ac', '2',
      '-ar', '48000',
      // HLS
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '0',
      '-hls_segment_type', 'mpegts',
      '-hls_flags', 'independent_segments+temp_file',
      '-hls_segment_filename', path.join(sessionDir, 'segment%d.ts'),
      '-hls_playlist_type', 'event',
      '-start_number', '0',
      playlistPath
    ]
    
    console.log(`[${timestamp}] [HLS-SEEK] 🚀 Démarrage FFmpeg à ${seekSeconds}s`)
    
    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    
    // Mettre à jour le PID
    if (ffmpeg.pid) {
      ffmpegManager.updateSessionPid(seekSessionId, ffmpeg.pid)
    }
    
    // Gérer les événements FFmpeg
    const bufferManager = getBufferInstance(seekSessionId)
    
    ffmpeg.stderr?.on('data', (data) => {
      const message = data.toString()
      if (message.includes('frame=') && message.includes('speed=')) {
        // Progression normale
      } else if (message.includes('error') || message.includes('Error')) {
        console.error(`[${new Date().toISOString()}] [HLS-SEEK] ❌ Erreur:`, message.slice(0, 200))
      }
    })
    
    ffmpeg.on('exit', async (code) => {
      const ts = new Date().toISOString()
      if (code === 0) {
        console.log(`[${ts}] [HLS-SEEK] ✅ Transcodage terminé`)
        await writeFile(path.join(sessionDir, '.done'), '')
      } else {
        console.error(`[${ts}] [HLS-SEEK] ❌ FFmpeg exit: ${code}`)
      }
    })
    
    ffmpeg.on('error', (err) => {
      console.error(`[${new Date().toISOString()}] [HLS-SEEK] ❌ Erreur spawn:`, err.message)
      ffmpegManager.killSession(seekSessionId)
    })
    
    // Attendre que le premier segment soit prêt
    const maxWaitMs = 15000 // 15 secondes max
    const checkIntervalMs = 200
    const maxAttempts = maxWaitMs / checkIntervalMs
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs))
      
      if (existsSync(playlistPath)) {
        try {
          const content = await readFile(playlistPath, 'utf-8')
          if (content.includes('.ts')) {
            const waitTime = ((attempt * checkIntervalMs) / 1000).toFixed(1)
            console.log(`[${new Date().toISOString()}] [HLS-SEEK] ✅ Prêt après ${waitTime}s`)
            
            // Retourner la nouvelle URL du playlist
            const newPlaylistUrl = `/api/hls?path=${encodeURIComponent(filepath)}&playlist=true&audio=${audioTrack}&_seek=${seekSeconds}`
            
            return NextResponse.json({
              success: true,
              playlistUrl: newPlaylistUrl,
              seekTime: seekSeconds,
              sessionId: seekSessionId,
              waitTime: parseFloat(waitTime)
            })
          }
        } catch {}
      }
    }
    
    // Timeout
    console.error(`[${new Date().toISOString()}] [HLS-SEEK] ❌ Timeout après ${maxWaitMs/1000}s`)
    ffmpegManager.killSession(seekSessionId)
    
    return NextResponse.json(
      { error: 'Timeout: le transcodage n\'a pas démarré à temps' },
      { status: 503, headers: { 'Retry-After': '5' } }
    )
    
  } catch (error) {
    console.error(`[${timestamp}] [HLS-SEEK] ❌ Erreur:`, error)
    return NextResponse.json(
      { error: 'Erreur seek' },
      { status: 500 }
    )
  }
}






