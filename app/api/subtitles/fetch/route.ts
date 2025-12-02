/**
 * API: Télécharger des sous-titres avec subliminal (alternative gratuite à OpenSubtitles VIP)
 * GET /api/subtitles/fetch?path=/chemin/vers/video.mp4&lang=fr
 * Retourne les sous-titres en WebVTT pour affichage direct dans le lecteur
 */

import { NextRequest, NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import path from 'path'
import { promises as fs } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Chemin vers subliminal
const SUBLIMINAL_PATH = '/Users/lionelvernay/Library/Python/3.9/bin/subliminal'

export async function OPTIONS(request: NextRequest) {
  // Gérer les requêtes CORS preflight
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filepathRaw = searchParams.get('path')
    const lang = searchParams.get('lang') || 'fr'
    const offset = parseFloat(searchParams.get('offset') || '0') // Décalage en secondes pour synchroniser
    
    if (!filepathRaw) {
      return NextResponse.json({ error: 'Chemin du fichier manquant' }, { status: 400 })
    }
    
    // Normaliser le chemin
    const filepath = filepathRaw.normalize('NFD')
    const videoDir = path.dirname(filepath)
    const videoFilename = path.basename(filepath)
    
    console.log(`🔍 Recherche sous-titres avec subliminal pour: ${videoFilename} (langue: ${lang})`)
    
    // Vérifier si subliminal est disponible
    try {
      await execAsync(`test -x "${SUBLIMINAL_PATH}"`)
    } catch {
      console.error('❌ subliminal non installé ou inaccessible')
      return NextResponse.json({ 
        success: false,
        message: 'Outil de téléchargement non disponible',
        vtt: null,
        help: 'Installez subliminal : pip3 install --user subliminal'
      }, { status: 503 })
    }
    
    // Convertir le code de langue (fr -> fra, en -> eng)
    const subliminalLang = lang === 'fr' ? 'fra' : lang === 'en' ? 'eng' : lang
    
    // Télécharger les sous-titres avec subliminal
    // Utiliser plusieurs refiners pour améliorer la correspondance : hash, metadata, tmdb
    console.log(`📥 Téléchargement sous-titres ${subliminalLang} avec subliminal...`)
    
    // ⚠️ IMPORTANT: Supprimer les anciens fichiers SRT qui pourraient être incorrects
    // avant de télécharger de nouveaux sous-titres
    const videoBasename = path.basename(filepath, path.extname(filepath))
    const oldSrtPaths = [
      path.join(videoDir, `${videoBasename}.${subliminalLang}.srt`),
      path.join(videoDir, `${videoBasename}.${lang}.srt`),
      path.join(videoDir, `${videoBasename}.srt`),
    ]
    
    for (const oldPath of oldSrtPaths) {
      try {
        await fs.access(oldPath)
        console.log(`   🗑️ Suppression ancien fichier SRT: ${path.basename(oldPath)}`)
        await fs.unlink(oldPath)
      } catch {
        // Fichier n'existe pas, c'est OK
      }
    }
    
    // Première tentative : hash + metadata + tmdb pour la meilleure correspondance avec score élevé
    // Le hash est automatiquement utilisé par subliminal, on ajoute les refiners pour améliorer la précision
    let command = `cd "${videoDir}" && "${SUBLIMINAL_PATH}" download -l ${subliminalLang} --refiner hash --refiner metadata --refiner tmdb --min-score 85 "${videoFilename}"`
    
    let srtPath: string | null = null
    let attempts = 0
    const maxAttempts = 2
    
    while (attempts < maxAttempts && !srtPath) {
      attempts++
      
      if (attempts > 1) {
        // Deuxième tentative : score plus bas mais toujours avec hash pour éviter les mauvais résultats
        console.log(`📥 Tentative ${attempts}: téléchargement avec score réduit (mais toujours avec hash)...`)
        command = `cd "${videoDir}" && "${SUBLIMINAL_PATH}" download -l ${subliminalLang} --refiner hash --min-score 60 "${videoFilename}"`
      }
      
      try {
        const { stdout, stderr } = await execAsync(command, { 
          timeout: 60000, // 60 secondes max
          maxBuffer: 1024 * 1024 * 10 // 10MB
        })
        
        console.log(`📋 Sortie subliminal (tentative ${attempts}):`, stdout)
        
        if (stderr && !stderr.includes('Downloaded')) {
          console.warn('⚠️ Avertissement:', stderr)
        }
        
        // Trouver le fichier SRT téléchargé
        const videoBasename = path.basename(filepath, path.extname(filepath))
        const possibleSrtPaths = [
          path.join(videoDir, `${videoBasename}.${subliminalLang}.srt`),
          path.join(videoDir, `${videoBasename}.${lang}.srt`),
          path.join(videoDir, `${videoBasename}.srt`),
        ]
        
        for (const p of possibleSrtPaths) {
          try {
            await fs.access(p)
            srtPath = p
            console.log(`✅ Fichier SRT trouvé: ${path.basename(p)}`)
            break
          } catch {
            // Fichier n'existe pas, continuer
          }
        }
        
        if (srtPath) {
          break // Succès, sortir de la boucle
        }
        
        // Vérifier si subliminal a indiqué qu'il n'a rien trouvé
        if (stdout.includes('No subtitles found') || stdout.includes('0 video collected') || stdout.includes('Downloaded 0 subtitle')) {
          if (attempts < maxAttempts) {
            console.warn(`⚠️ Aucun sous-titre trouvé (tentative ${attempts}), réessai avec moins de restrictions...`)
            continue // Réessayer avec moins de restrictions
          } else {
            console.warn('⚠️ Aucun sous-titre trouvé après toutes les tentatives')
            console.warn(`   Le hash du fichier "${videoFilename}" ne correspond à aucun sous-titre disponible`)
            console.warn(`   Cela signifie que les sous-titres téléchargés précédemment ne correspondent probablement pas au bon film`)
            return NextResponse.json({ 
              success: false, 
              message: 'Aucun sous-titre correspondant trouvé pour ce fichier vidéo. Le hash ne correspond à aucun sous-titre disponible. Les fichiers téléchargés précédemment peuvent être incorrects.',
              vtt: null
            }, { status: 404 })
          }
        }
      } catch (error) {
        console.error(`❌ Erreur tentative ${attempts}:`, error)
        if (attempts >= maxAttempts) {
          throw error // Re-lancer l'erreur si c'est la dernière tentative
        }
        // Sinon, continuer pour réessayer
      }
    }
    
    if (!srtPath) {
      console.error('❌ Fichier SRT non trouvé après toutes les tentatives')
      return NextResponse.json({ 
        success: false, 
        message: 'Erreur: fichier SRT non trouvé après téléchargement',
        vtt: null
      }, { status: 500 })
    }
    
    try {
      
      // Lire le fichier SRT
      const srtContent = await fs.readFile(srtPath, 'utf-8')
      
      // Vérifier que le contenu est valide
      const trimmedContent = srtContent.trim()
      if (trimmedContent.length < 50) {
        console.error(`   ❌ Contenu trop court (${trimmedContent.length} chars)`)
        return NextResponse.json({ 
          success: false, 
          message: 'Fichier SRT trop court ou corrompu',
          vtt: null
        }, { status: 500 })
      }
      
      if (!/^(\d+|WEBVTT)/i.test(trimmedContent)) {
        console.error(`   ❌ Format invalide (ne commence pas par un numéro ou WEBVTT)`)
        console.error(`   Début: ${trimmedContent.substring(0, 200)}`)
        return NextResponse.json({ 
          success: false, 
          message: 'Format de fichier SRT invalide',
          vtt: null
        }, { status: 500 })
      }
      
      // Afficher un échantillon du contenu pour vérifier que ce sont les bons sous-titres
      const lines = trimmedContent.split('\n')
      const firstSubtitleText = lines.find((line, idx) => {
        // Chercher la première ligne de texte (après un numéro et un timecode)
        return idx > 1 && !/^\d+$/.test(line.trim()) && !line.includes('-->') && line.trim().length > 0
      }) || lines.slice(0, 3).join(' ')
      
      console.log(`   ✅ Contenu SRT valide: ${trimmedContent.length} caractères`)
      console.log(`   📝 Échantillon (première ligne de sous-titre): ${firstSubtitleText.substring(0, 100)}...`)
      
      // Convertir SRT en WebVTT avec offset si nécessaire
      const vttContent = convertSRTtoWebVTT(srtContent, offset)
      
      if (offset !== 0) {
        console.log(`✅ Sous-titre ${lang.toUpperCase()} téléchargé et converti en WebVTT avec offset de ${offset}s (${vttContent.length} caractères)`)
      } else {
        console.log(`✅ Sous-titre ${lang.toUpperCase()} téléchargé et converti en WebVTT (${vttContent.length} caractères)`)
      }
      
      // Retourner le WebVTT directement
      return new NextResponse(vttContent, {
        headers: {
          'Content-Type': 'text/vtt; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        }
      })
      
    } catch (error) {
      console.error(`❌ Erreur exécution subliminal:`, error)
      
      // Vérifier si c'est un timeout
      if (error instanceof Error && error.message.includes('timeout')) {
        return NextResponse.json({ 
          success: false, 
          message: 'Délai d\'attente dépassé (> 60s)',
          vtt: null
        }, { status: 504 })
      }
      
      return NextResponse.json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Erreur lors du téléchargement',
        vtt: null
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('❌ Erreur API sous-titres:', error)
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Erreur serveur',
      vtt: null
    }, { status: 500 })
  }
}

