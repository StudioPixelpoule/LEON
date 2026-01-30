/**
 * API Route: Streaming vidéo MP4 avec sélection de piste audio
 * GET /api/stream-audio?path=/chemin/vers/video.mp4&audioTrack=1
 * Remuxe rapidement (copy) le MP4 avec uniquement la piste audio sélectionnée
 * Crée un fichier temporaire optimisé pour la navigation
 */

import { NextRequest, NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { stat, access } from 'fs/promises'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { validateMediaPath } from '@/lib/path-validator'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filepathRaw = searchParams.get('path')
    const audioTrackRaw = searchParams.get('audioTrack')
    
    if (!filepathRaw) {
      return NextResponse.json(
        { error: 'Chemin du fichier manquant' },
        { status: 400 }
      )
    }
    
    // Validation sécurisée du chemin (protection path traversal)
    const pathValidation = validateMediaPath(filepathRaw, { requireExists: true })
    if (!pathValidation.valid || !pathValidation.normalized) {
      console.error('[STREAM-AUDIO] Chemin invalide:', pathValidation.error)
      return NextResponse.json(
        { error: pathValidation.error || 'Chemin invalide' },
        { status: pathValidation.error?.includes('non trouvé') ? 404 : 400 }
      )
    }
    const filepath = pathValidation.normalized
    
    // Si pas de audioTrack spécifié, servir le fichier original
    if (!audioTrackRaw) {
      // Rediriger vers /api/stream normal
      return NextResponse.redirect(
        new URL(`/api/stream?path=${encodeURIComponent(filepathRaw)}`, request.url)
      )
    }
    
    const audioTrackIndex = parseInt(audioTrackRaw, 10)
    if (isNaN(audioTrackIndex) || audioTrackIndex < 0) {
      return NextResponse.json(
        { error: 'Index de piste audio invalide' },
        { status: 400 }
      )
    }
    
    // Vérifier que c'est un MP4
    const ext = path.extname(filepath).toLowerCase()
    if (ext !== '.mp4') {
      return NextResponse.json(
        { error: 'Cette fonctionnalité est uniquement disponible pour les fichiers MP4' },
        { status: 400 }
      )
    }
    
    // Créer un nom de fichier temporaire basé sur le hash MD5 du chemin complet + audioTrack
    // ⚠️ CRITIQUE: Utiliser MD5 pour garantir l'unicité et éviter les collisions entre fichiers différents
    const fileHash = crypto.createHash('md5').update(filepath).digest('hex')
    const tempDir = '/tmp/leon-audio-remux'
    const tempFilename = `${fileHash}-audio${audioTrackIndex}.mp4`
    const tempPath = path.join(tempDir, tempFilename)
    
    console.log(`🔍 Hash fichier: ${fileHash.substring(0, 8)}... (${path.basename(filepath)})`)
    
    // Créer le dossier temporaire s'il n'existe pas
    try {
      await access(tempDir)
    } catch {
      await fs.promises.mkdir(tempDir, { recursive: true })
    }
    
    // Vérifier si le fichier temporaire existe déjà et est valide
    // ⚠️ CRITIQUE: Vérifier aussi que le fichier source correspond bien (pour éviter les collisions)
    let fileExists = false
    try {
      const tempStats = await stat(tempPath)
      const sourceStats = await stat(filepath)
      const sizeMB = tempStats.size / 1024 / 1024
      const sourceSizeMB = sourceStats.size / 1024 / 1024
      
      // ⚠️ SÉCURITÉ: Vérifier que le fichier temporaire correspond bien au fichier source
      // en vérifiant les métadonnées (taille, date de modification)
      // Le fichier remuxé devrait être créé APRÈS le fichier source
      const tempMtime = tempStats.mtimeMs
      const sourceMtime = sourceStats.mtimeMs
      
      // Vérifier que le fichier a une taille raisonnable
      // Le fichier remuxé devrait être légèrement plus petit que l'original (on retire des pistes)
      // Mais pas beaucoup plus petit (max 50% de différence = probablement corrompu)
      const minExpectedSize = sourceStats.size * 0.5 // Au moins 50% de la taille originale
      
      if (tempStats.size < 1024 * 1024) {
        // Trop petit (moins de 1 MB)
        console.warn(`⚠️ Fichier temporaire trop petit (${sizeMB.toFixed(1)} MB), suppression et recréation...`)
        await fs.promises.unlink(tempPath).catch(() => {})
        fileExists = false
      } else if (tempStats.size < minExpectedSize) {
        // Probablement corrompu (moins de 50% de la taille originale)
        console.warn(`⚠️ Fichier temporaire suspect (${sizeMB.toFixed(1)} MB vs ${sourceSizeMB.toFixed(1)} MB source), suppression et recréation...`)
        await fs.promises.unlink(tempPath).catch(() => {})
        fileExists = false
      } else if (tempMtime < sourceMtime - 1000) {
        // Le fichier temporaire est plus ancien que le source (ou presque)
        // Cela signifie que le fichier source a été modifié après la création du cache
        // → Supprimer le cache pour éviter de servir un mauvais fichier
        console.warn(`⚠️ Fichier temporaire obsolète (créé avant modification du source), suppression et recréation...`)
        await fs.promises.unlink(tempPath).catch(() => {})
        fileExists = false
      } else {
        fileExists = true
        console.log(`✅ Fichier temporaire existant trouvé: ${tempFilename} (${sizeMB.toFixed(1)} MB)`)
      }
    } catch {
      // Fichier n'existe pas, on va le créer
      fileExists = false
    }
    
    if (!fileExists) {
      console.log(`🔊 Remuxage MP4 avec piste audio ${audioTrackIndex}: ${path.basename(filepath)}`)
      console.log(`   📁 Fichier temporaire: ${tempPath}`)
      
      // Détecter les pistes de sous-titres dans le fichier source avec leurs métadonnées (utilise spawn pour sécurité)
      let subtitleStreams: Array<{ index: number; language: string; title: string }> = []
      
      try {
        const probeOutput = await new Promise<string>((resolve, reject) => {
          const ffprobe = spawn('ffprobe', [
            '-v', 'quiet',
            '-select_streams', 's',
            '-show_entries', 'stream=index,tags=language,tags=title',
            '-of', 'json',
            filepath
          ])
          
          let stdout = ''
          let stderr = ''
          
          ffprobe.stdout.on('data', (data) => { stdout += data.toString() })
          ffprobe.stderr.on('data', (data) => { stderr += data.toString() })
          
          ffprobe.on('close', (code) => {
            if (code === 0) {
              resolve(stdout)
            } else {
              reject(new Error(`ffprobe exited with code ${code}: ${stderr}`))
            }
          })
          
          ffprobe.on('error', reject)
        })
        
        const probeData = JSON.parse(probeOutput)
        if (probeData.streams && Array.isArray(probeData.streams)) {
          subtitleStreams = probeData.streams.map((s: { index: number; tags?: { language?: string; title?: string } }, idx: number) => ({
            index: s.index,
            // Si pas de langue dans les tags, utiliser des valeurs par défaut basées sur l'index
            // (généralement, la première piste est FR, la deuxième peut être EN ou autre)
            language: s.tags?.language || (idx === 0 ? 'fr' : idx === 1 ? 'en' : 'und'),
            title: s.tags?.title || (idx === 0 ? 'Français' : idx === 1 ? 'English' : `Subtitle ${idx + 1}`)
          }))
          console.log(`   📝 ${subtitleStreams.length} pistes de sous-titres détectées`)
        }
      } catch (err) {
        console.warn('[STREAM-AUDIO] ⚠️ Erreur détection sous-titres (continuera sans):', err instanceof Error ? err.message : err)
      }
      
      // Construire la commande FFmpeg pour remuxer rapidement (copy, pas encode)
      // audioTrackIndex est l'index ABSOLU du stream dans le fichier (ex: 0=vidéo, 1=audio1, 2=audio2)
      const ffmpegArgs = [
        '-i', filepath,
        '-map', '0:v:0',              // Vidéo
        '-map', `0:${audioTrackIndex}`, // Piste audio spécifiée (index absolu)
      ]
      
      // Mapper chaque piste de sous-titre individuellement avec ses métadonnées
      subtitleStreams.forEach((sub, idx) => {
        ffmpegArgs.push('-map', `0:${sub.index}`) // Mapper avec l'index absolu du fichier source
        ffmpegArgs.push(`-c:s:${idx}`, 'copy')    // Copier le sous-titre (pas d'encodage)
        // ⚠️ CRITIQUE: Toujours ajouter les métadonnées (le navigateur en a besoin pour détecter les textTracks)
        ffmpegArgs.push(`-metadata:s:s:${idx}`, `language=${sub.language}`)
        if (sub.title) {
          ffmpegArgs.push(`-metadata:s:s:${idx}`, `title=${sub.title}`)
        }
        console.log(`   📝 Mappage sous-titre ${idx}: index ${sub.index}, langue: ${sub.language}, titre: ${sub.title || 'N/A'}`)
      })
      
      // Options finales
      ffmpegArgs.push(
        '-c:v', 'copy',               // Copier la vidéo (pas d'encodage)
        '-c:a', 'copy',               // Copier l'audio (pas d'encodage)
        '-f', 'mp4',                  // Format MP4
        // ⚠️ Pas de faststart : trop lent pour gros fichiers (6+ min pour 3.6GB)
        // Le navigateur pourra naviguer une fois les métadonnées chargées
        '-y',                         // Overwrite si existe
        tempPath                      // Output vers fichier temporaire
      )
      
      // Lancer FFmpeg et attendre la fin avec timeout
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
          stdio: ['ignore', 'pipe', 'pipe']
        })
        
        let errorOutput = ''
        let hasResolved = false
        
        // Timeout de 5 minutes pour le remuxage (copy sans faststart prend ~2-3 min pour 3.6GB)
        // Pour les très gros fichiers, cela peut prendre jusqu'à 4-5 minutes
        const timeout = setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true
            ffmpeg.kill('SIGTERM')
            // Tuer le processus par son PID plutôt que pkill global (plus sûr)
            if (ffmpeg.pid) {
              try {
                process.kill(ffmpeg.pid, 'SIGKILL')
              } catch {
                // Processus déjà terminé
              }
            }
            console.error('[STREAM-AUDIO] ❌ Timeout FFmpeg (5 min)')
            reject(new Error('TIMEOUT: Le remuxage prend trop de temps (plus de 5 minutes). Le fichier est peut-être trop volumineux.'))
          }
        }, 300000) // 5 minutes
        
        ffmpeg.stderr.on('data', (data) => {
          const output = data.toString()
          errorOutput += output
          // Log les erreurs critiques immédiatement
          if (output.includes('Error') || output.includes('error') || output.includes('Invalid')) {
            console.error('⚠️ FFmpeg stderr:', output.trim())
          }
          // Log aussi les warnings sur les streams manquants
          if (output.includes('Stream map') || output.includes('does not exist')) {
            // Ignorer les warnings sur les sous-titres manquants (c'est normal si le fichier n'en a pas)
            if (!output.includes('subtitle') && !output.includes('0:s')) {
              console.warn('⚠️ FFmpeg mapping:', output.trim())
            }
          }
          // Log les informations sur les sous-titres mappés
          if (output.includes('Stream #0') && output.includes('subtitle')) {
            console.log('📝 FFmpeg sous-titre:', output.trim())
          }
        })
        
        ffmpeg.on('error', (error) => {
          if (!hasResolved) {
            hasResolved = true
            clearTimeout(timeout)
            console.error('❌ Erreur FFmpeg:', error)
            reject(error)
          }
        })
        
        ffmpeg.on('close', (code) => {
          if (!hasResolved) {
            hasResolved = true
            clearTimeout(timeout)
            
            if (code !== 0 && code !== null) {
              console.error(`❌ FFmpeg terminé avec code ${code}`)
              console.error('Commande:', ffmpegArgs.join(' '))
              console.error('Erreur complète:', errorOutput)
              
              // Extraire un message d'erreur plus lisible
              let errorMessage = `Erreur FFmpeg (code ${code})`
              if (errorOutput.includes('Invalid') || errorOutput.includes('does not exist')) {
                errorMessage = 'Piste audio non trouvée dans le fichier source.'
              } else if (errorOutput.includes('Permission denied')) {
                errorMessage = 'Erreur de permissions lors de l\'écriture du fichier temporaire.'
              } else if (errorOutput.includes('No space left')) {
                errorMessage = 'Espace disque insuffisant pour créer le fichier temporaire.'
              } else if (errorOutput.length > 0) {
                // Prendre les 200 premiers caractères de l'erreur
                const shortError = errorOutput.substring(0, 200).replace(/\n/g, ' ').trim()
                errorMessage = `Erreur FFmpeg: ${shortError}`
              }
              
              reject(new Error(errorMessage))
            } else {
              // Vérifier que le fichier existe vraiment et a une taille raisonnable
              stat(tempPath).then(async (stats) => {
                const sizeMB = stats.size / 1024 / 1024
                const sourceStats = await stat(filepath)
                const minExpectedSize = sourceStats.size * 0.5
                
                if (stats.size < 1000) {
                  // Fichier trop petit (probablement corrompu)
                  console.error(`❌ Fichier temporaire trop petit: ${sizeMB.toFixed(1)} MB`)
                  reject(new Error(`Fichier temporaire corrompu (${sizeMB.toFixed(1)} MB)`))
                } else if (stats.size < minExpectedSize) {
                  // Probablement corrompu (moins de 50% de la taille originale)
                  console.error(`❌ Fichier temporaire suspect: ${sizeMB.toFixed(1)} MB (attendu: au moins ${(minExpectedSize / 1024 / 1024).toFixed(1)} MB)`)
                  await fs.promises.unlink(tempPath).catch(() => {})
                  reject(new Error(`Fichier temporaire corrompu (${sizeMB.toFixed(1)} MB)`))
                } else {
                  console.log(`✅ Remuxage terminé: ${tempFilename} (${sizeMB.toFixed(1)} MB)`)
                  resolve()
                }
              }).catch((err) => {
                console.error('❌ Fichier temporaire non créé:', err)
                console.error('   Commande FFmpeg:', ffmpegArgs.join(' '))
                reject(new Error(`Fichier temporaire non créé après remuxage: ${err.message}`))
              })
            }
          }
        })
      })
    }
    
    // Servir le fichier temporaire avec support des range requests (comme /api/stream)
    const fileStats = await stat(tempPath)
    const fileSize = fileStats.size
    
    // Obtenir le range header pour le streaming
    const range = request.headers.get('range')
    
    if (range) {
      // Parse le range (ex: "bytes=0-1024")
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = (end - start) + 1
      
      // Créer un stream pour la portion demandée
      const fileStream = fs.createReadStream(tempPath, { start, end })
      
      // Retourner la réponse avec le bon range
      return new NextResponse(fileStream as any, {
        status: 206, // Partial Content
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': 'video/mp4',
        },
      })
    } else {
      // Pas de range, envoyer le fichier complet
      const fileStream = fs.createReadStream(tempPath)
      
      return new NextResponse(fileStream as any, {
        status: 200,
        headers: {
          'Content-Length': fileSize.toString(),
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
        },
      })
    }
  } catch (error: any) {
    console.error('❌ Erreur streaming audio:', error)
    
    // Déterminer le code de statut et le message selon le type d'erreur
    let status = 500
    let errorMessage = 'Erreur lors du remuxage de la vidéo.'
    
    if (error?.message) {
      const msg = error.message as string
      
      if (msg.includes('TIMEOUT')) {
        status = 504 // Gateway Timeout
        errorMessage = 'Le remuxage prend trop de temps. Le fichier est peut-être trop volumineux.'
      } else if (msg.includes('non trouvée') || msg.includes('not found')) {
        status = 404
        errorMessage = 'Piste audio non trouvée dans le fichier source.'
      } else if (msg.includes('permissions') || msg.includes('Permission denied')) {
        status = 500
        errorMessage = 'Erreur de permissions lors de l\'écriture du fichier temporaire.'
      } else if (msg.includes('Espace disque') || msg.includes('No space')) {
        status = 507 // Insufficient Storage
        errorMessage = 'Espace disque insuffisant pour créer le fichier temporaire.'
      } else if (msg.includes('corrompu') || msg.includes('corrupted')) {
        status = 500
        errorMessage = 'Le fichier remuxé est corrompu. Veuillez réessayer.'
      } else {
        // Message d'erreur générique mais plus informatif
        errorMessage = msg.length > 200 ? msg.substring(0, 200) + '...' : msg
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status }
    )
  }
}

