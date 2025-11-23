/**
 * API: Scanner tous les films pour déterminer s'ils nécessitent une optimisation
 * POST /api/admin/optimize/scan
 * 
 * Analyse les codecs vidéo/audio de chaque film et détermine si un ré-encodage est nécessaire
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { exec } from 'child_process'
import { promisify } from 'util'
import { updateScanProgress } from '../scan-progress/route'

const execAsync = promisify(exec)

// Variable globale pour gérer l'arrêt du scan
let shouldStopScan = false

const TEMP_DIR = '/Users/lionelvernay/Desktop/temp'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { action } = body
    
    // Si action = 'stop', arrêter le scan
    if (action === 'stop') {
      shouldStopScan = true
      console.log('🛑 Arrêt du scan demandé')
      return NextResponse.json({ success: true, message: 'Scan arrêté' })
    }
    
    // Réinitialiser le flag
    shouldStopScan = false
    
    console.log('🔍 Démarrage du scan LOCAL...')
    console.log(`📁 Dossier source: ${TEMP_DIR}`)
    
    // 🔧 NOUVEAU: Scanner les fichiers du dossier Desktop/temp au lieu de la BDD
    const { promises: fs } = require('fs')
    const path = require('path')
    
    let files: string[]
    try {
      files = await fs.readdir(TEMP_DIR)
      // Filtrer seulement les fichiers vidéo
      files = files.filter((f: string) => 
        /\.(mkv|mp4|avi|mov)$/i.test(f) && 
        !f.startsWith('.')
      )
    } catch (err) {
      console.error('❌ Impossible de lire le dossier temp:', err)
      return NextResponse.json({ 
        error: 'Dossier temp introuvable',
        details: `Créez ${TEMP_DIR} et placez-y vos films`
      }, { status: 400 })
    }
    
    console.log(`📊 ${files.length} fichiers vidéo trouvés`)
    
    // Créer un tableau de "movies" fictifs pour réutiliser la logique existante
    const movies = files.map((filename: string) => {
      const filepath = path.join(TEMP_DIR, filename)
      const title = filename.replace(/\.[^.]+$/, '') // Nom sans extension
      
      return {
        id: null, // Pas de media_id (fichiers locaux)
        title,
        pcloud_fileid: filepath,
        file_size: 0
      }
    })

    console.log(`📊 ${movies.length} films à analyser`)

    const results = {
      analyzed: 0,
      needsOptimization: 0,
      alreadyOptimized: 0,
      errors: 0,
      total: movies.length
    }
    
    // Mettre à jour le statut de scan
    updateScanProgress({
      isScanning: true,
      currentMovie: '',
      analyzed: 0,
      total: results.total,
      needsOptimization: 0,
      alreadyOptimized: 0,
      errors: 0
    })
    
    for (let i = 0; i < movies.length; i++) {
      // Vérifier si on doit arrêter
      if (shouldStopScan) {
        console.log('🛑 Scan interrompu par l\'utilisateur')
        updateScanProgress({
          isScanning: false,
          currentMovie: '',
          analyzed: results.analyzed,
          total: results.total,
          needsOptimization: results.needsOptimization,
          alreadyOptimized: results.alreadyOptimized,
          errors: results.errors
        })
        return NextResponse.json({
          success: true,
          interrupted: true,
          ...results,
          message: `Scan interrompu après ${results.analyzed} films`
        })
      }
      
      const movie = movies[i]
      
      // Mettre à jour la progression
      updateScanProgress({
        isScanning: true,
        currentMovie: movie.title,
        analyzed: results.analyzed,
        total: results.total,
        needsOptimization: results.needsOptimization,
        alreadyOptimized: results.alreadyOptimized,
        errors: results.errors
      })
      
      try {
        // Normaliser le chemin pour macOS
        const filepath = movie.pcloud_fileid.normalize('NFD')
        
        // Analyser le fichier avec ffprobe
        const { stdout } = await execAsync(
          `ffprobe -v quiet -print_format json -show_streams -show_format "${filepath}"`
        )
        
        const probeData = JSON.parse(stdout)
        const videoStream = probeData.streams?.find((s: any) => s.codec_type === 'video')
        const audioStreams = probeData.streams?.filter((s: any) => s.codec_type === 'audio') || []
        const subtitleStreams = probeData.streams?.filter((s: any) => s.codec_type === 'subtitle') || []
        
        const videoCodec = videoStream?.codec_name || 'unknown'
        const audioCodec = audioStreams[0]?.codec_name || 'unknown'
        const bitrate = parseInt(videoStream?.bit_rate || '0')
        const width = parseInt(videoStream?.width || '0')
        const height = parseInt(videoStream?.height || '0')
        const resolution = `${width}x${height}`
        const fileSize = parseInt(probeData.format?.size || '0')
        
        // Extraire les informations des pistes audio
        const audioTracks = audioStreams.map((stream: any, index: number) => ({
          index: stream.index,
          codec: stream.codec_name,
          language: stream.tags?.language || 'und',
          title: stream.tags?.title || `Audio ${index + 1}`,
          channels: stream.channels,
          sampleRate: stream.sample_rate
        }))
        
        // Extraire les informations des pistes sous-titres
        const subtitleTracks = subtitleStreams.map((stream: any, index: number) => ({
          index: stream.index,
          codec: stream.codec_name,
          language: stream.tags?.language || 'und',
          title: stream.tags?.title || `Subtitle ${index + 1}`,
          forced: stream.disposition?.forced === 1
        }))
        
        // Déterminer si l'optimisation est nécessaire
        // Critères:
        // - Codec vidéo n'est pas H.264 (h264)
        // - Codec audio n'est pas AAC (aac)
        // - Bitrate trop élevé (> 8 Mbps)
        const needsOptimization = 
          videoCodec !== 'h264' || 
          audioCodec !== 'aac' ||
          bitrate > 8000000 // 8 Mbps
        
        // 🔧 Pour les fichiers locaux, on stocke juste dans les résultats (pas de BDD)
        // Créer le dossier optimized s'il n'existe pas
        const optimizedDir = path.join(TEMP_DIR, 'optimized')
        try {
          await fs.access(optimizedDir)
        } catch {
          await fs.mkdir(optimizedDir, { recursive: true })
          console.log(`📁 Dossier créé: ${optimizedDir}`)
        }
        
        results.analyzed++
        if (needsOptimization) {
          results.needsOptimization++
          console.log(`⚠️  ${movie.title}: ${videoCodec}/${audioCodec} (${audioTracks.length} audio, ${subtitleTracks.length} ST) → nécessite optimisation`)
        } else {
          results.alreadyOptimized++
          console.log(`✅ ${movie.title}: ${videoCodec}/${audioCodec} (${audioTracks.length} audio, ${subtitleTracks.length} ST) → déjà optimisé`)
        }
        
      } catch (err) {
        console.error(`❌ Erreur analyse ${movie.title}:`, err)
        results.errors++
      }
    }
    
    console.log(`✅ Scan terminé: ${results.analyzed} analysés, ${results.needsOptimization} à optimiser`)
    
    // Marquer le scan comme terminé
    updateScanProgress({
      isScanning: false,
      currentMovie: '',
      analyzed: results.analyzed,
      total: results.total,
      needsOptimization: results.needsOptimization,
      alreadyOptimized: results.alreadyOptimized,
      errors: results.errors
    })
    
    return NextResponse.json({
      success: true,
      ...results
    })
    
  } catch (error) {
    console.error('Erreur scan global:', error)
    return NextResponse.json({ 
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

