/**
 * API Route: Streaming HLS (HTTP Live Streaming)
 * GET /api/hls?path=/chemin/vers/video.mkv
 * Transcoder n'importe quel format vers HLS pour lecture universelle
 */

import { NextRequest, NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { spawn } from 'child_process'
import { stat, mkdir, writeFile, readdir, readFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import ffmpegManager from '@/lib/ffmpeg-manager'
import { ErrorHandler, createErrorResponse } from '@/lib/error-handler'
import { detectHardwareCapabilities } from '@/lib/hardware-detection'
import { getBufferInstance, cleanupBufferInstance } from '@/lib/adaptive-buffer'
import { getCacheInstance } from '@/lib/segment-cache'

// Répertoire temporaire pour les segments HLS
const HLS_TEMP_DIR = '/tmp/leon-hls'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  const filepathRaw = searchParams.get('path')
  const segment = searchParams.get('segment') // Ex: segment0.ts, segment1.ts
  const playlist = searchParams.get('playlist') // Si on demande le .m3u8
  const audioTrack = searchParams.get('audio') || '0' // Index de la piste audio
  const subtitleTrack = searchParams.get('subtitle') // Index de la piste sous-titre (optionnel)
  
  const timestamp = new Date().toISOString()
  
  if (!filepathRaw) {
    return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })
  }
  
  // 🔧 NORMALISER le chemin pour gérer les caractères Unicode (é, à, etc.)
  // macOS utilise NFD (décomposé), donc on normalise TOUJOURS en NFD
  const filepath = filepathRaw.normalize('NFD')

  console.log(`[${timestamp}] [HLS] Requête`, {
    file: filepath.split('/').pop(),
    segment: segment || 'playlist',
    audioTrack
  })
  
  try {
    const stats = await stat(filepath)
    console.log(`[${timestamp}] [HLS] ✅ Fichier trouvé: ${(stats.size / (1024*1024*1024)).toFixed(2)}GB`)
  } catch (error) {
    const errorResponse = createErrorResponse(ErrorHandler.createError('VIDEO_NOT_FOUND', { filepath }))
    ErrorHandler.log('HLS', error as Error, { filepath })
    return NextResponse.json(errorResponse.body, { status: errorResponse.status })
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
    
    // 🔧 PHASE 4: Vérifier d'abord le cache
    const segmentMatch = segment.match(/segment(\d+)\.ts/)
    if (segmentMatch) {
      const segmentIndex = parseInt(segmentMatch[1])
      const cache = getCacheInstance()
      
      // Récupérer le hardware pour construire la clé de cache
      const hardware = await detectHardwareCapabilities()
      
      const cachedPath = await cache.get({
        filepath,
        audioTrack,
        segmentIndex,
        videoCodec: hardware.encoder,
        resolution: '1080p' // Valeur par défaut, à adapter si besoin
      })
      
      if (cachedPath) {
        // Segment trouvé en cache !
        const segmentData = await readFile(cachedPath)
        return new NextResponse(segmentData as any, {
          headers: {
            'Content-Type': 'video/mp2t',
            'Cache-Control': 'public, max-age=31536000',
            'X-Cache': 'HIT', // Header pour débug
          }
        })
      }
    }
    
    // Segment pas en cache, on lit depuis sessionDir
    try {
      const segmentData = await readFile(segmentPath)
      
      // 🔧 PHASE 4: Sauvegarder en cache pour la prochaine fois
      if (segmentMatch) {
        const segmentIndex = parseInt(segmentMatch[1])
        const cache = getCacheInstance()
        const hardware = await detectHardwareCapabilities()
        
        // Ne pas attendre la sauvegarde (asynchrone)
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
      
      return new NextResponse(segmentData as any, {
        headers: {
          'Content-Type': 'video/mp2t',
          'Cache-Control': 'public, max-age=31536000',
          'X-Cache': 'MISS', // Header pour débug
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
    
    // 🔧 CRITICAL: Nettoyer les sessions fantômes (processus mort mais session enregistrée)
    if (ffmpegManager.hasActiveSession(sessionId)) {
      const sessionPid = ffmpegManager.getSessionPid(sessionId)
      if (sessionPid) {
        try {
          // Vérifier si le processus existe (signal 0 = test sans tuer)
          process.kill(sessionPid, 0)
        } catch {
          // Processus n'existe pas, nettoyer la session fantôme
          console.log(`👻 Session fantôme détectée (PID ${sessionPid} inexistant), nettoyage...`)
          await ffmpegManager.killSession(sessionId)
        }
      }
    }
    
    // Lancer la transcodage HLS en arrière-plan si pas déjà fait
    if (!playlistHasSegments && !ffmpegManager.hasActiveSession(sessionId)) {
      const ts = new Date().toISOString()
      console.log(`[${ts}] [HLS] 🎬 Démarrage transcodage`, {
        file: filepath.split('/').pop(),
        audioTrack,
        sessionId: sessionId.slice(0, 50) + '...'
      })
      
      // Enregistrer la session avant de lancer FFmpeg
      ffmpegManager.registerSession(sessionId, filepath, audioTrack)
      
      // 🔧 PHASE 2 : Détection automatique du matériel disponible
      const hardware = await detectHardwareCapabilities()
      const ts1_5 = new Date().toISOString()
      console.log(`[${ts1_5}] [HLS] 🎨 GPU détecté:`, {
        acceleration: hardware.acceleration,
        encoder: hardware.encoder,
        platform: hardware.platform
      })
      
      // Lancer FFmpeg en arrière-plan (non-bloquant)
      // OPTIMISATIONS MAXIMALES pour chargement rapide
      const ffmpegArgs = [
        // Décodage matériel si disponible
        ...hardware.decoderArgs,
        '-i', filepath,
        // ✅ Ne pas utiliser -copyts/-start_at_zero pour éviter les décalages de timestamps
        // Sélectionner la piste vidéo et audio
        '-map', '0:v:0',              // Toujours prendre la première piste vidéo
        ...(audioTrack && audioTrack !== '0' 
          ? ['-map', `0:${audioTrack}`]  // Si piste audio spécifiée, utiliser l'index absolu
          : ['-map', '0:a:0']),           // Sinon prendre la première piste audio
        // 🎨 ENCODAGE GPU (détecté automatiquement)
        // Conversion HDR → SDR si nécessaire
        ...(hardware.acceleration === 'vaapi' 
          ? [] // VAAPI gère le format dans encoderArgs
          : ['-vf', 'format=yuv420p']),
        ...hardware.encoderArgs,
        // GOP et keyframes
        '-g', '48',                 // GOP de 2s @ 24fps
        '-keyint_min', '24',        // Keyframe minimum à 1s
        '-sc_threshold', '0',       // Pas de détection de changement de scène
        '-force_key_frames', 'expr:gte(t,n_forced*2)', // Keyframe EXACTEMENT toutes les 2s
        // Audio : haute qualité
        '-c:a', 'aac',              // AAC
        '-b:a', '192k',             // Haute qualité audio
        '-ac', '2',                 // Stéréo
        '-ar', '48000',             // 48kHz (standard)
        // HLS optimisé pour démarrage ultra-rapide
        '-f', 'hls',
        '-hls_time', '2',           // Segments très courts (2s) pour démarrage ultra-rapide
        '-hls_list_size', '0',      
        '-hls_segment_type', 'mpegts',
        '-hls_flags', 'independent_segments+temp_file', // ✅ OPTIMISATION: temp_file pour écriture atomique
        '-hls_segment_filename', path.join(sessionDir, 'segment%d.ts'),
        '-hls_playlist_type', 'event', // Playlist dynamique
        '-start_number', '0',       // 🔧 Commencer à segment0.ts
        playlistPath
      ]

      const ts2 = new Date().toISOString()
      console.log(`[${ts2}] [HLS] 🚀 Lancement FFmpeg`, {
        command: 'ffmpeg ' + ffmpegArgs.slice(0, 10).join(' ') + '...'
      })
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'], // Capturer stdout et stderr
      })
      
      let stderrBuffer = ''
      
      // Logger la progression FFmpeg
      // 📊 PHASE 3 : Buffering adaptatif intelligent
      const bufferManager = getBufferInstance(sessionId)
      
      ffmpeg.stderr?.on('data', (data) => {
        const message = data.toString()
        stderrBuffer += message
        
        // FFmpeg écrit la progression sur stderr
        if (message.includes('frame=')) {
          // Progression normale (ne pas trop logger)
          const progressLine = message.split('\n')[0].trim()
          if (progressLine.includes('speed=')) {
            console.log(`[${new Date().toISOString()}] [HLS] ⏱️ ${progressLine.slice(0, 100)}`)
            
            // Extraire les métriques pour le buffering adaptatif
            const frameMatch = progressLine.match(/frame=\s*(\d+)/)
            const fpsMatch = progressLine.match(/fps=\s*([\d.]+)/)
            const speedMatch = progressLine.match(/speed=\s*([\d.]+)x/)
            
            if (frameMatch && fpsMatch && speedMatch) {
              const frame = parseInt(frameMatch[1], 10)
              const fps = parseFloat(fpsMatch[1])
              const speed = parseFloat(speedMatch[1])
              
              // Estimer le nombre de segments générés (2s par segment @ 24fps = 48 frames)
              const segmentsGenerated = Math.floor(frame / 48)
              
              // TODO: Récupérer le nombre de segments consommés du player
              // Pour l'instant, on estime à 0 (sera implémenté côté client)
              const segmentsConsumed = 0
              
              bufferManager.recordMetrics({
                speed,
                fps,
                segmentsGenerated,
                segmentsConsumed,
                timestamp: Date.now()
              })
              
              // Afficher le statut du buffer toutes les 10 secondes
              if (frame % 240 === 0) { // Environ toutes les 10s @ 24fps
                const status = bufferManager.getStatusReport()
                console.log(`[${new Date().toISOString()}] [BUFFER] 📊 Statut:`, status)
              }
            }
          }
        } else if (message.includes('error') || message.includes('Error')) {
          console.error(`[${new Date().toISOString()}] [HLS] ❌ FFmpeg erreur:`, message.slice(0, 300))
        }
      })
      
      ffmpeg.on('exit', async (code, signal) => {
        const ts3 = new Date().toISOString()
        const duration = Date.now() - startTime
        
        if (code === 0) {
          console.log(`[${ts3}] [HLS] ✅ Transcodage terminé (${(duration / 1000).toFixed(1)}s)`)
          
          // Créer marker .done pour indiquer fin du transcodage
          try {
            await writeFile(path.join(sessionDir, '.done'), '')
          } catch (err) {
            console.warn(`[${ts3}] [HLS] ⚠️ Erreur création marker:`, err)
          }
        } else {
          console.error(`[${ts3}] [HLS] ❌ FFmpeg exit anormal`, {
            code,
            signal,
            duration: `${(duration / 1000).toFixed(1)}s`,
            lastError: stderrBuffer.slice(-500)
          })
        }
      })
      
      ffmpeg.on('error', (err) => {
        const ts3 = new Date().toISOString()
        ErrorHandler.log('HLS', err, { 
          filepath: filepath.split('/').pop(),
          sessionId: sessionId.slice(0, 50) + '...'
        })
        console.error(`[${ts3}] [HLS] ❌ Erreur spawn FFmpeg:`, err.message)
        ffmpegManager.killSession(sessionId)
      })
      
      // Mettre à jour le PID dans le gestionnaire
      if (ffmpeg.pid) {
        const ts3 = new Date().toISOString()
        console.log(`[${ts3}] [HLS] ✅ FFmpeg démarré (PID: ${ffmpeg.pid})`)
        ffmpegManager.updateSessionPid(sessionId, ffmpeg.pid)
      } else {
        const ts3 = new Date().toISOString()
        console.error(`[${ts3}] [HLS] ❌ FFmpeg n'a pas démarré correctement`)
      }
    }

    // Attendre que FFmpeg génère un playlist AVEC des segments
    if (!playlistHasSegments) {
      const ts = new Date().toISOString()
      console.log(`[${ts}] [HLS] ⏳ Attente génération segments...`)
      
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
              const waitTime = ((attempt * checkIntervalMs) / 1000).toFixed(1)
              const ts2 = new Date().toISOString()
              console.log(`[${ts2}] [HLS] ✅ Playlist prêt après ${waitTime}s`)
              playlistHasSegments = true
              break
            }
          } catch {}
        }
      }
      
      // Si toujours pas de segments après 60s, retourner 503
      if (!playlistHasSegments) {
        const ts2 = new Date().toISOString()
        const duration = Date.now() - startTime
        console.error(`[${ts2}] [HLS] ❌ Timeout après ${(duration / 1000).toFixed(1)}s`)
        
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

  // Retourner le playlist .m3u8
  try {
    let playlistContent = await readFile(playlistPath, 'utf-8')
    
    // Remplacer les chemins locaux par des URLs
    // 🔧 IMPORTANT : Propager le paramètre audio aux segments pour que le player utilise la bonne piste
    const lines = playlistContent.split('\n')
    const modifiedLines = lines.map(line => {
      if (line.endsWith('.ts')) {
        const segmentName = path.basename(line)
        return `/api/hls?path=${encodeURIComponent(filepath)}&segment=${segmentName}&audio=${audioTrack}`
      }
      return line
    })
    
    playlistContent = modifiedLines.join('\n')

    const duration = Date.now() - startTime
    console.log(`[${new Date().toISOString()}] [HLS] ✅ Playlist servi (${duration}ms)`)

    return new NextResponse(playlistContent, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache',
      }
    })
  } catch (error) {
    ErrorHandler.log('HLS', error as Error, { 
      action: 'read playlist',
      filepath: filepath.split('/').pop()
    })
    
    const errorResponse = createErrorResponse(error as Error)
    return NextResponse.json(errorResponse.body, { status: errorResponse.status })
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

