/**
 * API Route: Révéler un fichier dans le Finder (macOS)
 * Ouvre le Finder et sélectionne le fichier spécifié
 */

import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: Request) {
  try {
    const { filepath } = await request.json()
    
    if (!filepath) {
      return NextResponse.json(
        { error: 'Chemin de fichier manquant' },
        { status: 400 }
      )
    }
    
    // Vérifier que nous sommes sur macOS
    if (process.platform !== 'darwin') {
      return NextResponse.json(
        { error: 'Cette fonctionnalité est disponible uniquement sur macOS' },
        { status: 400 }
      )
    }
    
    // Échapper les caractères spéciaux pour le shell
    const escapedPath = filepath.replace(/'/g, "'\\''")
    
    // Utiliser AppleScript pour révéler le fichier dans le Finder
    const command = `osascript -e 'tell application "Finder" to reveal POSIX file "${escapedPath}"' -e 'tell application "Finder" to activate'`
    
    await execAsync(command)
    
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

