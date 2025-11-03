import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { Readable } from 'stream'

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
    // Utiliser FFmpeg pour extraire les sous-titres et les convertir en WebVTT
    // Utiliser l'index absolu du stream, pas l'index relatif des sous-titres
    const ffmpegArgs = [
      '-i', filepath,
      '-map', `0:${trackIndex}`,     // Index absolu du stream dans le fichier
      '-c:s', 'webvtt',              // Convertir en WebVTT
      '-f', 'webvtt',                // Format de sortie
      'pipe:1'                       // Sortie vers stdout
    ]
    
    console.log(`📝 Extraction sous-titres: stream ${trackIndex} de ${filepath.split('/').pop()}`)

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
          console.error('Erreur FFmpeg:', errorData)
          resolve(NextResponse.json({ error: 'Erreur extraction sous-titres' }, { status: 500 }))
        } else {
          // Retourner les sous-titres WebVTT
          resolve(new NextResponse(vttData, {
            headers: {
              'Content-Type': 'text/vtt',
              'Cache-Control': 'public, max-age=3600',
            }
          }))
        }
      })

      ffmpeg.on('error', (err) => {
        console.error('Erreur spawn FFmpeg:', err)
        resolve(NextResponse.json({ error: 'FFmpeg non disponible' }, { status: 500 }))
      })
    })
  } catch (error) {
    console.error('Erreur extraction sous-titres:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