/**
 * Convertit un fichier SRT en WebVTT avec option d'offset temporel
 */
function convertSRTtoWebVTT(srtContent: string, offsetSeconds: number = 0): string {
  // Remplacer les timecodes SRT (00:00:00,000) par WebVTT (00:00:00.000)
  let vtt = srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  
  // Appliquer l'offset si nécessaire
  if (offsetSeconds !== 0) {
    // Parser chaque timecode et ajouter l'offset
    vtt = vtt.replace(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/g, (match, hours, minutes, seconds, milliseconds) => {
      // Convertir en secondes totales
      const totalSeconds = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000
      const newTotalSeconds = Math.max(0, totalSeconds + offsetSeconds) // Ne pas aller en négatif
      
      // Convertir back en HH:MM:SS.mmm
      const newHours = Math.floor(newTotalSeconds / 3600)
      const newMinutes = Math.floor((newTotalSeconds % 3600) / 60)
      const newSeconds = Math.floor(newTotalSeconds % 60)
      const newMilliseconds = Math.floor((newTotalSeconds % 1) * 1000)
      
      return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}.${String(newMilliseconds).padStart(3, '0')}`
    })
  }
  
  // Ajouter l'en-tête WebVTT si absent
  if (!vtt.trim().startsWith('WEBVTT')) {
    vtt = 'WEBVTT\n\n' + vtt
  }
  
  return vtt
}
