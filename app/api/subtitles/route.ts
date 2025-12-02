import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { exec } from 'child_process'
import { promisify } from 'util'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  const filepathRaw = searchParams.get('path')
  const trackIndex = searchParams.get('track')

  // Log structuré : début de requête
  console.log(`[${new Date().toISOString()}] [SUBTITLES] Requête extraction`, {
    track: trackIndex,
    filepath: filepathRaw?.split('/').pop()
  })

  if (!filepathRaw || !trackIndex) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }
  
  // Normaliser pour gérer les caractères Unicode
  const filepath = filepathRaw.normalize('NFD')

  try {
    // 🔍 ÉTAPE 1 : Vérifier le codec du sous-titre AVANT extraction
    console.log(`[${new Date().toISOString()}] [SUBTITLES] 🔍 Vérification codec piste ${trackIndex}`)
    
    const { stdout: probeOutput } = await execAsync(
      `ffprobe -v quiet -print_format json -show_streams -select_streams ${trackIndex} "${filepath}"`
    )
    
    const streamInfo = JSON.parse(probeOutput)
    const stream = streamInfo?.streams?.[0]
    
    if (!stream) {
      console.error(`❌ Piste ${trackIndex} introuvable`)
      return NextResponse.json({ 
        error: `Piste de sous-titre ${trackIndex} introuvable` 
      }, { status: 404 })
    }
    
    const codec = stream.codec_name
    const codecType = stream.codec_type
    
    console.log(`[${new Date().toISOString()}] [SUBTITLES] 📝 Codec détecté: ${codec} (type: ${codecType})`)
    
    // Vérifier que c'est bien un sous-titre
    if (codecType !== 'subtitle') {
      console.error(`[${new Date().toISOString()}] [SUBTITLES] ❌ Piste invalide`, {
        trackIndex,
        expectedType: 'subtitle',
        actualType: codecType
      })
      return NextResponse.json({ 
        error: `La piste ${trackIndex} n'est pas un sous-titre` 
      }, { status: 400 })
    }
    
    // 🚫 Codecs incompatibles (image-based, pas de texte)
    // Liste exhaustive des formats sous-titres basés sur des images
    const incompatibleCodecs = [
      'hdmv_pgs_subtitle',  // PGS (Blu-ray)
      'dvd_subtitle',        // VOBSUB (DVD)
      'dvdsub',              // Alias de dvd_subtitle
      'pgssub',              // Alias de PGS
      'dvb_subtitle',        // DVB (TV numérique)
      'xsub'                 // XSUB (DivX)
    ]
    
    if (incompatibleCodecs.includes(codec)) {
      console.warn(`[${new Date().toISOString()}] [SUBTITLES] ⚠️ Format image-based détecté`, {
        codec,
        action: 'fallback vers sous-titres externes/téléchargement'
      })
      
      // 🔄 FALLBACK 1 : Chercher des sous-titres SRT externes
      console.log(`[${new Date().toISOString()}] [SUBTITLES] 🔍 Recherche sous-titres externes`)
      const externalResponse = await fetch(
        `${request.nextUrl.origin}/api/subtitles/external?path=${encodeURIComponent(filepath)}&lang=fr`
      )
      
      if (externalResponse.ok) {
        const duration = Date.now() - startTime
        console.log(`[${new Date().toISOString()}] [SUBTITLES] ✅ Sous-titres externes trouvés (${duration}ms)`)
        const vttContent = await externalResponse.text()
        return new NextResponse(vttContent, {
          headers: {
            'Content-Type': 'text/vtt; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          }
        })
      }
      
      // 🔄 FALLBACK 2 : Télécharger automatiquement depuis OpenSubtitles
      console.log(`[${new Date().toISOString()}] [SUBTITLES] 📥 Tentative téléchargement OpenSubtitles`)
      const searchResponse = await fetch(
        `${request.nextUrl.origin}/api/subtitles/search?path=${encodeURIComponent(filepath)}&lang=fra`
      )
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        
        if (searchData.success && searchData.redirectTo) {
          const duration = Date.now() - startTime
          console.log(`[${new Date().toISOString()}] [SUBTITLES] ✅ Sous-titres téléchargés auto (${duration}ms)`)
          
          // Recharger les sous-titres externes maintenant qu'ils ont été téléchargés
          const retryExternal = await fetch(
            `${request.nextUrl.origin}${searchData.redirectTo}`
          )
          
          if (retryExternal.ok) {
            const vttContent = await retryExternal.text()
            return new NextResponse(vttContent, {
              headers: {
                'Content-Type': 'text/vtt; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
              }
            })
          }
        }
      }
      
      // Pas de fallback disponible
      const duration = Date.now() - startTime
      console.warn(`[${new Date().toISOString()}] [SUBTITLES] ⚠️ Aucun fallback disponible (${duration}ms)`, {
        codec,
        triedExternal: true,
        triedDownload: true
      })
      return NextResponse.json({ 
        error: `Format de sous-titre incompatible (${codec}). Aucun sous-titre texte disponible pour ce film.`,
        codec: codec,
        suggestion: 'Téléchargez manuellement des sous-titres depuis OpenSubtitles.org et placez-les à côté de la vidéo.'
      }, { status: 415 })
    }
    
    // ✅ ÉTAPE 2 : Extraction avec conversion WebVTT
    console.log(`[${new Date().toISOString()}] [SUBTITLES] 📝 Extraction sous-titres`, {
      stream: trackIndex,
      codec,
      file: filepath.split('/').pop()
    })
    
    const ffmpegArgs = [
      '-i', filepath,
      '-map', `0:${trackIndex}`,     // Index absolu du stream
      '-c:s', 'webvtt',              // Convertir en WebVTT
      '-f', 'webvtt',                // Format de sortie
      'pipe:1'                       // Sortie vers stdout
    ]

    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe'] // Capturer stdout et stderr
    })
    
    let vttData = ''
    let errorData = ''

    ffmpeg.stdout.on('data', (chunk) => {
      vttData += chunk.toString()
    })

    ffmpeg.stderr.on('data', (chunk) => {
      errorData += chunk.toString()
    })

    return new Promise<NextResponse>((resolve) => {
      ffmpeg.on('close', (code) => {
        const duration = Date.now() - startTime
        
        if (code !== 0) {
          // 🔍 Logger l'erreur complète pour debug
          console.error(`[${new Date().toISOString()}] [SUBTITLES] ❌ FFmpeg erreur (code ${code}, ${duration}ms)`)
          console.error('--- DÉBUT ERREUR FFmpeg ---')
          console.error(errorData.split('\n').slice(-15).join('\n')) // 15 dernières lignes
          console.error('--- FIN ERREUR FFmpeg ---')
          
          resolve(NextResponse.json({ 
            error: 'Erreur extraction sous-titres',
            codec: codec,
            details: codec === 'ass' || codec === 'ssa' 
              ? 'Conversion ASS/SSA échouée. Certains effets avancés ne sont pas compatibles WebVTT.'
              : `Conversion ${codec} vers WebVTT échouée. Vérifiez les logs serveur.`
          }, { status: 500 }))
        } else {
          console.log(`[${new Date().toISOString()}] [SUBTITLES] ✅ Extraction réussie`, {
            duration: `${duration}ms`,
            size: `${vttData.length} caractères`,
            codec
          })
          
          // Retourner les sous-titres WebVTT
          resolve(new NextResponse(vttData, {
            headers: {
              'Content-Type': 'text/vtt; charset=utf-8',
              'Cache-Control': 'public, max-age=3600',
            }
          }))
        }
      })

      ffmpeg.on('error', (err) => {
        const duration = Date.now() - startTime
        console.error(`[${new Date().toISOString()}] [SUBTITLES] ❌ Erreur spawn FFmpeg (${duration}ms)`, {
          error: err.message,
          filepath: filepath.split('/').pop()
        })
        resolve(NextResponse.json({ 
          error: 'FFmpeg non disponible',
          details: 'Le processus FFmpeg n\'a pas pu démarrer. Vérifiez l\'installation.'
        }, { status: 500 }))
      })
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[${new Date().toISOString()}] [SUBTITLES] ❌ Erreur fatale (${duration}ms)`, {
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined
    })
    return NextResponse.json({ 
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}
