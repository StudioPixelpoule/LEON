/**
 * Gestionnaire centralisé des processus FFmpeg
 * Gère le cycle de vie complet des processus de transcodage
 * 
 * IMPORTANT : Utilise globalThis pour survivre au Hot Module Replacement (HMR)
 * Sans ça, chaque recompilation crée un nouveau manager et perd les sessions actives.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { rm } from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

// Configuration
const MAX_CONCURRENT_PROCESSES = 2  // Limite de processus simultanés
const PROCESS_TIMEOUT = 30 * 60 * 1000  // 30 minutes max par processus
const CLEANUP_INTERVAL = 60 * 1000  // Nettoyage toutes les minutes
const HLS_TEMP_DIR = '/tmp/leon-hls'

// État global des sessions
interface FFmpegSession {
  pid?: number
  sessionId: string
  filepath: string
  audioTrack: string
  startTime: number
  lastAccess: number
  timeout?: NodeJS.Timeout
}

// Déclaration globale pour TypeScript
declare global {
  var __ffmpegManagerSingleton: FFmpegManager | undefined
}

class FFmpegManager {
  private sessions: Map<string, FFmpegSession> = new Map()
  private cleanupTimer?: NodeJS.Timeout
  private isCleaningUp: boolean = false

  constructor() {
    console.log('🔧 Initialisation FFmpegManager')
    
    // Démarrer le nettoyage périodique
    this.startPeriodicCleanup()
    
    // Nettoyer à la fermeture du processus
    if (typeof process !== 'undefined') {
      process.on('exit', () => this.cleanupAll())
      process.on('SIGINT', () => this.cleanupAll())
      process.on('SIGTERM', () => this.cleanupAll())
    }
  }

  /**
   * Génère un ID de session unique
   */
  generateSessionId(filepath: string, audioTrack: string = '0'): string {
    return `${filepath}_audio${audioTrack}`
  }

  /**
   * Enregistre une nouvelle session FFmpeg
   */
  registerSession(sessionId: string, filepath: string, audioTrack: string, pid?: number): void {
    console.log(`📝 Enregistrement session FFmpeg: ${sessionId} (PID: ${pid || 'pending'})`)
    
    // Si une session existe déjà, la nettoyer d'abord
    if (this.sessions.has(sessionId)) {
      this.killSession(sessionId)
    }

    const session: FFmpegSession = {
      pid,
      sessionId,
      filepath,
      audioTrack,
      startTime: Date.now(),
      lastAccess: Date.now(),
      // Timeout automatique après 30 minutes
      timeout: setTimeout(() => {
        console.log(`⏰ Timeout session FFmpeg: ${sessionId}`)
        this.killSession(sessionId)
      }, PROCESS_TIMEOUT)
    }

    this.sessions.set(sessionId, session)
    
    // Vérifier la limite de processus
    this.enforceProcessLimit()
  }

  /**
   * Met à jour l'heure du dernier accès
   */
  touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.lastAccess = Date.now()
    }
  }

  /**
   * Vérifie si une session est active
   */
  hasActiveSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  /**
   * Obtient le PID d'une session
   */
  getSessionPid(sessionId: string): number | undefined {
    return this.sessions.get(sessionId)?.pid
  }

  /**
   * Met à jour le PID d'une session
   */
  updateSessionPid(sessionId: string, pid: number): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.pid = pid
      console.log(`🔄 PID mis à jour pour session ${sessionId}: ${pid}`)
    }
  }

  /**
   * Tue un processus FFmpeg spécifique
   */
  async killSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    console.log(`🔪 Arrêt session FFmpeg: ${sessionId}`)

    // Annuler le timeout
    if (session.timeout) {
      clearTimeout(session.timeout)
    }

    // Tuer le processus si PID connu
    if (session.pid) {
      try {
        await execAsync(`kill -9 ${session.pid}`)
        console.log(`✅ Processus ${session.pid} tué`)
      } catch (error) {
        // Le processus est peut-être déjà mort
        console.log(`⚠️ Processus ${session.pid} introuvable`)
      }
    }

    // Nettoyer les fichiers de la session
    try {
      const crypto = require('crypto')
      const fileHash = crypto.createHash('md5').update(sessionId).digest('hex')
      const sessionDir = path.join(HLS_TEMP_DIR, fileHash)
      await rm(sessionDir, { recursive: true, force: true })
      console.log(`🗑️ Fichiers supprimés: ${sessionDir}`)
    } catch (error) {
      // Ignorer si le dossier n'existe pas
    }

    // Supprimer de la map
    this.sessions.delete(sessionId)
  }

  /**
   * Applique la limite de processus simultanés
   */
  private enforceProcessLimit(): void {
    if (this.sessions.size <= MAX_CONCURRENT_PROCESSES) return

    console.log(`⚠️ Limite de processus atteinte (${MAX_CONCURRENT_PROCESSES}), nettoyage...`)

    // Trier par dernier accès (plus ancien en premier)
    const sortedSessions = Array.from(this.sessions.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess)

    // Tuer les sessions les plus anciennes
    const toKill = sortedSessions.slice(0, this.sessions.size - MAX_CONCURRENT_PROCESSES)
    for (const [sessionId] of toKill) {
      this.killSession(sessionId)
    }
  }

  /**
   * Nettoie tous les processus FFmpeg
   */
  async cleanupAll(): Promise<void> {
    if (this.isCleaningUp) return
    this.isCleaningUp = true

    console.log('🧹 Nettoyage complet des processus FFmpeg...')

    try {
      // Tuer toutes les sessions enregistrées
      const promises = Array.from(this.sessions.keys()).map(sessionId => 
        this.killSession(sessionId)
      )
      await Promise.all(promises)

      // Tuer tous les processus FFmpeg restants (au cas où)
      try {
        await execAsync('pkill -9 ffmpeg')
        console.log('✅ Tous les processus FFmpeg tués')
      } catch {
        // Ignorer si aucun processus
      }

      // Vider complètement le cache
      try {
        await rm(HLS_TEMP_DIR, { recursive: true, force: true })
        console.log('✅ Cache HLS vidé')
      } catch {
        // Ignorer si le dossier n'existe pas
      }

      this.sessions.clear()
    } finally {
      this.isCleaningUp = false
    }
  }

  /**
   * Nettoie les processus orphelins et les sessions inactives
   */
  async cleanupOrphans(): Promise<void> {
    console.log('🔍 Recherche de processus orphelins...')

    try {
      // Obtenir la liste des processus FFmpeg actifs
      const { stdout } = await execAsync('pgrep -f "ffmpeg.*leon-hls"').catch(() => ({ stdout: '' }))
      const activePids = stdout.trim().split('\n').filter(Boolean).map(Number)

      // Vérifier les sessions enregistrées
      for (const [sessionId, session] of this.sessions.entries()) {
        // Session inactive depuis plus de 5 minutes
        if (Date.now() - session.lastAccess > 5 * 60 * 1000) {
          console.log(`🕰️ Session inactive: ${sessionId}`)
          await this.killSession(sessionId)
          continue
        }

        // Session avec PID qui n'existe plus
        if (session.pid && !activePids.includes(session.pid)) {
          console.log(`👻 Session orpheline: ${sessionId}`)
          await this.killSession(sessionId)
        }
      }

      // Tuer les processus FFmpeg non enregistrés (avec grace period de 15 secondes)
      for (const pid of activePids) {
        const isRegistered = Array.from(this.sessions.values()).some(s => s.pid === pid)
        if (!isRegistered) {
          // ⏰ Grace period : Ne pas tuer les processus trop récents (< 15s)
          // Ils sont peut-être en cours d'enregistrement
          try {
            const { stdout: psOutput } = await execAsync(`ps -p ${pid} -o etime=`).catch(() => ({ stdout: '' }))
            const elapsed = psOutput.trim()
            
            // Si le processus existe depuis moins de 15 secondes, l'ignorer
            if (elapsed && !elapsed.includes(':')) {
              // Format "SS" (secondes seulement) = processus récent
              const seconds = parseInt(elapsed)
              if (seconds < 15) {
                console.log(`⏳ Processus ${pid} récent (${seconds}s), ignoré`)
                continue
              }
            }
          } catch {}
          
          console.log(`🎯 Processus non enregistré: ${pid}`)
          try {
            await execAsync(`kill -9 ${pid}`)
          } catch {
            // Ignorer si échec
          }
        }
      }
    } catch (error) {
      console.error('Erreur nettoyage orphelins:', error)
    }
  }

  /**
   * Démarre le nettoyage périodique
   */
  private startPeriodicCleanup(): void {
    // ❌ NE PAS nettoyer immédiatement au démarrage (laisse le temps aux sessions de s'enregistrer)
    // Attendre le premier interval pour éviter de tuer les nouveaux processus
    
    // Nettoyer périodiquement
    this.cleanupTimer = setInterval(() => {
      this.cleanupOrphans()
    }, CLEANUP_INTERVAL)
  }

  /**
   * Arrête le nettoyage périodique
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }

  /**
   * Obtient les statistiques des sessions
   */
  getStats(): {
    activeSessions: number
    oldestSession: number | null
    totalProcesses: number
  } {
    const now = Date.now()
    const sessions = Array.from(this.sessions.values())
    
    return {
      activeSessions: sessions.length,
      oldestSession: sessions.length > 0 
        ? Math.min(...sessions.map(s => now - s.startTime))
        : null,
      totalProcesses: sessions.filter(s => s.pid).length
    }
  }

  /**
   * Vérifie la santé du gestionnaire
   */
  async healthCheck(): Promise<{
    healthy: boolean
    activeSessions: number
    zombieProcesses: number
    diskUsage: string
  }> {
    try {
      // Compter les processus zombies
      const { stdout: psOutput } = await execAsync('ps aux | grep -i ffmpeg | grep -v grep').catch(() => ({ stdout: '' }))
      const runningProcesses = psOutput.trim().split('\n').filter(Boolean).length

      // Vérifier l'espace disque utilisé
      const { stdout: duOutput } = await execAsync(`du -sh ${HLS_TEMP_DIR} 2>/dev/null`).catch(() => ({ stdout: '0\t' }))
      const diskUsage = duOutput.split('\t')[0]

      const stats = this.getStats()
      const zombieProcesses = Math.max(0, runningProcesses - stats.totalProcesses)

      return {
        healthy: zombieProcesses === 0 && stats.activeSessions <= MAX_CONCURRENT_PROCESSES,
        activeSessions: stats.activeSessions,
        zombieProcesses,
        diskUsage
      }
    } catch (error) {
      console.error('Erreur health check:', error)
      return {
        healthy: false,
        activeSessions: this.sessions.size,
        zombieProcesses: -1,
        diskUsage: 'unknown'
      }
    }
  }
}

// Singleton
// 🌍 Singleton global qui survit au HMR
// Si le manager existe déjà (HMR), on le réutilise au lieu d'en créer un nouveau
if (!global.__ffmpegManagerSingleton) {
  console.log('🆕 Création du singleton FFmpegManager')
  global.__ffmpegManagerSingleton = new FFmpegManager()
} else {
  console.log('♻️ Réutilisation du singleton FFmpegManager existant')
}

const ffmpegManager = global.__ffmpegManagerSingleton

export default ffmpegManager
export { FFmpegManager, type FFmpegSession }
