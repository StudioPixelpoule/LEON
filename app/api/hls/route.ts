/**
 * API Route: Streaming HLS (HTTP Live Streaming)
 * GET /api/hls?path=/chemin/vers/video.mkv
 * Transcoder n'importe quel format vers HLS pour lecture universelle
 */

import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { stat, mkdir, writeFile, readdir, readFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import ffmpegManager from '@/lib/ffmpeg-manager'

// Répertoire temporaire pour les segments HLS
const HLS_TEMP_DIR = '/tmp/leon-hls'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepathRaw = searchParams.get('path')
  const segment = searchParams.get('segment') // Ex: segment0.ts, segment1.ts
  const playlist = searchParams.get('playlist') // Si on demande le .m3u8
  const audioTrack = searchParams.get('audio') || '0' // Index de la piste audio
  const subtitleTrack = searchParams.get('subtitle') // Index de la piste sous-titre (optionnel)
  
  if (!filepathRaw) {
    return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })
  }
  
  // 🔧 NORMALISER le chemin pour gérer les caractères Unicode (é, à, etc.)
  // macOS utilise NFD (décomposé), mais les URLs peuvent être en NFC (composé)
  const filepath = filepathRaw.normalize('NFC')

  console.log(`📂 Vérification du fichier: ${filepath}`)
  
  try {
    const stats = await stat(filepath)
    console.log(`✅ Fichier trouvé: ${(stats.size / (1024*1024*1024)).toFixed(2)}GB`)
  } catch (error) {
    console.error(`❌ Fichier non trouvé: ${filepath}`)
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 })
  }

  // Créer un ID unique pour ce fichier ET la piste audio
  const sessionId = ffmpegManager.generateSessionId(filepath, audioTrack)
  const fileHash = crypto.createHash('md5').update(sessionId).digest('hex')
  const sessionDir = path.join(HLS_TEMP_DIR, fileHash)
  
  // Mettre à jour l'accès à la session
  ffmpegManager.touchSession(sessionId)

  // Créer le répertoire de session si nécessaire
  if (!existsSync(sessionDir)) {
    await mkdir(sessionDir, { recursive: true })
  }

  const playlistPath = path.join(sessionDir, 'playlist.m3u8')

  // Si on demande un segment spécifique
  if (segment) {
    const segmentPath = path.join(sessionDir, segment)
    
    try {
      const segmentData = await readFile(segmentPath)
      return new NextResponse(segmentData as any, {
        headers: {
          'Content-Type': 'video/mp2t',
          'Cache-Control': 'public, max-age=31536000',
        }
      })
    } catch {
      return NextResponse.json({ error: 'Segment non trouvé' }, { status: 404 })
    }
  }

  // Si on demande le playlist ou si c'est la première requête
  if (playlist || !existsSync(playlistPath)) {
    // Vérifier si le playlist existe ET contient des segments
    let playlistHasSegments = false
    if (existsSync(playlistPath)) {
      try {
        const content = await readFile(playlistPath, 'utf-8')
        playlistHasSegments = content.includes('.ts')
      } catch {}
    }
    
    // Lancer la transcodage HLS en arrière-plan si pas déjà fait
    if (!playlistHasSegments && !ffmpegManager.hasActiveSession(sessionId)) {
      console.log(`🎬 Démarrage transcodage HLS: ${filepath}`)
      
      // Enregistrer la session avant de lancer FFmpeg
      ffmpegManager.registerSession(sessionId, filepath, audioTrack)
      
      // Lancer FFmpeg en arrière-plan (non-bloquant)
      // OPTIMISATIONS MAXIMALES pour chargement rapide
      const ffmpegArgs = [
        '-hwaccel', 'auto',          // Accélération matérielle automatique
        '-i', filepath,
        // Sélectionner la piste vidéo et audio
        '-map', '0:v:0',              // Toujours prendre la première piste vidéo
        ...(audioTrack && audioTrack !== '0' 
          ? ['-map', `0:${audioTrack}`]  // Si piste audio spécifiée, utiliser l'index absolu
          : ['-map', '0:a:0']),           // Sinon prendre la première piste audio
        // ACCÉLÉRATION MATÉRIELLE VideoToolbox (GPU Mac)
        '-c:v', 'h264_videotoolbox', // Utilise le GPU Mac
        '-b:v', '1200k',            // Bitrate très bas pour génération instantanée
        '-maxrate', '1800k',        // Bitrate max très bas
        '-bufsize', '2400k',        // Buffer minimal
        '-pix_fmt', 'yuv420p',      
        '-profile:v', 'main',       
        '-level', '4.0',            
        // Optimisations pour démarrage rapide (VideoToolbox n'a pas de presets)
        // '-preset', 'ultrafast',  // Non supporté par VideoToolbox
        // '-tune', 'zerolatency',  // Non supporté par VideoToolbox
        // '-movflags', '+faststart',  // Non applicable pour HLS
        '-g', '24',                 // GOP très court (1 seconde)
        '-keyint_min', '12',        // Keyframe minimum très court
        '-sc_threshold', '0',       // Pas de détection de changement de scène
        // Audio : toujours réencoder en AAC pour compatibilité maximale
        '-c:a', 'aac',              // AAC obligatoire pour compatibilité
        '-b:a', '192k',             // Bitrate audio de qualité
        '-ac', '2',                 // Stéréo
        '-ar', '48000',             // 48kHz standard
        // HLS optimisé pour démarrage ultra-rapide
        '-f', 'hls',
        '-hls_time', '2',           // Segments très courts (2s) pour démarrage ultra-rapide
        '-hls_list_size', '0',      
        '-hls_segment_type', 'mpegts',
        '-hls_flags', 'independent_segments+append_list+program_date_time',
        '-hls_segment_filename', path.join(sessionDir, 'segment%d.ts'),
        '-hls_playlist_type', 'event', // Playlist dynamique
        '-hls_start_number_source', 'epoch',
        '-start_number', '0',
        // Multi-threading
        '-threads', '0',            // Utiliser tous les cores CPU disponibles
        playlistPath
      ]

      console.log('🚀 Lancement FFmpeg...')
      console.log('📝 Commande:', 'ffmpeg', ffmpegArgs.slice(0, 10).join(' '), '...')
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'], // Capturer stdout et stderr
      })
      
      // Logger la progression FFmpeg
      ffmpeg.stderr?.on('data', (data) => {
        const message = data.toString()
        // FFmpeg écrit la progression sur stderr
        if (message.includes('frame=')) {
          console.log('⏱️', message.split('\n')[0].trim())
        } else if (message.includes('error') || message.includes('Error')) {
          console.error('❌ FFmpeg:', message.slice(0, 200))
        }
      })
      
      ffmpeg.on('exit', (code, signal) => {
        console.log(`FFmpeg terminé (code: ${code}, signal: ${signal})`)
      })
      
      // Mettre à jour le PID dans le gestionnaire
      if (ffmpeg.pid) {
        console.log(`✅ FFmpeg démarré avec PID: ${ffmpeg.pid}`)
        ffmpegManager.updateSessionPid(sessionId, ffmpeg.pid)
      } else {
        console.error('❌ FFmpeg n\'a pas démarré correctement')
      }
    }

    // Attendre que FFmpeg génère un playlist AVEC des segments
    if (!playlistHasSegments) {
      console.log('⏳ Attente que FFmpeg génère des segments...')
      
      // Attendre jusqu'à 60 secondes que le playlist contienne des segments
      const maxWaitSeconds = 60
      const checkIntervalMs = 500
      const maxAttempts = (maxWaitSeconds * 1000) / checkIntervalMs
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, checkIntervalMs))
        
        if (existsSync(playlistPath)) {
          try {
            const content = await readFile(playlistPath, 'utf-8')
            if (content.includes('.ts')) {
              console.log(`✅ Playlist avec segments prêt après ${((attempt * checkIntervalMs) / 1000).toFixed(1)}s`)
              playlistHasSegments = true
              break
            }
          } catch {}
        }
      }
      
      // Si toujours pas de segments après 60s, retourner 503
      if (!playlistHasSegments) {
        console.log('❌ Timeout: FFmpeg n\'a pas généré de segments après 60s')
        return NextResponse.json(
          { error: 'Transcodage en cours, veuillez patienter' },
          { status: 503, headers: { 'Retry-After': '10' } }
        )
      }
    }
  }

  // Retourner le playlist .m3u8
  try {
    let playlistContent = await readFile(playlistPath, 'utf-8')
    
    // Remplacer les chemins locaux par des URLs
    const lines = playlistContent.split('\n')
    const modifiedLines = lines.map(line => {
      if (line.endsWith('.ts')) {
        const segmentName = path.basename(line)
        return `/api/hls?path=${encodeURIComponent(filepath)}&segment=${segmentName}`
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
  } catch (error) {
    console.error('Erreur lecture playlist:', error)
    return NextResponse.json({ error: 'Erreur lecture playlist' }, { status: 500 })
  }
}

// Nettoyer les anciens fichiers HLS (optionnel, à appeler périodiquement)
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

