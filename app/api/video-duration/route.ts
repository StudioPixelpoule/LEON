import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepathRaw = searchParams.get('path')

  if (!filepathRaw) {
    return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })
  }
  
  // Normaliser pour gérer les caractères Unicode (é, à, etc.)
  const filepath = filepathRaw.normalize('NFD')

  try {
    // Utiliser ffprobe pour obtenir la durée exacte
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format "${filepath}"`
    )
    
    const data = JSON.parse(stdout)
    const duration = parseFloat(data.format?.duration || '0')
    
    console.log(`⏱️ Durée de ${filepath.split('/').pop()}: ${duration}s`)
    
    return NextResponse.json({ 
      duration: duration,
      formatted: formatDuration(duration)
    })
  } catch (error) {
    console.error('Erreur récupération durée:', error)
    // Fallback: essayer avec une commande plus simple
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filepath}"`
      )
      const duration = parseFloat(stdout.trim())
      
      return NextResponse.json({ 
        duration: duration,
        formatted: formatDuration(duration)
      })
    } catch (fallbackError) {
      console.error('Erreur fallback durée:', fallbackError)
      return NextResponse.json({ duration: 0 })
    }
  }
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '0:00'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
