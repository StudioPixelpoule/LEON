/**
 * API Route: Ouvrir un film dans le lecteur vidéo par défaut
 * POST /api/play - Lance VLC/QuickTime avec le fichier local
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
        { error: 'Chemin du fichier manquant' },
        { status: 400 }
      )
    }
    
    // Ouvrir avec l'application par défaut (VLC, QuickTime, etc.)
    const command = `open "${filepath}"`
    
    await execAsync(command)
    
    return NextResponse.json({ 
      success: true,
      message: 'Film lancé dans le lecteur vidéo'
    })
    
  } catch (error) {
    console.error('Erreur lecture film:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'ouverture du film' },
      { status: 500 }
    )
  }
}


