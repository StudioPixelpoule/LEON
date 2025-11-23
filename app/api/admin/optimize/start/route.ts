/**
 * API: Lancer l'optimisation des films
 * POST /api/admin/optimize/start
 * 
 * Body optionnel: { mediaId: string } pour optimiser un seul film
 * Sans body: lance la queue complète en arrière-plan
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { spawn } from 'child_process'
import path from 'path'
import { promises as fs } from 'fs'

// Chemins des dossiers (à adapter selon votre configuration)
const ORIGINAL_PATH = process.env.PCLOUD_LOCAL_PATH || '/Users/lionelvernay/pCloud Drive/films'
const OPTIMIZED_PATH = process.env.PCLOUD_OPTIMIZED_PATH || '/Users/lionelvernay/pCloud Drive/films_optimized'

// Variable globale pour gérer l'arrêt
let shouldStop = false

export async function POST(request: Request) {
  try {
    // Créer le dossier films_optimized s'il n'existe pas
    try {
      await fs.mkdir(OPTIMIZED_PATH, { recursive: true })
      console.log(`📁 Dossier optimisé prêt: ${OPTIMIZED_PATH}`)
    } catch (err) {
      console.warn('Dossier déjà existant ou erreur création:', err)
    }
    
    const body = await request.json().catch(() => ({}))
    const { mediaId } = body
    
    if (mediaId) {
      // Optimiser un seul film (ne pas attendre la fin)
      console.log(`🎬 Optimisation individuelle demandée pour film: ${mediaId}`)
      
      // Lancer l'optimisation en arrière-plan (non bloquant)
      optimizeMovie(mediaId).catch(err => {
        console.error('Erreur optimisation film:', err)
      })
      
      return NextResponse.json({ success: true, message: 'Optimisation individuelle démarrée' })
    } else {
      // Lancer le worker en arrière-plan pour traiter toute la queue
      console.log('🚀 Lancement du worker d\'optimisation (queue complète)')
      shouldStop = false
      startOptimizationWorker()
      
      return NextResponse.json({ success: true, message: 'Worker démarré (queue complète)' })
    }
    
  } catch (error) {
    console.error('Erreur démarrage optimisation:', error)
    return NextResponse.json({ 
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

/**
 * Worker qui traite la queue d'optimisation (un film à la fois)
 * PRIORITÉ: Films en batch local d'abord, puis pCloud
 */
async function startOptimizationWorker() {
  if (shouldStop) {
    console.log('🛑 Worker arrêté')
    return
  }

  // Récupérer tous les films en attente
  const { data: allPending, error: fetchError } = await supabase
    .from('media_optimization')
    .select(`
      *,
      media!inner(
        id,
        title,
        pcloud_fileid
      )
    `)
    .eq('status', 'pending')
    .eq('needs_optimization', true)
    .order('created_at', { ascending: true })
  
  if (fetchError || !allPending || allPending.length === 0) {
    console.log('✅ Queue terminée: plus de films en attente')
    return
  }
  
  // Prioriser les films en batch local
  const BATCH_DIR = '/tmp/leon_batch'
  let next = null
  
  for (const film of allPending) {
    const filename = path.basename(film.original_filepath)
    const batchPath = path.join(`${BATCH_DIR}/sources`, filename)
    
    try {
      await fs.access(batchPath)
      // Film trouvé en local → PRIORITÉ
      next = film
      console.log(`📺 Traitement BATCH LOCAL (priorité): ${film.media.title}`)
      break
    } catch {
      // Pas en local, continuer
    }
  }
  
  // Si aucun film en local, prendre le premier pending
  if (!next) {
    next = allPending[0]
    console.log(`📺 Traitement pCloud: ${next.media.title}`)
  }
  
  await optimizeMovie(next.media_id)
  
  // Lancer le suivant après un délai (pour éviter de surcharger)
  if (!shouldStop) {
    setTimeout(() => startOptimizationWorker(), 2000)
  }
}

/**
 * Analyse les pistes audio et sous-titres d'un fichier
 */
