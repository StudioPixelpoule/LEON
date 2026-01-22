/**
 * Détection automatique du matériel disponible pour accélération GPU
 * Supporte : VideoToolbox (macOS), VAAPI/QSV (Intel Quick Sync Linux), fallback CPU
 * 
 * Optimisé pour Synology NAS avec Intel Quick Sync
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
  // 🔧 Nouvelles propriétés pour optimisation
  supportsHEVC: boolean
  maxConcurrentTranscodes: number
  recommendedPreset: string
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
          '-b:v', '4000k', // 🔧 Augmenté pour meilleure qualité
          '-maxrate', '5000k',
          '-bufsize', '8000k',
          '-profile:v', 'main',
          '-level', '4.1',
          '-allow_sw', '1', // Fallback CPU si GPU échoue
        ],
        supportsHEVC: true,
        maxConcurrentTranscodes: 3,
        recommendedPreset: 'default',
      }
      return cachedCapabilities
    }

    // 🐧 LINUX : Intel Quick Sync (VAAPI prioritaire, plus compatible Docker)
    if (platform === 'linux') {
      // Vérifier si /dev/dri/renderD128 existe (GPU accessible)
      const { existsSync } = await import('fs')
      const hasGpuDevice = existsSync('/dev/dri/renderD128')
      
      if (!hasGpuDevice) {
        console.warn(`[${new Date().toISOString()}] [HARDWARE] ⚠️ /dev/dri/renderD128 non accessible, fallback CPU`)
      }
      
      // VAAPI est plus compatible avec Docker que QSV
      if (hasGpuDevice && availableAccels.includes('vaapi')) {
        // Tester si VAAPI fonctionne réellement
        try {
          await execAsync('ffmpeg -hide_banner -init_hw_device vaapi=va:/dev/dri/renderD128 -f lavfi -i nullsrc=s=1920x1080:d=1 -vf "format=nv12,hwupload" -c:v h264_vaapi -f null - 2>&1', { timeout: 10000 })
          console.log(`[${new Date().toISOString()}] [HARDWARE] ✅ Intel Quick Sync (VAAPI) testé et fonctionnel`)
          
          cachedCapabilities = {
            acceleration: 'vaapi',
            encoder: 'h264_vaapi',
            platform: 'linux',
            decoderArgs: ['-hwaccel', 'vaapi', '-hwaccel_device', '/dev/dri/renderD128', '-hwaccel_output_format', 'vaapi'],
            encoderArgs: [
              // 🔧 PAS de -vf ici - géré dynamiquement selon le codec source (H.264 vs HEVC)
              '-c:v', 'h264_vaapi',
              '-global_quality', '23', // CRF-like pour VAAPI (18-28, plus bas = meilleure qualité)
              '-maxrate', '8000k',
              '-bufsize', '16000k',
              '-profile:v', 'main',
              '-level', '4.1',
            ],
            supportsHEVC: true,
            maxConcurrentTranscodes: 3, // 🔧 3 transcodes avec 16 Go RAM + Quick Sync
            recommendedPreset: 'fast',
          }
          return cachedCapabilities
        } catch (vaapiError) {
          console.warn(`[${new Date().toISOString()}] [HARDWARE] ⚠️ VAAPI test échoué:`, (vaapiError as Error).message?.slice(0, 100))
        }
      }

      // QSV en fallback si VAAPI échoue
      if (hasGpuDevice && availableAccels.includes('qsv')) {
        try {
          await execAsync('ffmpeg -hide_banner -init_hw_device qsv=qsv:hw -f lavfi -i nullsrc=s=1920x1080:d=1 -c:v h264_qsv -f null - 2>&1', { timeout: 10000 })
          console.log(`[${new Date().toISOString()}] [HARDWARE] ✅ Intel Quick Sync (QSV) testé et fonctionnel`)
          
          cachedCapabilities = {
            acceleration: 'qsv',
            encoder: 'h264_qsv',
            platform: 'linux',
            decoderArgs: ['-hwaccel', 'qsv', '-hwaccel_device', '/dev/dri/renderD128'],
            encoderArgs: [
              '-c:v', 'h264_qsv',
              '-preset', 'fast',
              '-b:v', '4000k', // 🔧 Augmenté pour meilleure qualité
              '-maxrate', '5000k',
              '-bufsize', '8000k',
              '-profile:v', 'main',
              '-level', '4.1',
              '-look_ahead', '0', // 🔧 Désactiver lookahead pour réduire la latence
            ],
            supportsHEVC: true,
            maxConcurrentTranscodes: 2,
            recommendedPreset: 'fast',
          }
          return cachedCapabilities
        } catch (qsvError) {
          console.warn(`[${new Date().toISOString()}] [HARDWARE] ⚠️ QSV test échoué:`, (qsvError as Error).message?.slice(0, 100))
        }
      }
    }

    // ⚠️ FALLBACK : Pas d'accélération matérielle disponible
    console.warn(`[${new Date().toISOString()}] [HARDWARE] ⚠️ Aucune accélération matérielle détectée, utilisation CPU`)
    
    // Détecter le nombre de cores CPU disponibles
    const cpuCount = require('os').cpus().length
    const threads = Math.max(2, Math.min(cpuCount - 1, 6)) // 2-6 threads
    
    cachedCapabilities = {
      acceleration: 'none',
      encoder: 'libx264',
      platform,
      decoderArgs: [],
      encoderArgs: [
        '-c:v', 'libx264',
        '-preset', 'superfast', // 🔧 superfast au lieu de veryfast pour démarrage plus rapide
        '-tune', 'zerolatency', // 🔧 Optimisé pour streaming temps réel
        '-b:v', '3000k',
        '-maxrate', '4000k',
        '-bufsize', '6000k',
        '-profile:v', 'main',
        '-level', '4.1',
        '-threads', String(threads),
        '-x264-params', 'rc-lookahead=0:sync-lookahead=0', // 🔧 Réduire la latence
      ],
      supportsHEVC: false,
      maxConcurrentTranscodes: 1, // CPU = 1 seul transcode à la fois
      recommendedPreset: 'superfast',
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
        '-preset', 'superfast',
        '-tune', 'zerolatency',
        '-b:v', '3000k',
        '-maxrate', '4000k',
        '-bufsize', '6000k',
        '-profile:v', 'main',
        '-level', '4.1',
        '-threads', '4',
      ],
      supportsHEVC: false,
      maxConcurrentTranscodes: 1,
      recommendedPreset: 'superfast',
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


