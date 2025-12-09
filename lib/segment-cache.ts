/**
 * Système de cache intelligent pour les segments HLS transcodés
 * Réutilise les segments déjà transcodés pour économiser CPU et temps
 */

import { access, mkdir, readdir, stat, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'

const CACHE_DIR = '/tmp/leon-segment-cache'
const MAX_CACHE_SIZE_GB = 10 // Maximum 10GB de cache
const MAX_CACHE_AGE_DAYS = 7 // Garder les segments 7 jours maximum

export interface CacheKey {
  filepath: string
  audioTrack: string
  segmentIndex: number
  videoCodec?: string
  resolution?: string
}

export interface CacheStats {
  totalSize: number // Taille totale en bytes
  totalFiles: number // Nombre de fichiers
  oldestFile: Date | null // Date du fichier le plus ancien
  newestFile: Date | null // Date du fichier le plus récent
}

export class SegmentCache {
  private cacheDir: string

  constructor(cacheDir: string = CACHE_DIR) {
    this.cacheDir = cacheDir
  }

  /**
   * Génère une clé de cache unique pour un segment
   */
  private generateCacheKey(key: CacheKey): string {
    const data = `${key.filepath}|${key.audioTrack}|${key.segmentIndex}|${key.videoCodec || 'default'}|${key.resolution || '1080p'}`
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * Construit le chemin du fichier de cache
   */
  private getCachePath(key: CacheKey): string {
    const hash = this.generateCacheKey(key)
    // Organiser par sous-dossiers pour éviter trop de fichiers dans un seul dossier
    const subdir = hash.substring(0, 2)
    return path.join(this.cacheDir, subdir, `${hash}.ts`)
  }

  /**
   * Vérifie si un segment est en cache
   */
  async has(key: CacheKey): Promise<boolean> {
    const cachePath = this.getCachePath(key)
    try {
      await access(cachePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Récupère le chemin d'un segment en cache
   */
  async get(key: CacheKey): Promise<string | null> {
    const cachePath = this.getCachePath(key)
    
    if (await this.has(key)) {
      console.log(`[${new Date().toISOString()}] [CACHE] ✅ HIT segment${key.segmentIndex}`)
      
      // Mettre à jour l'access time pour le LRU
      try {
        const now = new Date()
        await import('fs/promises').then(fs => fs.utimes(cachePath, now, now))
      } catch {
        // Ignorer les erreurs de touch
      }
      
      return cachePath
    }
    
    console.log(`[${new Date().toISOString()}] [CACHE] ❌ MISS segment${key.segmentIndex}`)
    return null
  }

  /**
   * Ajoute un segment au cache (copie le fichier)
   */
  async set(key: CacheKey, sourcePath: string): Promise<void> {
    const cachePath = this.getCachePath(key)
    const cacheSubdir = path.dirname(cachePath)

    try {
      // Créer le sous-dossier si nécessaire
      if (!existsSync(cacheSubdir)) {
        await mkdir(cacheSubdir, { recursive: true })
      }

      // Copier le fichier
      const { copyFile } = await import('fs/promises')
      await copyFile(sourcePath, cachePath)
      
      console.log(`[${new Date().toISOString()}] [CACHE] 💾 Sauvegarde segment${key.segmentIndex}`)
      
      // Vérifier la taille du cache et nettoyer si nécessaire
      await this.enforceMaxSize()
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] [CACHE] ❌ Erreur sauvegarde:`, error.message)
    }
  }

  /**
   * Initialise le cache (crée les dossiers)
   */
  async init(): Promise<void> {
    if (!existsSync(this.cacheDir)) {
      await mkdir(this.cacheDir, { recursive: true })
      console.log(`[${new Date().toISOString()}] [CACHE] 🗂️ Dossier créé: ${this.cacheDir}`)
    }
  }

  /**
   * Calcule les statistiques du cache
   */
  async getStats(): Promise<CacheStats> {
    const stats: CacheStats = {
      totalSize: 0,
      totalFiles: 0,
      oldestFile: null,
      newestFile: null
    }

    if (!existsSync(this.cacheDir)) {
      return stats
    }

    try {
      const files = await this.getAllCacheFiles()
      
      for (const file of files) {
        const fileStat = await stat(file)
        stats.totalSize += fileStat.size
        stats.totalFiles++

        if (!stats.oldestFile || fileStat.mtime < stats.oldestFile) {
          stats.oldestFile = fileStat.mtime
        }
        if (!stats.newestFile || fileStat.mtime > stats.newestFile) {
          stats.newestFile = fileStat.mtime
        }
      }
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] [CACHE] ❌ Erreur stats:`, error.message)
    }

    return stats
  }

  /**
   * Récupère tous les fichiers du cache (récursivement)
   */
  private async getAllCacheFiles(): Promise<string[]> {
    const files: string[] = []

    if (!existsSync(this.cacheDir)) {
      return files
    }

    const entries = await readdir(this.cacheDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(this.cacheDir, entry.name)
      
      if (entry.isDirectory()) {
        // Récursif dans les sous-dossiers
        const subFiles = await readdir(fullPath)
        for (const subFile of subFiles) {
          files.push(path.join(fullPath, subFile))
        }
      } else if (entry.name.endsWith('.ts')) {
        files.push(fullPath)
      }
    }

    return files
  }

  /**
   * Applique la limite de taille du cache (supprime les plus anciens)
   */
  async enforceMaxSize(): Promise<void> {
    const stats = await this.getStats()
    const maxSizeBytes = MAX_CACHE_SIZE_GB * 1024 * 1024 * 1024

    if (stats.totalSize <= maxSizeBytes) {
      return // Pas besoin de nettoyer
    }

    console.log(`[${new Date().toISOString()}] [CACHE] ⚠️ Taille dépassée (${(stats.totalSize / 1024 / 1024 / 1024).toFixed(2)}GB > ${MAX_CACHE_SIZE_GB}GB)`)

    // Récupérer tous les fichiers avec leur date
    const files = await this.getAllCacheFiles()
    const filesWithStats = await Promise.all(
      files.map(async (file) => ({
        path: file,
        stat: await stat(file)
      }))
    )

    // Trier par date d'accès (LRU - Least Recently Used)
    filesWithStats.sort((a, b) => a.stat.atime.getTime() - b.stat.atime.getTime())

    // Supprimer les plus anciens jusqu'à revenir sous la limite
    let currentSize = stats.totalSize
    let deleted = 0

    for (const file of filesWithStats) {
      if (currentSize <= maxSizeBytes) {
        break
      }

      try {
        await rm(file.path)
        currentSize -= file.stat.size
        deleted++
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] [CACHE] ❌ Erreur suppression:`, error.message)
      }
    }

    console.log(`[${new Date().toISOString()}] [CACHE] 🧹 ${deleted} segments supprimés (LRU)`)
  }

  /**
   * Nettoie les segments trop anciens
   */
  async cleanOldSegments(): Promise<void> {
    const files = await this.getAllCacheFiles()
    const now = Date.now()
    const maxAge = MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000
    let deleted = 0

    for (const file of files) {
      try {
        const fileStat = await stat(file)
        const age = now - fileStat.mtime.getTime()

        if (age > maxAge) {
          await rm(file)
          deleted++
        }
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] [CACHE] ❌ Erreur nettoyage:`, error.message)
      }
    }

    if (deleted > 0) {
      console.log(`[${new Date().toISOString()}] [CACHE] 🧹 ${deleted} segments anciens supprimés (> ${MAX_CACHE_AGE_DAYS} jours)`)
    }
  }

  /**
   * Vide complètement le cache
   */
  async clear(): Promise<void> {
    try {
      if (existsSync(this.cacheDir)) {
        await rm(this.cacheDir, { recursive: true, force: true })
        console.log(`[${new Date().toISOString()}] [CACHE] 🗑️ Cache vidé complètement`)
      }
      await this.init()
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] [CACHE] ❌ Erreur vidage:`, error.message)
    }
  }
}

// Instance singleton
let cacheInstance: SegmentCache | null = null

/**
 * Récupère l'instance singleton du cache
 */
export function getCacheInstance(): SegmentCache {
  if (!cacheInstance) {
    cacheInstance = new SegmentCache()
    cacheInstance.init().catch(err => {
      console.error(`[${new Date().toISOString()}] [CACHE] ❌ Erreur init:`, err.message)
    })
  }
  return cacheInstance
}

/**
 * Démarre le nettoyage automatique périodique
 */
export function startAutoCleaner(): void {
  const cache = getCacheInstance()
  
  // Nettoyer les vieux segments toutes les 6 heures
  setInterval(() => {
    cache.cleanOldSegments().catch(err => {
      console.error(`[${new Date().toISOString()}] [CACHE] ❌ Erreur auto-cleanup:`, err.message)
    })
  }, 6 * 60 * 60 * 1000)

  console.log(`[${new Date().toISOString()}] [CACHE] ⏰ Auto-cleanup activé (toutes les 6h)`)
}


















