/**
 * 📊 API ROUTE: Status FFmpeg
 * GET /api/hls/status?path=/chemin/vers/video.mkv
 * 
 * Retourne l'état temps réel du transcodage HLS :
 * - Nombre de segments générés
 * - Progression estimée
 * - État de complétion
 */

import { NextRequest, NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { readdir, readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'

const HLS_TEMP_DIR = '/tmp/leon-hls'
const TRANSCODED_DIR = process.env.TRANSCODED_DIR || '/leon/transcoded'

/**
 * Obtenir le répertoire pré-transcodé pour un fichier
 * Vérifie à la fois le dossier racine et le sous-dossier series/
 */
function getPreTranscodedDir(filepath: string): { dir: string; found: boolean; location: string } {
  const filename = path.basename(filepath, path.extname(filepath))
  const safeName = filename.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s\-_.()[\]]/gi, '_')
  
  // Debug
  console.log(`[PRE-TRANSCODED] Recherche pour: ${filename}`)
  console.log(`[PRE-TRANSCODED] SafeName: ${safeName}`)
  
  // Vérifier d'abord dans le dossier racine (films)
  const mainDir = path.join(TRANSCODED_DIR, safeName)
  if (existsSync(mainDir)) {
    console.log(`[PRE-TRANSCODED] ✅ Trouvé dans racine: ${mainDir}`)
    return { dir: mainDir, found: true, location: 'root' }
  }
  
  // Sinon vérifier dans le sous-dossier series/ (épisodes)
  const seriesDir = path.join(TRANSCODED_DIR, 'series', safeName)
  if (existsSync(seriesDir)) {
    console.log(`[PRE-TRANSCODED] ✅ Trouvé dans series: ${seriesDir}`)
    return { dir: seriesDir, found: true, location: 'series' }
  }
  
  console.log(`[PRE-TRANSCODED] ❌ Non trouvé. Vérifié: ${mainDir} et ${seriesDir}`)
  
  // Par défaut, retourner le dossier racine (pour les nouveaux fichiers)
  return { dir: mainDir, found: false, location: 'none' }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepathRaw = searchParams.get('path')
  const audioTrack = searchParams.get('audio') || '0'
  
  if (!filepathRaw) {
    return NextResponse.json({ 
      error: 'Paramètre path manquant' 
    }, { status: 400 })
  }
  
  try {
    // NE PAS normaliser - utiliser le chemin tel quel
    const filepath = filepathRaw
    
    // 🆕 VÉRIFIER D'ABORD SI LE FICHIER EST PRÉ-TRANSCODÉ
    const preTranscodedResult = getPreTranscodedDir(filepath)
    const preTranscodedDir = preTranscodedResult.dir
    const preTranscodedDone = path.join(preTranscodedDir, '.done')
    const preTranscodedPlaylist = path.join(preTranscodedDir, 'playlist.m3u8')
    
    // Debug: afficher l'état des fichiers
    const doneExists = existsSync(preTranscodedDone)
    const playlistExists = existsSync(preTranscodedPlaylist)
    console.log(`[PRE-TRANSCODED] .done existe: ${doneExists}, playlist.m3u8 existe: ${playlistExists}`)
    
    // 🔧 FIX: Vérifier aussi si le playlist est complet même sans .done
    let isPreTranscodedComplete = false
    if (preTranscodedResult.found && playlistExists) {
      if (doneExists) {
        isPreTranscodedComplete = true
      } else {
        // Vérifier si le playlist contient #EXT-X-ENDLIST
        try {
          const playlistContent = await readFile(preTranscodedPlaylist, 'utf-8')
          if (playlistContent.includes('#EXT-X-ENDLIST')) {
            // Créer automatiquement le fichier .done
            const { writeFile } = await import('fs/promises')
            await writeFile(preTranscodedDone, new Date().toISOString())
            console.log(`[PRE-TRANSCODED] 📝 .done créé automatiquement pour: ${preTranscodedDir}`)
            isPreTranscodedComplete = true
          }
        } catch (err) {
          console.warn(`[PRE-TRANSCODED] ⚠️ Erreur lecture playlist:`, err)
        }
      }
    }
    
    if (isPreTranscodedComplete) {
      // Fichier pré-transcodé trouvé ! Retourner les infos
      try {
        const files = await readdir(preTranscodedDir)
        const segments = files.filter(f => f.endsWith('.ts'))
        
        return NextResponse.json({
          exists: true,
          segmentsReady: segments.length,
          totalSegments: segments.length,
          isComplete: true, // 🎯 PRÉ-TRANSCODÉ = COMPLET
          hasPlaylist: true,
          progress: 100,
          preTranscoded: true, // 🆕 Indicateur
          message: 'Fichier pré-transcodé disponible',
          timestamp: new Date().toISOString()
        }, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          }
        })
      } catch (err) {
        console.warn('⚠️ Erreur lecture dossier pré-transcodé:', err)
      }
    }
    
    // SINON : Vérifier le transcodage temps réel
    const sessionId = `${filepath}_audio${audioTrack}`
    const sessionHash = crypto
      .createHash('md5')
      .update(sessionId)
      .digest('hex')
    
    const sessionDir = path.join(HLS_TEMP_DIR, sessionHash)
    
    // 🔍 Vérifier si la session existe
    if (!existsSync(sessionDir)) {
      return NextResponse.json({
        exists: false,
        segmentsReady: 0,
        totalSegments: 0,
        isComplete: false,
        hasPlaylist: false,
        progress: 0,
        preTranscoded: false,
        message: 'Transcodage non démarré'
      })
    }
    
    // 📊 Lister les fichiers dans le répertoire de session
    const files = await readdir(sessionDir)
    
    // Compter les segments .ts
    const segments = files.filter(f => f.endsWith('.ts'))
    const hasPlaylist = files.includes('playlist.m3u8')
    const isComplete = files.includes('.done') // Marker de fin
    
    // 📈 Estimer le nombre total de segments si playlist disponible
    let totalSegments = 0
    let estimatedDuration = 0
    
    if (hasPlaylist) {
      try {
        const playlistPath = path.join(sessionDir, 'playlist.m3u8')
        const playlistContent = await readFile(playlistPath, 'utf-8')
        
        // Parser le playlist HLS
        const lines = playlistContent.split('\n')
        const segmentLines = lines.filter(line => line.endsWith('.ts'))
        totalSegments = segmentLines.length
        
        // Extraire la durée estimée (#EXTINF:)
        const durationLines = lines.filter(line => line.startsWith('#EXTINF:'))
        if (durationLines.length > 0) {
          const durations = durationLines.map(line => {
            const match = line.match(/#EXTINF:([\d.]+),/)
            return match ? parseFloat(match[1]) : 0
          })
          estimatedDuration = durations.reduce((sum, d) => sum + d, 0)
        }
      } catch (err) {
        console.warn('⚠️ Erreur lors du parsing du playlist:', err)
      }
    }
    
    // Si pas de totalSegments du playlist, utiliser le nombre actuel
    if (totalSegments === 0) {
      totalSegments = segments.length
    }
    
    // 🎯 Calculer la progression
    const progress = totalSegments > 0 
      ? Math.round((segments.length / totalSegments) * 100)
      : 0
    
    // 📊 Stats du répertoire
    let dirSize = 0
    try {
      const stats = await Promise.all(
        segments.map(s => stat(path.join(sessionDir, s)))
      )
      dirSize = stats.reduce((sum, s) => sum + s.size, 0)
    } catch (err) {
      console.warn('⚠️ Erreur calcul taille:', err)
    }
    
    // 🔍 Vérifier l'âge de la dernière modification
    let lastModified: Date | null = null
    if (segments.length > 0) {
      try {
        const lastSegment = segments[segments.length - 1]
        const segmentPath = path.join(sessionDir, lastSegment)
        const segmentStat = await stat(segmentPath)
        lastModified = segmentStat.mtime
      } catch (err) {
        console.warn('⚠️ Erreur récupération mtime:', err)
      }
    }
    
    // 🎬 Réponse détaillée
    return NextResponse.json({
      exists: true,
      segmentsReady: segments.length,
      totalSegments,
      isComplete,
      hasPlaylist,
      progress,
      estimatedDuration: Math.round(estimatedDuration),
      dirSize: Math.round(dirSize / (1024 * 1024)), // En MB
      sessionDir,
      sessionHash,
      lastModified: lastModified?.toISOString() || null,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
  } catch (error) {
    console.error('❌ Erreur status FFmpeg:', error)
    
    return NextResponse.json({ 
      error: 'Erreur lors de la vérification du status',
      exists: false,
      segmentsReady: 0,
      totalSegments: 0,
      isComplete: false,
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

// 🧹 ENDPOINT DE NETTOYAGE (optionnel)
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepathRaw = searchParams.get('path')
  const audioTrack = searchParams.get('audio') || '0' // 🔧 Récupérer la piste audio
  
  if (!filepathRaw) {
    return NextResponse.json({ error: 'path manquant' }, { status: 400 })
  }
  
  try {
    const filepath = filepathRaw.normalize('NFD')
    // 🔧 Générer le hash avec filepath + audio
    const sessionId = `${filepath}_audio${audioTrack}`
    const sessionHash = crypto
      .createHash('md5')
      .update(sessionId)
      .digest('hex')
    
    const sessionDir = path.join(HLS_TEMP_DIR, sessionHash)
    
    if (existsSync(sessionDir)) {
      // Nettoyage du répertoire de session
      const { rm } = await import('fs/promises')
      await rm(sessionDir, { recursive: true, force: true })
      
      return NextResponse.json({
        success: true,
        message: `Session ${sessionHash} nettoyée`
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Session non trouvée'
      })
    }
  } catch (error) {
    console.error('❌ Erreur nettoyage session:', error)
    
    return NextResponse.json({
      error: 'Erreur lors du nettoyage',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

