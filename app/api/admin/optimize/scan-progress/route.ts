/**
 * API: Progression du scan en temps réel
 * GET /api/admin/optimize/scan-progress
 */

import { NextResponse } from 'next/server'

// Variables globales partagées avec scan/route.ts
let currentScanProgress = {
  isScanning: false,
  currentMovie: '',
  analyzed: 0,
  total: 0,
  needsOptimization: 0,
  alreadyOptimized: 0,
  errors: 0
}

export function updateScanProgress(progress: typeof currentScanProgress) {
  currentScanProgress = { ...progress }
}

export function getScanProgress() {
  return currentScanProgress
}

export async function GET() {
  return NextResponse.json(currentScanProgress)
}


