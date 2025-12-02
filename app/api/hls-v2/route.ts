/**
 * API HLS v2 - Version robuste et optimisée
 * Transcodage MKV/AVI vers HLS avec gestion propre des processus
 */

import { NextRequest, NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { spawn, ChildProcess } from 'child_process'
import { stat, mkdir, readFile, rm, writeFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'

// Configuration optimisée pour démarrage rapide
const HLS_TEMP_DIR = '/tmp/leon-hls-v2'
const MAX_WAIT_TIME = 8000 // 8 secondes max seulement
const CHECK_INTERVAL = 200 // Vérifier toutes les 200ms pour réactivité

// Map globale des processus actifs (persiste entre les requêtes)
const activeProcesses = new Map<string, {
  process: ChildProcess
  startTime: number
  filepath: string
}>()

// Nettoyer les vieux processus au démarrage
setInterval(() => {
  const now = Date.now()
  for (const [sessionId, info] of activeProcesses.entries()) {
    // Tuer les processus de plus de 30 minutes
    if (now - info.startTime > 30 * 60 * 1000) {
      console.log(`🔪 Arrêt processus ancien: ${sessionId}`)
      info.process.kill('SIGKILL')
      activeProcesses.delete(sessionId)
    }
  }
}, 60000) // Vérifier toutes les minutes

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepath = searchParams.get('path')
  const segment = searchParams.get('segment')
  const playlist = searchParams.get('playlist')
  const audioTrack = searchParams.get('audio') || '0'
  
  if (!filepath) {
    return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })
  }

  // Vérifier que le fichier existe
  try {
    const stats = await stat(filepath)
    console.log(`📁 Fichier: ${path.basename(filepath)} (${(stats.size / 1e9).toFixed(2)}GB)`)
  } catch (error) {
    console.error(`❌ Fichier non trouvé: ${filepath}`)
    return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 })
  }

  // Créer un ID unique pour cette session
  const sessionId = `${filepath}_audio${audioTrack}`
  const fileHash = crypto.createHash('md5').update(sessionId).digest('hex')
  const sessionDir = path.join(HLS_TEMP_DIR, fileHash)
  const playlistPath = path.join(sessionDir, 'playlist.m3u8')

  // Créer le répertoire si nécessaire
  if (!existsSync(sessionDir)) {
    await mkdir(sessionDir, { recursive: true })
  }

  // Si on demande un segment spécifique
  if (segment) {
    const segmentPath = path.join(sessionDir, segment)
    
    if (existsSync(segmentPath)) {
      try {
        const segmentData = await readFile(segmentPath)
        return new NextResponse(new Uint8Array(segmentData), {
          headers: {
            'Content-Type': 'video/mp2t',
            'Cache-Control': 'public, max-age=3600',
          }
        })
      } catch {
        return NextResponse.json({ error: 'Segment non trouvé' }, { status: 404 })
      }
    }
    
    // Si le segment n'existe pas encore, attendre un peu
    await new Promise(resolve => setTimeout(resolve, 1000))
    return NextResponse.json({ error: 'Segment pas encore prêt' }, { status: 503 })
  }

  // Si on demande le playlist
  if (playlist) {
    // Vérifier si un processus est déjà en cours pour cette session
    let processInfo = activeProcesses.get(sessionId)
    
    // Si pas de processus ou processus mort, en démarrer un nouveau
    if (!processInfo || processInfo.process.killed) {
      console.log(`🚀 Démarrage transcodage: ${path.basename(filepath)}`)
      
      // Commande FFmpeg ULTRA-RAPIDE pour démarrage instantané
      const ffmpegArgs = [
        '-hwaccel', 'videotoolbox',
        '-i', filepath,
        // Mapping simple
        '-map', '0:v:0',
        '-map', '0:a:0',  // Toujours première piste audio pour démarrage rapide
        // Encodage vidéo ULTRA-RAPIDE
        '-c:v', 'h264_videotoolbox',
        '-b:v', '1000k',  // Bitrate très bas pour génération instantanée
        '-pix_fmt', 'yuv420p',
        '-profile:v', 'baseline',  // Le plus simple et rapide
        '-level', '3.0',
        // GOP ultra court pour premier segment immédiat
        '-g', '24',  // 1 seconde
        '-keyint_min', '12',
        // Audio : copie directe pour vitesse max
        '-c:a', 'copy',
        // HLS avec segments très courts
        '-f', 'hls',
        '-hls_time', '2',  // Segments de 2 secondes seulement
        '-hls_list_size', '0',
        '-hls_segment_type', 'mpegts',
        '-hls_flags', 'append_list',
        '-hls_segment_filename', path.join(sessionDir, 'segment%d.ts'),
        '-start_number', '0',
        // Force le démarrage rapide
        '-segment_time_delta', '0.05',
        '-threads', '0',
        playlistPath
      ]

      // Lancer FFmpeg SANS detached pour un meilleur contrôle
      const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'ignore', 'ignore'], // Tout ignorer pour éviter les blocages
        env: { ...process.env, FFREPORT: undefined } // Désactiver les rapports FFmpeg
      })

      // Gérer la fin du processus
      ffmpeg.on('exit', (code, signal) => {
        console.log(`📍 FFmpeg terminé: code=${code}, signal=${signal}`)
        activeProcesses.delete(sessionId)
      })

      ffmpeg.on('error', (err) => {
        console.error(`❌ Erreur FFmpeg:`, err.message)
        activeProcesses.delete(sessionId)
      })

      // Enregistrer le processus
      processInfo = {
        process: ffmpeg,
        startTime: Date.now(),
        filepath
      }
      activeProcesses.set(sessionId, processInfo)
      
      console.log(`✅ FFmpeg PID: ${ffmpeg.pid}`)
    } else {
      console.log(`♻️ Processus existant pour: ${path.basename(filepath)}`)
    }

    // Attendre que le playlist soit prêt (accepter plus rapidement)
    const startWait = Date.now()
    let playlistReady = false
    
    while (Date.now() - startWait < MAX_WAIT_TIME && !playlistReady) {
      // Vérifier si le playlist existe
      if (existsSync(playlistPath)) {
        try {
          const content = await readFile(playlistPath, 'utf-8')
          // Accepter le playlist dès qu'il a le header HLS (même sans segments)
          if (content.includes('#EXTM3U')) {
            playlistReady = true
            console.log(`✅ Playlist disponible après ${((Date.now() - startWait) / 1000).toFixed(1)}s`)
            break
          }
        } catch {
          // Le fichier est en cours d'écriture
        }
      }
      
      // Ne pas créer de playlist minimal - attendre le vrai
      
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL))
    }

    if (!playlistReady) {
      // Si toujours pas prêt, retourner 503 pour que le client réessaye
      console.log(`⏳ Playlist pas encore prêt après ${MAX_WAIT_TIME / 1000}s`)
      return new NextResponse('Transcodage en cours, veuillez réessayer', { 
        status: 503,
        headers: {
          'Retry-After': '3'
        }
      })
    }

    // Lire et modifier le playlist
    try {
      let playlistContent = await readFile(playlistPath, 'utf-8')
      
      // Remplacer les chemins locaux par des URLs
      const lines = playlistContent.split('\n')
      const modifiedLines = lines.map(line => {
        if (line.endsWith('.ts')) {
          const segmentName = path.basename(line)
          return `/api/hls-v2?path=${encodeURIComponent(filepath)}&segment=${segmentName}`
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
      return NextResponse.json({ error: 'Erreur playlist' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Paramètre manquant' }, { status: 400 })
}

// Endpoint pour nettoyer
export async function DELETE() {
  console.log('🧹 Nettoyage demandé')
  
  // Tuer tous les processus actifs
  for (const [sessionId, info] of activeProcesses.entries()) {
    console.log(`🔪 Arrêt: ${sessionId}`)
    info.process.kill('SIGKILL')
  }
  activeProcesses.clear()
  
  // Nettoyer le cache
  try {
    await rm(HLS_TEMP_DIR, { recursive: true, force: true })
    console.log('✅ Cache nettoyé')
  } catch {
    // Ignorer si le dossier n'existe pas
  }
  
  return NextResponse.json({ 
    success: true, 
    message: 'Nettoyage effectué' 
  })
}
