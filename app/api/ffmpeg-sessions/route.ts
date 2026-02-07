/**
 * API de gestion des sessions FFmpeg
 * GET /api/ffmpeg-sessions - Liste les sessions actives
 * DELETE /api/ffmpeg-sessions?session=xxx - Tue une session spécifique
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import ffmpegManager from '@/lib/ffmpeg-manager'

export async function GET() {
  try {
    const stats = ffmpegManager.getStats()
    const health = await ffmpegManager.healthCheck()
    
    return NextResponse.json({
      stats,
      health,
      maxConcurrent: 2,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Erreur récupération sessions:', error)
    return NextResponse.json({ 
      error: 'Erreur récupération sessions' 
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authErrorResponse(authError, 403)
  
  const searchParams = request.nextUrl.searchParams
  const sessionId = searchParams.get('session')
  
  if (!sessionId) {
    // Si pas de session spécifiée, nettoyer les orphelins
    try {
      await ffmpegManager.cleanupOrphans()
      return NextResponse.json({ 
        success: true,
        message: 'Orphelins nettoyés'
      })
    } catch (error) {
      console.error('Erreur nettoyage orphelins:', error)
      return NextResponse.json({ 
        error: 'Erreur nettoyage orphelins' 
      }, { status: 500 })
    }
  }
  
  try {
    await ffmpegManager.killSession(sessionId)
    return NextResponse.json({ 
      success: true,
      message: `Session ${sessionId} terminée`
    })
  } catch (error) {
    console.error('Erreur suppression session:', error)
    return NextResponse.json({ 
      error: 'Erreur suppression session' 
    }, { status: 500 })
  }
}
