import { NextRequest, NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

const HLS_TEMP_DIR = '/tmp/leon-hls'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepath = searchParams.get('path')
  const audioTrack = searchParams.get('audio') || '0'
  const startSegment = parseInt(searchParams.get('start') || '0')
  const count = parseInt(searchParams.get('count') || '3') // Précharger 3 segments par défaut
  
  if (!filepath) {
    return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })
  }

  // Créer le même hash que dans /api/hls
  const sessionId = `${filepath}_audio${audioTrack}`
  const fileHash = crypto.createHash('md5').update(sessionId).digest('hex')
  const sessionDir = path.join(HLS_TEMP_DIR, fileHash)

  try {
    const segments = []
    
    // Précharger plusieurs segments
    for (let i = startSegment; i < startSegment + count; i++) {
      const segmentPath = path.join(sessionDir, `segment${i}.ts`)
      
      if (existsSync(segmentPath)) {
        const segmentData = await readFile(segmentPath)
        segments.push({
          index: i,
          size: segmentData.length,
          ready: true
        })
      } else {
        segments.push({
          index: i,
          ready: false
        })
      }
    }
    
    // Retourner l'état du buffer
    return NextResponse.json({
      segments,
      totalReady: segments.filter(s => s.ready).length,
      sessionDir: fileHash
    })
  } catch (error) {
    console.error('Erreur prebuffer:', error)
    return NextResponse.json({ error: 'Erreur prebuffer' }, { status: 500 })
  }
}
