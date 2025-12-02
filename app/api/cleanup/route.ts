import { NextResponse } from 'next/server'
import ffmpegManager from '@/lib/ffmpeg-manager'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    // Utiliser le gestionnaire centralisé pour nettoyer
    await ffmpegManager.cleanupAll()
    
    console.log('🧹 Nettoyage effectué via gestionnaire FFmpeg')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Nettoyage effectué',
      stats: ffmpegManager.getStats()
    })
  } catch (error) {
    console.error('Erreur nettoyage:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Erreur lors du nettoyage' 
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Health check du gestionnaire
    const health = await ffmpegManager.healthCheck()
    const stats = ffmpegManager.getStats()
    
    return NextResponse.json({ 
      health,
      stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Erreur health check:', error)
    return NextResponse.json({ 
      error: 'Erreur health check' 
    }, { status: 500 })
  }
}