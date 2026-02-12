/**
 * API de nettoyage v2 - Plus robuste
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { exec } from 'child_process'
import { promisify } from 'util'
import { rm } from 'fs/promises'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  // Vérification admin obligatoire
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Non autorisé', 403)
  }
  
  console.log('[CLEANUP] Nettoyage complet demandé')
  
  try {
    // 1. Tuer TOUS les processus FFmpeg de manière agressive
    const killCommands = [
      'pkill -9 -f ffmpeg',
      'pkill -9 ffmpeg',
      'killall -9 ffmpeg'
    ]
    
    for (const cmd of killCommands) {
      try {
        await execAsync(cmd)
        console.log(`[CLEANUP] ${cmd} exécuté`)
      } catch {
        // Ignorer les erreurs (processus non trouvé)
      }
    }
    
    // 2. Nettoyer le cache HLS temporaire (legacy)
    try {
      await rm('/tmp/leon-hls', { recursive: true, force: true })
      console.log(`[CLEANUP] Cache nettoyé: /tmp/leon-hls`)
    } catch {
      // Ignorer si le dossier n'existe pas
    }
    
    // 3. Vérifier qu'il ne reste plus de processus
    let remainingProcesses = 0
    try {
      const { stdout } = await execAsync('pgrep -c ffmpeg')
      remainingProcesses = parseInt(stdout.trim()) || 0
    } catch {
      // pgrep retourne une erreur si aucun processus trouvé (c'est bien)
      remainingProcesses = 0
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Nettoyage complet effectué',
      remainingProcesses
    })
    
  } catch (error) {
    console.error('Erreur nettoyage:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Erreur lors du nettoyage' 
    }, { status: 500 })
  }
}

// GET pour vérifier l'état
export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Non autorisé', 403)
  }
  try {
    // Compter les processus FFmpeg
    let ffmpegCount = 0
    try {
      const { stdout } = await execAsync('pgrep -c ffmpeg')
      ffmpegCount = parseInt(stdout.trim()) || 0
    } catch {
      ffmpegCount = 0
    }
    
    // Vérifier l'espace disque utilisé par les caches
    let cacheSize = '0'
    try {
      const { stdout } = await execAsync('du -sh /tmp/leon-hls* 2>/dev/null | tail -1 | cut -f1')
      cacheSize = stdout.trim() || '0'
    } catch {
      cacheSize = '0'
    }
    
    return NextResponse.json({
      ffmpegProcesses: ffmpegCount,
      cacheSize,
      healthy: ffmpegCount <= 2,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Erreur health check:', error)
    return NextResponse.json({ 
      error: 'Erreur health check' 
    }, { status: 500 })
  }
}
