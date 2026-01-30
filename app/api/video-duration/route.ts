import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { validateMediaPath } from '@/lib/path-validator'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

// Helper pour exécuter ffprobe avec spawn
function runFFprobe(args: string[], filepath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [...args, filepath])
    let stdout = ''
    let stderr = ''

    ffprobe.stdout.on('data', (data) => { stdout += data.toString() })
    ffprobe.stderr.on('data', (data) => { stderr += data.toString() })

    ffprobe.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(stderr || `ffprobe exited with code ${code}`))
      }
    })

    ffprobe.on('error', reject)
  })
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepathRaw = searchParams.get('path')

  if (!filepathRaw) {
    return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })
  }
  
  // Validation sécurisée du chemin
  const pathValidation = validateMediaPath(filepathRaw, { requireExists: true })
  if (!pathValidation.valid || !pathValidation.normalized) {
    return NextResponse.json({ error: pathValidation.error || 'Chemin invalide' }, { status: 400 })
  }
  const filepath = pathValidation.normalized

  try {
    // Utiliser ffprobe pour obtenir la durée exacte
    const stdout = await runFFprobe(
      ['-v', 'quiet', '-print_format', 'json', '-show_format'],
      filepath
    )
    
    const data = JSON.parse(stdout)
    const duration = parseFloat(data.format?.duration || '0')
    
    console.log(`[VIDEO_DURATION] ⏱️ Durée de ${filepath.split('/').pop()}: ${duration}s`)
    
    return NextResponse.json({ 
      duration: duration,
      formatted: formatDuration(duration)
    })
  } catch (error) {
    console.error('[VIDEO_DURATION] Erreur récupération durée:', error)
    // Fallback: essayer avec une commande plus simple
    try {
      const stdout = await runFFprobe(
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1'],
        filepath
      )
      const duration = parseFloat(stdout.trim())
      
      return NextResponse.json({ 
        duration: duration,
        formatted: formatDuration(duration)
      })
    } catch (fallbackError) {
      console.error('[VIDEO_DURATION] Erreur fallback durée:', fallbackError)
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
