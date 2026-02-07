/**
 * API Route: Révéler un fichier dans le Finder (macOS)
 * Ouvre le Finder et sélectionne le fichier spécifié
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { spawn } from 'child_process'
import { validateMediaPath } from '@/lib/path-validator'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authErrorResponse(authError, 403)
  try {
    const { filepath } = await request.json()
    
    if (!filepath) {
      return NextResponse.json(
        { error: 'Chemin de fichier manquant' },
        { status: 400 }
      )
    }
    
    // Validation sécurisée du chemin (protection path traversal)
    const pathValidation = validateMediaPath(filepath)
    if (!pathValidation.valid || !pathValidation.normalized) {
      console.error('[REVEAL-FILE] Chemin invalide:', pathValidation.error)
      return NextResponse.json(
        { error: pathValidation.error || 'Chemin invalide' },
        { status: 400 }
      )
    }
    const validatedPath = pathValidation.normalized
    
    // Vérifier que nous sommes sur macOS
    if (process.platform !== 'darwin') {
      return NextResponse.json(
        { error: 'Cette fonctionnalité est disponible uniquement sur macOS' },
        { status: 400 }
      )
    }
    
    // Utiliser spawn avec osascript pour éviter l'injection de commandes
    await new Promise<void>((resolve, reject) => {
      const osascript = spawn('osascript', [
        '-e', `tell application "Finder" to reveal POSIX file "${validatedPath}"`,
        '-e', 'tell application "Finder" to activate'
      ])
      
      let stderr = ''
      osascript.stderr.on('data', (data) => { stderr += data.toString() })
      
      osascript.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`osascript exited with code ${code}: ${stderr}`))
        }
      })
      
      osascript.on('error', reject)
    })
    
    return NextResponse.json({
      success: true,
      message: 'Fichier révélé dans le Finder'
    })
    
  } catch (error) {
    console.error('Erreur révélation fichier:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors de la révélation du fichier',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    )
  }
}

