/**
 * API Route: Vider le cache HLS
 * POST /api/cache/clear
 */

import { NextResponse } from 'next/server'
import { getCacheInstance } from '@/lib/segment-cache'

export async function POST() {
  try {
    const cache = getCacheInstance()
    const statsBefore = await cache.getStats()
    
    await cache.clear()
    
    return NextResponse.json({
      success: true,
      message: 'Cache vidé avec succès',
      deleted: {
        files: statsBefore.totalFiles,
        sizeGB: (statsBefore.totalSize / 1024 / 1024 / 1024).toFixed(2),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}

