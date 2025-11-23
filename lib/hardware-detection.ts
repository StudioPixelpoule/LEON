/**
 * Détection automatique du matériel disponible pour accélération GPU
 * Supporte : VideoToolbox (macOS), VAAPI/QSV (Intel Quick Sync Linux), fallback CPU
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export type HardwareAcceleration = 'videotoolbox' | 'vaapi' | 'qsv' | 'none'

export interface HardwareCapabilities {
  acceleration: HardwareAcceleration
  encoder: string
  decoderArgs: string[]
  encoderArgs: string[]
  platform: 'macos' | 'linux' | 'unknown'
}

let cachedCapabilities: HardwareCapabilities | null = null

/**
 * Détecte le matériel disponible et retourne la meilleure configuration
 */
export async function detectHardwareCapabilities(): Promise<HardwareCapabilities> {
  // Retourner le cache si déjà détecté
  if (cachedCapabilities) {
    return cachedCapabilities
  }

  console.log(`[${new Date().toISOString()}] [HARDWARE] 🔍 Détection du matériel...`)

  try {
    // Détecter la plateforme
    const platform = process.platform === 'darwin' ? 'macos' : 
                    process.platform === 'linux' ? 'linux' : 'unknown'

    console.log(`[${new Date().toISOString()}] [HARDWARE] Plateforme: ${platform}`)

    // Lister les accélérations matérielles disponibles
    const { stdout: hwaccelsOutput } = await execAsync('ffmpeg -hwaccels 2>&1')
    const availableAccels = hwaccelsOutput.toLowerCase()

    console.log(`[${new Date().toISOString()}] [HARDWARE] Accélérations disponibles:`, 
      hwaccelsOutput.split('\n').filter(l => l.trim() && !l.includes('Hardware acceleration')).join(', '))

    // 🍎 MACOS : VideoToolbox (Apple Silicon M1/M2 ou Intel Mac)
    if (platform === 'macos' && availableAccels.includes('videotoolbox')) {
      console.log(`[${new Date().toISOString()}] [HARDWARE] ✅ VideoToolbox détecté (Apple GPU)`)
      
      cachedCapabilities = {
        acceleration: 'videotoolbox',
        encoder: 'h264_videotoolbox',
        platform: 'macos',
        decoderArgs: ['-hwaccel', 'videotoolbox'],
        encoderArgs: [
          '-c:v', 'h264_videotoolbox',
          '-b:v', '3000k',
          '-maxrate', '4000k',
          '-bufsize', '6000k',
          '-profile:v', 'main',
          '-level', '4.0',
          '-allow_sw', '1', // Fallback CPU si GPU échoue
        ]
      }
      return cachedCapabilities
    }

    // 🐧 LINUX : Intel Quick Sync (VAAPI ou QSV)
    if (platform === 'linux') {
      // Préférer QSV si disponible (plus performant)
      if (availableAccels.includes('qsv')) {
        console.log(`[${new Date().toISOString()}] [HARDWARE] ✅ Intel Quick Sync (QSV) détecté`)
        
        cachedCapabilities = {
          acceleration: 'qsv',
          encoder: 'h264_qsv',
          platform: 'linux',
          decoderArgs: ['-hwaccel', 'qsv', '-hwaccel_device', '/dev/dri/renderD128'],
          encoderArgs: [
            '-c:v', 'h264_qsv',
            '-preset', 'fast', // fast, medium, slow
            '-b:v', '3000k',
            '-maxrate', '4000k',
            '-bufsize', '6000k',
            '-profile:v', 'main',
            '-level', '4.0',
          ]
        }
        return cachedCapabilities
      }

      // Sinon VAAPI (Intel Quick Sync via VAAPI)
      if (availableAccels.includes('vaapi')) {
        console.log(`[${new Date().toISOString()}] [HARDWARE] ✅ Intel Quick Sync (VAAPI) détecté`)
        
        cachedCapabilities = {
          acceleration: 'vaapi',
          encoder: 'h264_vaapi',
          platform: 'linux',
          decoderArgs: ['-hwaccel', 'vaapi', '-hwaccel_device', '/dev/dri/renderD128'],
          encoderArgs: [
            '-vf', 'format=nv12,hwupload', // Upload vers GPU
            '-c:v', 'h264_vaapi',
            '-b:v', '3000k',
            '-maxrate', '4000k',
            '-bufsize', '6000k',
            '-profile:v', 'main',
            '-level', '4.0',
          ]
        }
        return cachedCapabilities
      }
    }

    // ⚠️ FALLBACK : Pas d'accélération matérielle disponible
    console.warn(`[${new Date().toISOString()}] [HARDWARE] ⚠️ Aucune accélération matérielle détectée, utilisation CPU`)
    
    cachedCapabilities = {
      acceleration: 'none',
      encoder: 'libx264',
      platform,
      decoderArgs: [],
      encoderArgs: [
        '-c:v', 'libx264',
        '-preset', 'veryfast', // veryfast pour minimiser la charge CPU
        '-b:v', '3000k',
        '-maxrate', '4000k',
        '-bufsize', '6000k',
        '-profile:v', 'main',
        '-level', '4.0',
        '-threads', '4',
      ]
    }
    return cachedCapabilities

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [HARDWARE] ❌ Erreur détection matériel:`, error)
    
    // Fallback sécurisé sur CPU
    cachedCapabilities = {
      acceleration: 'none',
      encoder: 'libx264',
      platform: 'unknown',
      decoderArgs: [],
      encoderArgs: [
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-b:v', '3000k',
        '-maxrate', '4000k',
        '-bufsize', '6000k',
        '-profile:v', 'main',
        '-level', '4.0',
        '-threads', '4',
      ]
    }
    return cachedCapabilities
  }
}

/**
 * Réinitialise le cache de détection (utile pour les tests)
 */
export function resetHardwareCache(): void {
  cachedCapabilities = null
}

