/**
 * API: Scanner les séries TV sur le NAS
 * POST /api/scan-series - Lance le scan (arrière-plan si ?background=true)
 * GET /api/scan-series - Récupère le statut du scan en cours
 * 
 * Structure attendue:
 * /leon/media/series/
 *   ├── Breaking Bad/
 *   │   ├── Season 1/
 *   │   │   ├── Breaking Bad S01E01.mkv
 *   │   │   └── Breaking Bad S01E02.mkv
 *   │   └── Season 2/
 *   │       └── Breaking Bad S02E01.mkv
 *   └── Game of Thrones/
 *       └── Season 1/
 *           └── GOT S01E01.mkv
 */

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { getScanState, resetScanState, failScan } from '@/lib/scan/scan-state'
import { runScan } from '@/lib/scan/series-scanner'

/**
 * GET: Récupérer le statut du scan en cours
 */
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authErrorResponse(authError, 403)

  return NextResponse.json({
    success: true,
    scan: getScanState()
  })
}

/**
 * POST: Lancer un scan de séries
 * ?background=true pour exécution en arrière-plan
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authErrorResponse(authError, 403)

  // Vérifier si un scan est déjà en cours
  const currentState = getScanState()
  if (currentState.isRunning) {
    return NextResponse.json({
      success: false,
      error: 'Un scan est déjà en cours',
      scan: currentState
    }, { status: 409 })
  }

  // Mode background via query param
  const url = new URL(request.url)
  const backgroundMode = url.searchParams.get('background') === 'true'

  // Réinitialiser l'état pour le nouveau scan
  resetScanState()

  // Si mode background, lancer le scan et retourner immédiatement
  if (backgroundMode) {
    // Lancer le scan en arrière-plan (sans await)
    runScan().catch(err => {
      console.error('[SCAN] Erreur scan background:', err)
      failScan(err instanceof Error ? err.message : 'Erreur inconnue')
    })

    return NextResponse.json({
      success: true,
      message: 'Scan démarré en arrière-plan',
      scan: getScanState()
    })
  }

  // Mode synchrone (pour les appels locaux sans Cloudflare)
  try {
    await runScan()
    return NextResponse.json({
      success: true,
      stats: getScanState().stats
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({
      success: false,
      error: errorMessage,
      stats: getScanState().stats
    }, { status: 500 })
  }
}
