/**
 * API Route: Statistiques du cache HLS
 * GET /api/cache/stats
 */

import { NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { getCacheInstance } from '@/lib/segment-cache'

export async function GET() {
  try {
    const cache = getCacheInstance()
    const stats = await cache.getStats()

    return NextResponse.json({
      success: true,
      stats: {
        totalSize: stats.totalSize,
        totalSizeGB: (stats.totalSize / 1024 / 1024 / 1024).toFixed(2),
        totalFiles: stats.totalFiles,
        oldestFile: stats.oldestFile,
        newestFile: stats.newestFile,
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



