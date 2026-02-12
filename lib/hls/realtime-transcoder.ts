/**
 * Transcodeur HLS temps réel via FFmpeg
 * Gère le lancement, la configuration et le monitoring des processus FFmpeg
 * pour le transcodage à la volée des fichiers vidéo non pré-transcodés.
 */

import { spawn, type ChildProcess } from 'child_process'
import { writeFile } from 'fs/promises'
import path from 'path'
import ffmpegManager from '@/lib/ffmpeg-manager'
import { detectHardwareCapabilities, type HardwareCapabilities } from '@/lib/hardware-detection'
import { ErrorHandler } from '@/lib/error-handler'
import { getBufferInstance } from '@/lib/adaptive-buffer'

/**
 * Nettoyer les sessions fantômes (processus mort mais session enregistrée).
 * Vérifie si le PID existe encore et nettoie la session si le processus est mort.
 */
export async function cleanupGhostSession(sessionId: string): Promise<void> {
  if (!ffmpegManager.hasActiveSession(sessionId)) {
    return
  }
  
  const sessionPid = ffmpegManager.getSessionPid(sessionId)
  if (!sessionPid) {
    return
  }
  
  try {
    // Signal 0 = test d'existence sans tuer le processus
    process.kill(sessionPid, 0)
  } catch {
    // Processus n'existe pas, nettoyer la session fantôme
    console.log(`👻 Session fantôme détectée (PID ${sessionPid} inexistant), nettoyage...`)
    await ffmpegManager.killSession(sessionId)
  }
}

/**
 * Démarrer le transcodage temps réel FFmpeg.
 * Lance un processus FFmpeg non-bloquant qui génère des segments HLS.
 * 
 * @param sessionId - Identifiant unique de la session
 * @param filepath - Chemin absolu du fichier vidéo source
 * @param audioTrack - Index de la piste audio à utiliser
 * @param sessionDir - Répertoire de sortie des segments
 * @param playlistPath - Chemin du fichier playlist.m3u8
 * @param requestStartTime - Timestamp de début de la requête HTTP (pour mesure de durée)
 */
export async function startRealtimeTranscode(
  sessionId: string,
  filepath: string,
  audioTrack: string,
  sessionDir: string,
  playlistPath: string,
  requestStartTime: number
): Promise<void> {
  const ts = new Date().toISOString()
  console.log(`[${ts}] [HLS] 🎬 Démarrage transcodage`, {
    file: filepath.split('/').pop(),
    audioTrack,
    sessionId: sessionId.slice(0, 50) + '...'
  })
  
  // Enregistrer la session avant de lancer FFmpeg
  ffmpegManager.registerSession(sessionId, filepath, audioTrack)
  
  // Détection automatique du matériel disponible
  const hardware = await detectHardwareCapabilities()
  console.log(`[${new Date().toISOString()}] [HLS] 🎨 GPU détecté:`, {
    acceleration: hardware.acceleration,
    encoder: hardware.encoder,
    platform: hardware.platform
  })
  
  // Construction des arguments FFmpeg optimisés
  const ffmpegArgs = buildFfmpegArgs(filepath, audioTrack, sessionDir, playlistPath, hardware)
  
  console.log(`[${new Date().toISOString()}] [HLS] 🚀 Lancement FFmpeg`, {
    command: 'ffmpeg ' + ffmpegArgs.slice(0, 10).join(' ') + '...'
  })
  
  const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  
  // Attacher les handlers d'événements (progression, fin, erreur)
  setupFfmpegHandlers(ffmpeg, sessionId, filepath, sessionDir, requestStartTime)
  
  // Mettre à jour le PID dans le gestionnaire
  if (ffmpeg.pid) {
    console.log(`[${new Date().toISOString()}] [HLS] ✅ FFmpeg démarré (PID: ${ffmpeg.pid})`)
    ffmpegManager.updateSessionPid(sessionId, ffmpeg.pid)
  } else {
    console.error(`[${new Date().toISOString()}] [HLS] ❌ FFmpeg n'a pas démarré correctement`)
  }
}

/**
 * Construire les arguments FFmpeg pour le transcodage HLS.
 * Optimisé pour démarrage ultra-rapide (segments de 2s, keyframes alignés).
 */
