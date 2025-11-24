/**
 * API Route: Statut du buffer adaptatif
 * GET /api/buffer-status?path=/chemin/vers/video.mkv&audio=0
 * Retourne l'état du buffering pour ajuster le comportement du player
 */

import { NextRequest, NextResponse } from 'next/server'
import { getBufferInstance } from '@/lib/adaptive-buffer'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepath = searchParams.get('path')
  const audioTrack = searchParams.get('audio') || '0'

  if (!filepath) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 })
  }

  // Construire le sessionId (même logique que dans hls/route.ts)
  const sessionId = `${filepath}_audio${audioTrack}`

  try {
    const bufferManager = getBufferInstance(sessionId)
    const status = bufferManager.getStatusReport()

    return NextResponse.json({
      success: true,
      sessionId: sessionId.slice(0, 50) + '...',
      ...status
    })
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] [BUFFER] ❌ Erreur:`, error.message)
    return NextResponse.json(
      { error: 'Failed to get buffer status', details: error.message },
      { status: 500 }
    )
  }
}