async function analyzeMediaStreams(filepath: string) {
  const { execSync } = require('child_process')
  
  try {
    const output = execSync(
      `ffprobe -v quiet -print_format json -show_streams "${filepath}"`,
      { encoding: 'utf8' }
    )
    
    const data = JSON.parse(output)
    const audioStreams = data.streams.filter((s: any) => s.codec_type === 'audio')
    const subtitleStreams = data.streams.filter((s: any) => s.codec_type === 'subtitle')
    
    return { audioStreams, subtitleStreams }
  } catch (err) {
    console.error('Erreur analyse streams:', err)
    return { audioStreams: [], subtitleStreams: [] }
  }
}

/**
 * Optimise un film spécifique
 */
async function optimizeMovie(mediaId: string) {
  const { data: opt, error } = await supabase
    .from('media_optimization')
    .select(`
      *,
      media!inner(
        id,
        title,
        pcloud_fileid
      )
    `)
    .eq('media_id', mediaId)
    .single()
  
  if (error || !opt) {
    console.error('Film introuvable:', error)
    return
  }
  
  const originalPath = opt.original_filepath.normalize('NFD')
  const filenameWithoutExt = path.basename(originalPath, path.extname(originalPath))
  const finalOptimizedPath = path.join(OPTIMIZED_PATH, `${filenameWithoutExt}.mp4`)
  
  // Vérifier si le fichier est dans le batch local
  const BATCH_DIR = '/tmp/leon_batch'
  const filename = path.basename(originalPath)
  const batchSourcePath = path.join(`${BATCH_DIR}/sources`, filename)
  const batchOutputPath = path.join(`${BATCH_DIR}/outputs`, `${filenameWithoutExt}.mp4`)
  
  let useBatch = false
  let actualSourcePath = originalPath
  let actualOutputPath = finalOptimizedPath
  
  try {
    await fs.access(batchSourcePath)
    useBatch = true
    actualSourcePath = batchSourcePath
    actualOutputPath = batchOutputPath
    console.log(`🎬 Optimisation (BATCH LOCAL): ${opt.media.title}`)
    console.log(`   Source locale: ${batchSourcePath}`)
    console.log(`   Output local: ${batchOutputPath}`)
    console.log(`   ⚡ Vitesse max attendue: 30-40x`)
  } catch {
    console.log(`🎬 Optimisation (pCloud direct): ${opt.media.title}`)
    console.log(`   Source: ${originalPath}`)
    console.log(`   Destination: ${finalOptimizedPath}`)
    console.log(`   ⚠️  I/O sur pCloud (vitesse réduite: 8-12x)`)
  }
  
  // Analyser les pistes audio et sous-titres
  const { audioStreams, subtitleStreams } = await analyzeMediaStreams(actualSourcePath)
  console.log(`📊 Pistes détectées:`)
  console.log(`   Audio: ${audioStreams.length} pistes`)
  console.log(`   Sous-titres: ${subtitleStreams.length} pistes`)
  
  // Mettre à jour le statut à "processing"
  await supabase.from('media_optimization').update({
    status: 'processing',
    started_at: new Date().toISOString(),
    progress_percent: 0,
    optimized_filepath: finalOptimizedPath
  }).eq('media_id', mediaId)
  
  // Construire les arguments FFmpeg de manière dynamique
  const ffmpegArgs = [
    '-i', actualSourcePath,
    
    // ENCODAGE H.264 RAPIDE
    '-c:v', 'libx264',
    '-preset', 'faster',         // Rapide (2x plus rapide que medium)
    '-crf', '23',                // Qualité excellente (standard recommandé)
    '-profile:v', 'high',
    '-level', '4.1',
    '-pix_fmt', 'yuv420p',
    
    // Mapper la vidéo
    '-map', '0:v:0'
  ]
  
  // 🎵 AUDIO: Mapper toutes les pistes audio avec métadonnées
  audioStreams.forEach((stream: any, index: number) => {
    const streamIndex = stream.index
    const language = stream.tags?.language || 'und'
    const title = stream.tags?.title || `Audio ${index + 1}`
    const codec = stream.codec_name
    
    console.log(`   🎵 Audio #${index}: ${codec} (${language}) - ${title}`)
    
    ffmpegArgs.push('-map', `0:${streamIndex}`)
    
    // Encoder en AAC haute qualité
    ffmpegArgs.push(`-c:a:${index}`, 'aac')
    ffmpegArgs.push(`-b:a:${index}`, '192k')
    ffmpegArgs.push(`-ar:${index}`, '48000')
    
    // Préserver les métadonnées
    ffmpegArgs.push(`-metadata:s:a:${index}`, `language=${language}`)
    if (title) {
      ffmpegArgs.push(`-metadata:s:a:${index}`, `title=${title}`)
    }
  })
  
  // 📝 SOUS-TITRES: Traiter chaque piste
  let subtitleIndex = 0
  for (const stream of subtitleStreams) {
    const streamIndex = stream.index
    const language = stream.tags?.language || 'und'
    const title = stream.tags?.title || `Subtitle ${subtitleIndex + 1}`
    const codec = stream.codec_name
    const isForced = stream.disposition?.forced === 1
    
    console.log(`   📝 Sous-titre #${subtitleIndex}: ${codec} (${language}) - ${title}${isForced ? ' [FORCED]' : ''}`)
    
    // Vérifier si le codec est compatible avec MP4
    const compatibleCodecs = ['srt', 'ass', 'ssa', 'subrip', 'mov_text']
    const isCompatible = compatibleCodecs.includes(codec)
    
    // Codecs image-based (incompatibles, on les ignore)
    const imageBasedCodecs = ['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvdsub', 'pgssub']
    const isImageBased = imageBasedCodecs.includes(codec)
    
    if (isImageBased) {
      console.warn(`   ⚠️  Codec image-based ${codec} ignoré (nécessite OCR)`)
      // On pourrait implémenter l'OCR ici avec ccextractor ou subtitle-edit
      continue
    }
    
    // Mapper le sous-titre
    ffmpegArgs.push('-map', `0:${streamIndex}`)
    
    // Convertir en mov_text (format MP4)
    ffmpegArgs.push(`-c:s:${subtitleIndex}`, 'mov_text')
    
    // Préserver les métadonnées
    ffmpegArgs.push(`-metadata:s:s:${subtitleIndex}`, `language=${language}`)
    if (title) {
      ffmpegArgs.push(`-metadata:s:s:${subtitleIndex}`, `title=${title}`)
    }
    if (isForced) {
      ffmpegArgs.push(`-disposition:s:${subtitleIndex}`, 'forced')
    }
    
    subtitleIndex++
  }
  
  // Ajouter les options finales
  ffmpegArgs.push(
    // Optimisation streaming
    '-movflags', '+faststart',   // Index au début
    '-max_muxing_queue_size', '1024',
    
    // Performance
    '-threads', '0',             // Tous les cores
    
    // Progress (logs garantis)
    '-progress', 'pipe:2',       // Sortir les logs sur stderr
    '-stats',                    // Statistiques en temps réel
    
    // Output (local si batch, pCloud sinon)
    '-y',
    actualOutputPath
  )
  
  console.log('🚀 Démarrage FFmpeg...')
  const ffmpeg = spawn('ffmpeg', ffmpegArgs)
  
  let duration = 0
  let currentTime = 0
  let lastUpdateTime = Date.now()
  
  // Parser la progression FFmpeg
  ffmpeg.stderr.on('data', (data) => {
    const message = data.toString()
    
    // DEBUG: Afficher les premiers messages pour voir le format
    if (duration === 0 || currentTime < 10) {
      console.log('[FFmpeg]', message.substring(0, 200))
    }
    
    // Extraire durée totale
    const durationMatch = message.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
    if (durationMatch && duration === 0) {
      const [, h, m, s] = durationMatch
      duration = parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)
      console.log(`⏱️  Durée totale: ${h}:${m}:${s}`)
    }
    
    // Extraire temps actuel et vitesse
    const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
    const speedMatch = message.match(/speed=\s*([\d.]+)x/)
    
    if (timeMatch && duration > 0) {
      const [, h, m, s] = timeMatch
      currentTime = parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)
      const percent = Math.min(100, Math.round((currentTime / duration) * 100))
      const speed = speedMatch ? speedMatch[1] : '1.0'
      
      // Calculer temps restant
      const speedFactor = parseFloat(speed)
      if (speedFactor > 0) {
        const remaining = (duration - currentTime) / speedFactor
        const remainingMin = Math.round(remaining / 60)
        
        // Mettre à jour progression (max 1 fois par seconde)
        const now = Date.now()
        if (now - lastUpdateTime >= 1000) {
          lastUpdateTime = now
          
          supabase.from('media_optimization').update({
            progress_percent: percent,
            current_progress_time: `${h}:${m}:${s}`,
            speed: `${speed}x`,
            estimated_time_remaining: remainingMin > 0 ? `${remainingMin}min` : '<1min'
          }).eq('media_id', mediaId)
            .then(({ error }) => {
              if (error) console.error('Erreur MAJ progression:', error)
            })
          
          // Log toutes les 5%
          if (percent % 5 === 0 || percent === 1) {
            console.log(`📊 ${opt.media.title}: ${percent}% (${speed}x, ~${remainingMin}min restantes)`)
          }
        }
      }
    }
  })
  
  ffmpeg.on('close', async (code) => {
    if (code === 0) {
      console.log(`✅ Encodage terminé: ${opt.media.title}`)
      
      try {
        // Si batch local, copier vers pCloud
        if (useBatch) {
          console.log(`📦 Copie batch → pCloud...`)
          await fs.copyFile(actualOutputPath, finalOptimizedPath)
          console.log(`✅ Copié vers pCloud`)
          
          // Nettoyer les fichiers batch
          await fs.unlink(batchSourcePath).catch(() => {})
          await fs.unlink(batchOutputPath).catch(() => {})
          console.log(`🗑️  Fichiers batch nettoyés`)
        }
        
        // Calculer la taille du fichier optimisé
        const stats = await fs.stat(finalOptimizedPath)
        const optimizedSize = stats.size
        const originalSize = opt.original_size_bytes
        const spaceSaved = originalSize - optimizedSize
        const spaceSavedPercent = originalSize > 0 ? Math.round((spaceSaved / originalSize) * 100) : 0
        
        const originalMB = (originalSize / 1024 / 1024).toFixed(1)
        const optimizedMB = (optimizedSize / 1024 / 1024).toFixed(1)
        console.log(`💾 Taille: ${originalMB} MB → ${optimizedMB} MB (${spaceSavedPercent > 0 ? '-' : '+'}${Math.abs(spaceSavedPercent)}%)`)
        
        // Mettre à jour en base de données
        await supabase.from('media_optimization').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          progress_percent: 100,
          optimized_size_bytes: optimizedSize,
          space_saved_bytes: spaceSaved,
          space_saved_percent: spaceSavedPercent
        }).eq('media_id', mediaId)
        
        // Mettre à jour le chemin du film dans la table media
        await supabase.from('media').update({
          pcloud_fileid: finalOptimizedPath
        }).eq('id', mediaId)
        
        console.log(`🎉 ${opt.media.title} complètement optimisé !`)
        
      } catch (err) {
        console.error('Erreur post-encodage:', err)
        await supabase.from('media_optimization').update({
          status: 'failed',
          error_message: `Erreur copie: ${err instanceof Error ? err.message : 'Erreur inconnue'}`
        }).eq('media_id', mediaId)
      }
      
    } else {
      console.error(`❌ Échec optimisation: ${opt.media.title} (code: ${code})`)
      
      await supabase.from('media_optimization').update({
        status: 'failed',
        error_message: `FFmpeg exit code: ${code}`
      }).eq('media_id', mediaId)
    }
  })
  
  ffmpeg.on('error', async (err) => {
    console.error(`❌ Erreur FFmpeg:`, err)
    await supabase.from('media_optimization').update({
      status: 'failed',
      error_message: err.message
    }).eq('media_id', mediaId)
  })
  
  // Attendre la fin du processus
  return new Promise((resolve) => {
    ffmpeg.on('close', () => resolve(undefined))
    ffmpeg.on('error', () => resolve(undefined))
  })
}

/**
 * Fonction pour arrêter le worker (appelée par /stop)
 */
export function stopOptimization() {
  shouldStop = true
  console.log('🛑 Arrêt demandé')
}

