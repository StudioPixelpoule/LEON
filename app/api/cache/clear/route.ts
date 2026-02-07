/**
 * API Route: Vider le cache HLS
 * POST /api/cache/clear
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { getCacheInstance } from '@/lib/segment-cache'

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authErrorResponse(authError, 403)
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



