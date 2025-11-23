/**
 * API unique pour l'optimisation locale
 * GET: Liste les fichiers du dossier temp
 * POST: Lance l'optimisation d'un fichier
 */

import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const TEMP_DIR = '/Users/lionelvernay/Desktop/temp'
const OUTPUT_DIR = '/Users/lionelvernay/Desktop/temp/optimized'
const STATE_FILE = '/tmp/leon-encoding-state.json'

// État global simple
interface EncodingState {
  filename: string
  percent: number
  speed: number
  fps: number
  currentTime: string
  duration: string
  isRunning: boolean
}

// Charger l'état depuis le fichier
function loadState(): EncodingState {
  try {
    const data = require('fs').readFileSync(STATE_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {
      filename: '',
      percent: 0,
      speed: 0,
      fps: 0,
      currentTime: '00:00:00',
      duration: '00:00:00',
      isRunning: false
    }
  }
}

// Sauvegarder l'état dans le fichier
function saveState(state: EncodingState) {
  try {
    require('fs').writeFileSync(STATE_FILE, JSON.stringify(state), 'utf-8')
  } catch (err) {
    console.error('Erreur sauvegarde état:', err)
  }
}

let currentEncoding: EncodingState = loadState()
let currentProcess: any = null

export async function GET() {
  try {
    // ⚠️ CRITIQUE: Recharger l'état depuis le fichier à chaque GET
    // pour avoir les données les plus récentes
    currentEncoding = loadState()
    
    // Lire les fichiers du dossier temp
    let files: string[] = []
    try {
      files = await fs.readdir(TEMP_DIR)
      files = files.filter(f => /\.(mkv|mp4|avi|mov)$/i.test(f) && !f.startsWith('.'))
    } catch {
      // Dossier n'existe pas
      return NextResponse.json({
        files: [],
        currentEncoding,
        message: 'Dossier temp introuvable'
      })
    }

    // Analyser chaque fichier
    const analyzed = []
    for (const filename of files) {
      const filepath = path.join(TEMP_DIR, filename)
      const outputPath = path.join(OUTPUT_DIR, filename.replace(/\.[^.]+$/, '.mp4'))
      
      // Vérifier si déjà optimisé
      let isOptimized = false
      try {
        await fs.access(outputPath)
        isOptimized = true
      } catch {}
      
      try {
        const { stdout } = await execAsync(`ffprobe -v quiet -print_format json -show_streams -show_format "${filepath}"`)
        const data = JSON.parse(stdout)
        
        const videoStream = data.streams?.find((s: any) => s.codec_type === 'video')
        const audioStreams = data.streams?.filter((s: any) => s.codec_type === 'audio') || []
        const subtitleStreams = data.streams?.filter((s: any) => s.codec_type === 'subtitle') || []
        
        const codec = videoStream?.codec_name || 'unknown'
        const audioCodec = audioStreams[0]?.codec_name || 'unknown'
        const width = videoStream?.width || 0
        const height = videoStream?.height || 0
        const fileSize = parseInt(data.format?.size || '0')
        
        const needsOptimization = codec !== 'h264' || audioCodec !== 'aac'
        
        analyzed.push({
          filename,
          codec,
          audioCodec,
          resolution: `${width}x${height}`,
          audioCount: audioStreams.length,
          subtitleCount: subtitleStreams.length,
          size: Math.round(fileSize / 1024 / 1024),
          needsOptimization,
          isOptimized
        })
      } catch (err) {
        console.error(`Erreur analyse ${filename}:`, err)
      }
    }
    
    // Si encodage en cours, vérifier aussi la taille du fichier de sortie comme fallback
    if (currentEncoding.isRunning && currentEncoding.filename) {
      try {
        const outputPath = path.join(OUTPUT_DIR, currentEncoding.filename.replace(/\.[^.]+$/, '.mp4'))
        const sourcePath = path.join(TEMP_DIR, currentEncoding.filename)
        
        // Vérifier si le fichier de sortie existe et a une taille
        try {
          const outputStats = await fs.stat(outputPath)
          const sourceStats = await fs.stat(sourcePath)
          
          // Si le fichier de sortie existe et grandit, mais le pourcentage stagne
          // Utiliser la taille comme estimation de secours
          if (outputStats.size > 0 && currentEncoding.percent < 95) {
            // Estimation basée sur la taille (approximatif mais mieux que rien)
            // On suppose que la taille finale sera ~70% de la source (compression)
            const estimatedFinalSize = sourceStats.size * 0.7
            const sizeBasedPercent = Math.min(95, (outputStats.size / estimatedFinalSize) * 100)
            
            // Si la taille indique plus de progression que le time=, utiliser la taille
            if (sizeBasedPercent > currentEncoding.percent + 2) {
              console.log(`   📏 Estimation taille: ${sizeBasedPercent.toFixed(1)}% (vs ${currentEncoding.percent.toFixed(1)}% time=)`)
              currentEncoding.percent = Math.min(95, sizeBasedPercent)
              saveState(currentEncoding)
            }
          }
        } catch {
          // Fichier de sortie n'existe pas encore ou erreur, ignorer
        }
      } catch {
        // Erreur, ignorer
      }
      
      // Logger seulement tous les 5% pour éviter spam
      const lastLoggedPercent = (global as any).lastLoggedPercent || 0
      if (currentEncoding.percent - lastLoggedPercent >= 5) {
        console.log(`📊 GET - Encodage: ${currentEncoding.filename} - ${currentEncoding.percent.toFixed(1)}% - ${currentEncoding.speed.toFixed(1)}x - ${currentEncoding.fps} fps`)
        ;(global as any).lastLoggedPercent = currentEncoding.percent
      }
    } else {
      ;(global as any).lastLoggedPercent = 0
    }
    
    return NextResponse.json({
      files: analyzed,
      currentEncoding
    })
  } catch (error) {
    console.error('Erreur GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { filename, action } = await request.json()
    
    // Action stop
    if (action === 'stop') {
      console.log('🛑 Arrêt demandé - Nettoyage complet...')
      
      // Tuer le processus Node.js actuel
      if (currentProcess) {
        try {
          currentProcess.kill('SIGKILL')
          console.log('   ✅ Processus Node.js tué')
        } catch (err) {
          console.error('   ⚠️  Erreur kill processus:', err)
        }
        currentProcess = null
      }
      
      // Tuer TOUS les processus FFmpeg (au cas où)
      try {
        const { execSync } = require('child_process')
        execSync('pkill -9 ffmpeg 2>/dev/null || true', { encoding: 'utf-8' })
        console.log('   ✅ Tous les processus FFmpeg tués')
      } catch (err) {
        // Ignorer si aucun processus
      }
      
      // Attendre un peu pour que les processus meurent
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Réinitialiser l'état
      currentEncoding = {
        filename: '',
        percent: 0,
        speed: 0,
        fps: 0,
        currentTime: '00:00:00',
        duration: '00:00:00',
        isRunning: false
      }
      saveState(currentEncoding)
      
      console.log('   ✅ État réinitialisé')
      return NextResponse.json({ success: true, message: 'Arrêté avec succès' })
    }
    
    // Vérifier qu'un encodage n'est pas déjà en cours
    // Vérifier aussi s'il y a un processus FFmpeg qui tourne vraiment
    const { execSync } = require('child_process')
    try {
      execSync('pgrep -x ffmpeg > /dev/null 2>&1', { encoding: 'utf-8' })
      // Un processus FFmpeg tourne encore
      console.log('⚠️  Processus FFmpeg détecté, nettoyage...')
      execSync('pkill -9 ffmpeg 2>/dev/null || true', { encoding: 'utf-8' })
      await new Promise(resolve => setTimeout(resolve, 500))
      // Réinitialiser l'état
      currentEncoding.isRunning = false
      saveState(currentEncoding)
    } catch {
      // Aucun processus FFmpeg, c'est bon
    }
    
    if (currentEncoding.isRunning) {
      return NextResponse.json({
        error: 'Un encodage est déjà en cours'
      }, { status: 409 })
    }
    
    // Créer le dossier output
    await fs.mkdir(OUTPUT_DIR, { recursive: true })
    
    const sourcePath = path.join(TEMP_DIR, filename)
    const outputPath = path.join(OUTPUT_DIR, filename.replace(/\.[^.]+$/, '.mp4'))
    
    // Analyser le fichier
    const { stdout } = await execAsync(`ffprobe -v quiet -print_format json -show_streams -show_format "${sourcePath}"`)
    const probeData = JSON.parse(stdout)
    
    const audioStreams = probeData.streams?.filter((s: any) => s.codec_type === 'audio') || []
    const subtitleStreams = probeData.streams?.filter((s: any) => s.codec_type === 'subtitle') || []
    
    // Chercher des fichiers SRT externes dans le dossier temp AVANT de construire la commande FFmpeg
    // Format attendu: "nom-du-film.fr.srt" ou "nom-du-film.en.srt"
    const srtInputs: Array<{ path: string, lang: string }> = []
    try {
      const tempFiles = await fs.readdir(TEMP_DIR)
      const videoBasename = filename.replace(/\.[^.]+$/, '').toLowerCase()
      const srtFiles = tempFiles.filter(f => {
        const fLower = f.toLowerCase()
        return fLower.endsWith('.srt') && 
               (fLower.includes(videoBasename) || videoBasename.includes(fLower.replace(/\.(fr|en|fra|eng)\.srt$/, '')))
      })
      
      for (const srtFile of srtFiles) {
        const srtPath = path.join(TEMP_DIR, srtFile)
        try {
          await fs.access(srtPath)
          // Extraire la langue du nom de fichier (ex: .fr.srt, .fra.srt, .en.srt, .eng.srt)
          const langMatch = srtFile.match(/\.(fr|fra|en|eng|fre|english)\.srt$/i)
          const lang = langMatch ? (langMatch[1].toLowerCase().startsWith('fr') ? 'fr' : 'en') : 'und'
          srtInputs.push({ path: srtPath, lang })
          console.log(`   📝 SRT externe détecté: ${srtFile} (langue: ${lang})`)
        } catch {
          // Fichier n'existe pas, ignorer
        }
      }
    } catch (err) {
      // Dossier n'existe pas ou erreur, ignorer
    }
    
    const durationSec = parseFloat(probeData.format?.duration || '0')
    const hours = Math.floor(durationSec / 3600)
    const minutes = Math.floor((durationSec % 3600) / 60)
    const seconds = Math.floor(durationSec % 60)
    const duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    
    // Réinitialiser l'état
    currentEncoding = {
      filename,
      percent: 0,
      speed: 0,
      fps: 0,
      currentTime: '00:00:00',
      duration,
      isRunning: true
    }
    saveState(currentEncoding)
    
    console.log(`🎬 POST - Démarrage encodage: ${filename} - isRunning: ${currentEncoding.isRunning}`)
    
    // Construire les arguments FFmpeg avec GPU (VideoToolbox)
    // ⚠️ IMPORTANT: L'ordre des arguments est critique pour FFmpeg
    // 1. Tous les inputs (-i) d'abord
    // 2. Ensuite les options d'encodage et les maps
    const ffmpegArgs = [
      '-i', sourcePath,  // Input vidéo (index 0)
    ]
    
    // Ajouter les inputs SRT maintenant (avant les options d'encodage)
    // Ils seront à l'index 1, 2, etc.
    for (const srtInput of srtInputs) {
      ffmpegArgs.push('-i', srtInput.path)
    }
    
    // Maintenant ajouter les options d'encodage
    ffmpegArgs.push(
      // 🚀 ENCODAGE GPU (Apple Silicon VideoToolbox)
      '-c:v', 'h264_videotoolbox',
      '-b:v', '3M',                    // Bitrate 3 Mbps
      '-allow_sw', '1',                // Fallback CPU si GPU saturé
      
      '-map', '0:v:0'  // Mapper la vidéo de l'input 0
    )
    
    // 🎵 Audio (downmix en stéréo pour compatibilité maximale)
    // ⚠️ IMPORTANT: QuickTime et la plupart des lecteurs web ont des problèmes avec AAC 5.1
    // On encode donc toujours en stéréo (2 canaux) pour garantir la compatibilité
    audioStreams.forEach((stream: any, index: number) => {
      const language = stream.tags?.language || 'und'
      const title = stream.tags?.title || `Audio ${index + 1}`
      const sourceChannels = stream.channels || 2
      const isDefault = stream.disposition?.default === 1 || index === 0
      
      console.log(`   🎵 Audio ${index}: ${language} - "${title}" (source: ${sourceChannels} canaux → stéréo)${isDefault ? ' [DEFAULT]' : ''}`)
      
      // Mapper la piste audio
      ffmpegArgs.push('-map', `0:${stream.index}`)
      
      // ⚠️ CRITIQUE: Downmix en stéréo (2 canaux) APRÈS le map
      // FFmpeg applique -ac au dernier stream mappé
      ffmpegArgs.push('-ac', '2')
      
      // Appliquer le codec audio avec index pour cibler chaque piste spécifiquement
      ffmpegArgs.push(`-c:a:${index}`, 'aac')
      
      // Bitrate optimal pour stéréo (bonne qualité, petite taille)
      ffmpegArgs.push(`-b:a:${index}`, '192k')
      
      // ⚠️ Ne PAS spécifier -ar : AAC préserve automatiquement le sample rate source
      
      // ⚠️ CRITIQUE: Métadonnées pour MP4
      ffmpegArgs.push(`-metadata:s:a:${index}`, `language=${language}`)
      ffmpegArgs.push(`-metadata:s:a:${index}`, `title=${title}`)
      
      // ⚠️ CRITIQUE: Marquer la première piste comme default (sans forced pour audio)
      // Le flag "forced" est réservé aux sous-titres, pas aux pistes audio
      if (isDefault) {
        ffmpegArgs.push(`-disposition:a:${index}`, 'default')
      } else {
        ffmpegArgs.push(`-disposition:a:${index}`, '0')
      }
    })
    
    // 📝 Sous-titres (préserver TOUTES les pistes avec métadonnées)
    // ⚠️ IMPORTANT: Trouver la piste la plus complète (pas forced) pour la marquer comme default
    const subtitleStreamsWithInfo = subtitleStreams.map((stream: any) => ({
      ...stream,
      isForced: stream.disposition?.forced === 1,
      language: stream.tags?.language || 'und',
      title: stream.tags?.title || ''
    }))
    
    // Trouver la piste non-forced la plus complète (ou la première si toutes sont forced)
    const defaultSubIndex = subtitleStreamsWithInfo.findIndex((s: any) => !s.isForced) >= 0
      ? subtitleStreamsWithInfo.findIndex((s: any) => !s.isForced)
      : 0
    
    let subIndex = 0
    for (const stream of subtitleStreams) {
      const codec = stream.codec_name
      // ⚠️ CRITIQUE: Si pas de langue dans les tags, utiliser des valeurs par défaut
      // (généralement, la première piste est FR, la deuxième peut être EN ou autre)
      const language = stream.tags?.language || (subIndex === 0 ? 'fr' : subIndex === 1 ? 'en' : 'und')
      const title = stream.tags?.title || (subIndex === 0 ? 'Français' : subIndex === 1 ? 'English' : `Subtitle ${subIndex + 1}`)
      const isForced = stream.disposition?.forced === 1
      
      // Ignorer les sous-titres image (incompatibles MP4)
      const imageBasedCodecs = ['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvdsub', 'pgssub', 'dvb_subtitle']
      if (imageBasedCodecs.includes(codec)) {
        console.log(`   ⚠️  ST ${subIndex} ignoré: ${codec} (image-based)`)
        continue
      }
      
      console.log(`   📝 ST ${subIndex}: ${language} - "${title}"${isForced ? ' [FORCED]' : ''} (index source: ${stream.index})`)
      
      // Mapper la piste sous-titre avec l'index ABSOLU du fichier source
      ffmpegArgs.push('-map', `0:${stream.index}`)
      
      // Convertir en mov_text (compatible MP4)
      ffmpegArgs.push(`-c:s:${subIndex}`, 'mov_text')
      
      // Métadonnées pour MP4
      ffmpegArgs.push(`-metadata:s:s:${subIndex}`, `language=${language}`)
      ffmpegArgs.push(`-metadata:s:s:${subIndex}`, `title=${title}`)
      
      // ⚠️ CRITIQUE: Marquer la piste la plus complète (non-forced) comme default
      // Les pistes forced doivent rester forced mais pas default
      if (subIndex === defaultSubIndex) {
        // Piste complète : default (sans forced)
        console.log(`   ✅ Marquée comme DEFAULT (piste complète)`)
        ffmpegArgs.push(`-disposition:s:${subIndex}`, 'default')
      } else if (isForced) {
        // Piste forced : forced seulement (pas default)
        console.log(`   ✅ Marquée comme FORCED uniquement`)
        ffmpegArgs.push(`-disposition:s:${subIndex}`, 'forced')
      } else {
        // Autres pistes : aucune disposition spéciale
        ffmpegArgs.push(`-disposition:s:${subIndex}`, '0')
      }
      
      subIndex++
    }
    
    console.log(`   ✅ Total: ${audioStreams.length} audio, ${subIndex} sous-titres`)
    
    // 📥 Télécharger automatiquement les sous-titres si aucun ST détecté
    if (subIndex === 0 && srtInputs.length === 0) {
      console.log(`   📥 Aucun sous-titre détecté, téléchargement automatique avec subliminal...`)
      
      try {
        // Utiliser directement subliminal pour télécharger les SRT dans le dossier temp
        // Format de nom attendu: "nom-du-film.fr.srt" et "nom-du-film.en.srt"
        const videoBasename = path.basename(sourcePath, path.extname(sourcePath))
        const langs = ['fr', 'en']
        const downloadedSrts: Array<{ path: string, lang: string }> = []
        
        for (const lang of langs) {
          try {
            // Utiliser subliminal directement pour télécharger dans le dossier temp
            const subliminalLang = lang === 'fr' ? 'fra' : 'eng'
            const subliminalCommand = `cd "${TEMP_DIR}" && /Users/lionelvernay/Library/Python/3.9/bin/subliminal download -l ${subliminalLang} --refiner hash --refiner metadata --refiner tmdb --min-score 85 "${sourcePath}"`
            
            const { stdout, stderr } = await execAsync(subliminalCommand, {
              timeout: 60000,
              maxBuffer: 1024 * 1024 * 10
            })
            
            console.log(`   📋 Sortie subliminal (${lang}):`, stdout)
            
            // Chercher le fichier SRT téléchargé
            // Format: "nom-du-film.fra.srt" ou "nom-du-film.eng.srt"
            const possibleSrtNames = [
              `${videoBasename}.${subliminalLang}.srt`,
              `${videoBasename}.${lang}.srt`,
              `${path.basename(sourcePath, path.extname(sourcePath))}.${subliminalLang}.srt`,
              `${path.basename(sourcePath, path.extname(sourcePath))}.${lang}.srt`
            ]
            
            let srtFound = false
            for (const srtName of possibleSrtNames) {
              const srtPath = path.join(TEMP_DIR, srtName)
              try {
                await fs.access(srtPath)
                downloadedSrts.push({ path: srtPath, lang })
                console.log(`   ✅ Sous-titre ${lang.toUpperCase()} téléchargé: ${srtName}`)
                srtFound = true
                break
              } catch {
                // Fichier n'existe pas, continuer
              }
            }
            
            if (!srtFound) {
              console.log(`   ⚠️  Aucun fichier SRT trouvé pour ${lang.toUpperCase()} après téléchargement`)
            }
          } catch (err) {
            console.error(`   ❌ Erreur téléchargement ST ${lang}:`, err)
          }
        }
        
        // Ajouter les SRT téléchargés aux inputs
        if (downloadedSrts.length > 0) {
          srtInputs.push(...downloadedSrts)
          console.log(`   ✅ ${downloadedSrts.length} sous-titre(s) téléchargé(s) et prêt(s) à intégrer`)
        }
      } catch (err) {
        console.error(`   ❌ Erreur téléchargement automatique:`, err)
      }
    }
    
    // 📥 Ajouter les fichiers SRT (externes ou téléchargés) à FFmpeg
    if (srtInputs.length > 0) {
      console.log(`   ✅ ${srtInputs.length} fichier(s) SRT à intégrer`)
      
      // Les inputs SRT commencent à l'index 1 (0 = vidéo)
      let srtInputIndex = 1
      for (const srtInput of srtInputs) {
        console.log(`   📝 Intégration SRT: ${path.basename(srtInput.path)} (langue: ${srtInput.lang})`)
        
        // Mapper le stream 0 de cet input SRT
        ffmpegArgs.push('-map', `${srtInputIndex}:0`)
        ffmpegArgs.push(`-c:s:${subIndex}`, 'mov_text')
        ffmpegArgs.push(`-metadata:s:s:${subIndex}`, `language=${srtInput.lang}`)
        ffmpegArgs.push(`-metadata:s:s:${subIndex}`, `title=${srtInput.lang === 'fr' ? 'Français' : 'English'}`)
        
        // Marquer le premier comme default
        if (subIndex === 0) {
          ffmpegArgs.push(`-disposition:s:${subIndex}`, 'default')
        }
        
        srtInputIndex++
        subIndex++
      }
    } else if (subIndex === 0) {
      console.log(`   ⚠️  Aucun sous-titre disponible (ni dans le fichier, ni externe, ni téléchargé)`)
    }
    
    // 🚀 Options finales
    ffmpegArgs.push(
      '-stats_period', '0.5',           // Envoyer des stats toutes les 0.5 secondes
      '-movflags', '+faststart',        // Index au début pour streaming
      '-y',
      outputPath
    )
    
    console.log(`🎬 Encodage: ${filename}`)
    
    // Lancer FFmpeg
    console.log(`🚀 Lancement FFmpeg avec ${ffmpegArgs.length} arguments`)
    console.log(`   Commande complète:`)
    console.log(`   ffmpeg ${ffmpegArgs.join(' ')}`)
    
    currentProcess = spawn('ffmpeg', ffmpegArgs)
    
    let ffmpegErrors: string[] = []
    
    // Buffer pour accumuler les données multi-lignes
    let stderrBuffer = ''
    
    currentProcess.stderr.on('data', (data: Buffer) => {
      // Accumuler les données dans un buffer
      stderrBuffer += data.toString()
      
      // Traiter ligne par ligne pour capturer TOUS les time=
      const lines = stderrBuffer.split('\n')
      // Garder la dernière ligne incomplète dans le buffer
      stderrBuffer = lines.pop() || ''
      
      for (const line of lines) {
        // Logger TOUTES les erreurs et warnings
        if (line.includes('error') || line.includes('Error') || line.includes('Invalid')) {
          console.error(`⚠️  FFmpeg: ${line.substring(0, 200)}`)
          ffmpegErrors.push(line)
        }
        
        // Regex ultra-robuste pour capturer time= dans TOUS les formats FFmpeg
        // Formats supportés: time=00:01:23.45, time=1:23:45, time=01:23:45.123456
        const timeMatch = line.match(/time=(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)/)
        const fpsMatch = line.match(/fps=\s*(\d+(?:\.\d+)?)/)
        const speedMatch = line.match(/speed=\s*([\d.]+)x/)
        
        if (timeMatch) {
          const h = parseInt(timeMatch[1])
          const m = parseInt(timeMatch[2])
          const s = parseFloat(timeMatch[3])
          const currentSec = h * 3600 + m * 60 + s
          
          // Formater le temps pour l'affichage
          const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${Math.floor(s).toString().padStart(2, '0')}`
          
          // Calculer totalSec depuis la durée stockée
          const [dh, dm, ds] = currentEncoding.duration.split(':').map(Number)
          const totalSec = dh * 3600 + dm * 60 + ds
          
          if (totalSec > 0) {
            // Calcul précis avec une décimale pour plus de fluidité
            const percentRaw = (currentSec / totalSec) * 100
            // Utiliser Math.round au lieu de Math.floor pour plus de précision
            // Permettre jusqu'à 100% (pas de Math.min(99))
            const percent = Math.min(100, Math.round(percentRaw * 10) / 10)
            
            // Toujours mettre à jour, même si le pourcentage n'a changé que d'un dixième
            const lastPercent = currentEncoding.percent
            currentEncoding.currentTime = time
            currentEncoding.percent = percent
            currentEncoding.fps = fpsMatch ? Math.floor(parseFloat(fpsMatch[1])) : currentEncoding.fps
            currentEncoding.speed = speedMatch ? parseFloat(speedMatch[1]) : currentEncoding.speed
            
            // Sauvegarder l'état à CHAQUE ligne qui contient time= (mise à jour très fréquente)
            saveState(currentEncoding)
            
            // Logger progression tous les 1% pour suivre précisément
            if (Math.floor(percent) !== Math.floor(lastPercent)) {
              console.log(`   📊 ${percent.toFixed(1)}% - ${time}/${currentEncoding.duration} - ${currentEncoding.speed.toFixed(1)}x`)
            }
          }
        }
      }
    })
    
    currentProcess.on('close', async (code: number) => {
      if (code === 0) {
        // Vérifier que le fichier final est valide
        try {
          const stats = await fs.stat(outputPath)
          const sizeMB = (stats.size / 1024 / 1024).toFixed(0)
          console.log(`✅ ${filename} terminé - Taille: ${sizeMB} MB`)
          
          // Vérifier la durée du fichier final
          const { execSync } = require('child_process')
          const finalDuration = execSync(`ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`, { encoding: 'utf-8' }).trim()
          const expectedDuration = hours * 3600 + minutes * 60 + seconds
          const actualDuration = parseFloat(finalDuration)
          
          if (Math.abs(actualDuration - expectedDuration) > 30) {
            console.error(`⚠️  DURÉE INCORRECTE: attendu ${expectedDuration}s, obtenu ${actualDuration}s`)
            console.error(`⚠️  Le fichier est probablement corrompu ou incomplet !`)
          }
          
          // ⚠️ CRITIQUE: Marquer comme terminé SEULEMENT après vérification du fichier
          currentEncoding.percent = 100
          currentEncoding.isRunning = false
          saveState(currentEncoding)
          console.log(`✅ POST - Encodage terminé: ${filename} - Taille: ${sizeMB} MB - Durée: ${actualDuration.toFixed(0)}s`)
        } catch (err) {
          console.error(`❌ Erreur vérification fichier final:`, err)
          // Même en cas d'erreur, marquer comme terminé pour éviter un blocage
          currentEncoding.isRunning = false
          saveState(currentEncoding)
        }
      } else {
        console.error(`❌ ${filename} erreur code ${code}`)
        if (ffmpegErrors.length > 0) {
          console.error(`   Erreurs FFmpeg:`)
          ffmpegErrors.slice(-5).forEach(e => console.error(`     ${e.substring(0, 150)}`))
        }
        // ⚠️ CRITIQUE: Marquer comme terminé même en cas d'erreur pour éviter le blocage
        currentEncoding.isRunning = false
        currentEncoding.percent = 0 // Réinitialiser le pourcentage en cas d'erreur
        saveState(currentEncoding)
      }
      currentProcess = null
    })
    
    return NextResponse.json({
      success: true,
      message: `Encodage de ${filename} démarré`
    })
    
  } catch (error) {
    console.error('Erreur POST:', error)
    currentEncoding.isRunning = false
    return NextResponse.json({
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

