import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepathRaw = searchParams.get('path')
  const trackIndex = searchParams.get('track')

  if (!filepathRaw || !trackIndex) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }
  
  // Normaliser pour gérer les caractères Unicode
  const filepath = filepathRaw.normalize('NFC')

  try {
    // 🔍 ÉTAPE 1 : Vérifier le codec du sous-titre AVANT extraction
    console.log(`🔍 Vérification codec piste ${trackIndex}...`)
    
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
    
    console.log(`📝 Codec détecté: ${codec} (type: ${codecType})`)
    
    // Vérifier que c'est bien un sous-titre
    if (codecType !== 'subtitle') {
      console.error(`❌ La piste ${trackIndex} n'est pas un sous-titre (type: ${codecType})`)
      return NextResponse.json({ 
        error: `La piste ${trackIndex} n'est pas un sous-titre` 
      }, { status: 400 })
    }
    
    // 🚫 Codecs incompatibles (image-based, pas de texte)
    const incompatibleCodecs = ['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvdsub', 'pgssub']
    
    if (incompatibleCodecs.includes(codec)) {
      console.warn(`⚠️ Codec incompatible: ${codec} (image-based)`)
      
      // 🔄 FALLBACK 1 : Chercher des sous-titres SRT externes
      console.log('🔍 Recherche sous-titres SRT externes...')
      const externalResponse = await fetch(
        `${request.nextUrl.origin}/api/subtitles/external?path=${encodeURIComponent(filepath)}&lang=fr`
      )
      
      if (externalResponse.ok) {
        console.log('✅ Sous-titres externes trouvés !')
        const vttContent = await externalResponse.text()
        return new NextResponse(vttContent, {
          headers: {
            'Content-Type': 'text/vtt; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          }
        })
      }
      
      // 🔄 FALLBACK 2 : Télécharger automatiquement depuis OpenSubtitles
      console.log('📥 Tentative de téléchargement automatique...')
      const searchResponse = await fetch(
        `${request.nextUrl.origin}/api/subtitles/search?path=${encodeURIComponent(filepath)}&lang=fra`
      )
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        
        if (searchData.success && searchData.redirectTo) {
          console.log('✅ Sous-titres téléchargés automatiquement !')
          
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
      console.warn('⚠️ Aucun sous-titre disponible (intégré, externe, ou téléchargeable)')
      return NextResponse.json({ 
        error: `Format de sous-titre incompatible (${codec}). Aucun sous-titre texte disponible pour ce film.`,
        codec: codec,
        suggestion: 'Téléchargez manuellement des sous-titres depuis OpenSubtitles.org et placez-les à côté de la vidéo.'
      }, { status: 415 })
    }
    
    // ✅ ÉTAPE 2 : Extraction avec conversion WebVTT
    console.log(`📝 Extraction sous-titres: stream ${trackIndex} de ${filepath.split('/').pop()}`)
    
    const ffmpegArgs = [
      '-i', filepath,
      '-map', `0:${trackIndex}`,     // Index absolu du stream
      '-c:s', 'webvtt',              // Convertir en WebVTT
      '-f', 'webvtt',                // Format de sortie
      'pipe:1'                       // Sortie vers stdout
    ]

    const ffmpeg = spawn('ffmpeg', ffmpegArgs)
    
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
        if (code !== 0) {
          // 🔍 Logger l'erreur complète pour debug
          console.error(`❌ Erreur FFmpeg (code ${code}):`)
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
          console.log(`✅ Sous-titres extraits: ${vttData.length} caractères`)
          
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
        console.error('❌ Erreur spawn FFmpeg:', err)
        resolve(NextResponse.json({ error: 'FFmpeg non disponible' }, { status: 500 }))
      })
    })
  } catch (error) {
    console.error('❌ Erreur extraction sous-titres:', error)
    return NextResponse.json({ 
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}
