/**
 * API Route: Health Check
 * GET /api/health
 * Endpoint léger pour vérifier la santé du serveur et mesurer la latence
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Response-Time': '0',
    }
  })
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  })
}