function buildFfmpegArgs(
  filepath: string,
  audioTrack: string,
  sessionDir: string,
  playlistPath: string,
  hardware: HardwareCapabilities
): string[] {
  return [
    // Décodage matériel si disponible
    ...hardware.decoderArgs,
    '-i', filepath,
    // Sélectionner la piste vidéo et audio
    '-map', '0:v:0',
    ...(audioTrack && audioTrack !== '0' 
      ? ['-map', `0:${audioTrack}`]
      : ['-map', '0:a:0']),
    // Conversion HDR → SDR si nécessaire (VAAPI gère dans encoderArgs)
    ...(hardware.acceleration === 'vaapi' 
      ? []
      : ['-vf', 'format=yuv420p']),
    ...hardware.encoderArgs,
    // GOP et keyframes
    '-g', '48',
    '-keyint_min', '24',
    '-sc_threshold', '0',
    '-force_key_frames', 'expr:gte(t,n_forced*2)',
    // Audio : haute qualité
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ac', '2',
    '-ar', '48000',
    // HLS optimisé pour démarrage ultra-rapide
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
}

/**
 * Configurer les handlers d'événements FFmpeg.
 * Gère : progression (stderr), fin de processus, et erreurs.
 */
function setupFfmpegHandlers(
  ffmpeg: ChildProcess,
  sessionId: string,
  filepath: string,
  sessionDir: string,
  requestStartTime: number
): void {
  let stderrBuffer = ''
  
  // Buffering adaptatif intelligent
  const bufferManager = getBufferInstance(sessionId)
  
  ffmpeg.stderr?.on('data', (data: Buffer) => {
    const message = data.toString()
    stderrBuffer += message
    
    if (message.includes('frame=')) {
      handleFfmpegProgress(message, bufferManager)
    } else if (message.includes('error') || message.includes('Error')) {
      console.error(`[${new Date().toISOString()}] [HLS] ❌ FFmpeg erreur:`, message.slice(0, 300))
    }
  })
  
  ffmpeg.on('exit', async (code, signal) => {
    const ts = new Date().toISOString()
    const duration = Date.now() - requestStartTime
    
    if (code === 0) {
      console.log(`[${ts}] [HLS] ✅ Transcodage terminé (${(duration / 1000).toFixed(1)}s)`)
      
      // Créer marker .done pour indiquer fin du transcodage
      try {
        await writeFile(path.join(sessionDir, '.done'), '')
      } catch (err) {
        console.warn(`[${ts}] [HLS] ⚠️ Erreur création marker:`, err)
      }
    } else {
      console.error(`[${ts}] [HLS] ❌ FFmpeg exit anormal`, {
        code,
        signal,
        duration: `${(duration / 1000).toFixed(1)}s`,
        lastError: stderrBuffer.slice(-500)
      })
    }
  })
  
  ffmpeg.on('error', (err) => {
    ErrorHandler.log('HLS', err, { 
      filepath: filepath.split('/').pop(),
      sessionId: sessionId.slice(0, 50) + '...'
    })
    console.error(`[${new Date().toISOString()}] [HLS] ❌ Erreur spawn FFmpeg:`, err.message)
    ffmpegManager.killSession(sessionId)
  })
}

/**
 * Traiter la progression FFmpeg depuis stderr.
 * Extrait les métriques (frame, fps, speed) et les envoie au buffer manager.
 */
function handleFfmpegProgress(
  message: string,
  bufferManager: ReturnType<typeof getBufferInstance>
): void {
  const progressLine = message.split('\n')[0].trim()
  if (!progressLine.includes('speed=')) {
    return
  }
  
  console.log(`[${new Date().toISOString()}] [HLS] ⏱️ ${progressLine.slice(0, 100)}`)
  
  const frameMatch = progressLine.match(/frame=\s*(\d+)/)
  const fpsMatch = progressLine.match(/fps=\s*([\d.]+)/)
  const speedMatch = progressLine.match(/speed=\s*([\d.]+)x/)
  
  if (!frameMatch || !fpsMatch || !speedMatch) {
    return
  }
  
  const frame = parseInt(frameMatch[1], 10)
  const fps = parseFloat(fpsMatch[1])
  const speed = parseFloat(speedMatch[1])
  
  // Estimer le nombre de segments générés (2s par segment @ 24fps = 48 frames)
  const segmentsGenerated = Math.floor(frame / 48)
  const segmentsConsumed = 0
  
  bufferManager.recordMetrics({
    speed,
    fps,
    segmentsGenerated,
    segmentsConsumed,
    timestamp: Date.now()
  })
  
  // Afficher le statut du buffer toutes les ~10 secondes @ 24fps
  if (frame % 240 === 0) {
    const status = bufferManager.getStatusReport()
    console.log(`[${new Date().toISOString()}] [BUFFER] 📊 Statut:`, status)
  }
}
