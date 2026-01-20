/**
 * API: Gestion de la queue de transcodage
 * 
 * GET  /api/admin/transcode-queue - Liste la queue
 * POST /api/admin/transcode-queue - Actions sur la queue
 *   - action: 'move-up' | 'move-down' | 'move-to-top' | 'remove' | 'reorder'
 *   - jobId: string (pour move-up, move-down, move-to-top, remove)
 *   - jobIds: string[] (pour reorder, remove multiple)
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const transcodingServiceModule = await import('@/lib/transcoding-service')
    const transcodingService = transcodingServiceModule.default
    
    const queue = transcodingService.getQueue()
    const stats = await transcodingService.getStats()
    
    return NextResponse.json({
      success: true,
      queue: queue.map(job => ({
        id: job.id,
        filename: job.filename,
        filepath: job.filepath,
        status: job.status,
        progress: job.progress,
        priority: job.priority,
        fileSize: job.fileSize,
        mtime: job.mtime,
        startedAt: job.startedAt,
        error: job.error
      })),
      currentJob: stats.currentJob ? {
        id: stats.currentJob.id,
        filename: stats.currentJob.filename,
        progress: stats.currentJob.progress,
        speed: stats.currentJob.speed,
        startedAt: stats.currentJob.startedAt
      } : null,
      stats: {
        totalPending: queue.length,
        isRunning: stats.isRunning,
        isPaused: stats.isPaused,
        estimatedTimeRemaining: stats.estimatedTimeRemaining
      }
    })
  } catch (error) {
    console.error('Erreur lecture queue:', error)
    return NextResponse.json(
      { error: 'Erreur lecture queue' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, jobId, jobIds } = body
    
    const transcodingServiceModule = await import('@/lib/transcoding-service')
    const transcodingService = transcodingServiceModule.default
    
    let success = false
    let message = ''
    
    switch (action) {
      case 'move-up':
        if (!jobId) {
          return NextResponse.json({ error: 'jobId requis' }, { status: 400 })
        }
        success = await transcodingService.moveJobUp(jobId)
        message = success ? 'Job déplacé vers le haut' : 'Impossible de déplacer le job'
        break
        
      case 'move-down':
        if (!jobId) {
          return NextResponse.json({ error: 'jobId requis' }, { status: 400 })
        }
        success = await transcodingService.moveJobDown(jobId)
        message = success ? 'Job déplacé vers le bas' : 'Impossible de déplacer le job'
        break
        
      case 'move-to-top':
        if (!jobId) {
          return NextResponse.json({ error: 'jobId requis' }, { status: 400 })
        }
        success = await transcodingService.moveJobToTop(jobId)
        message = success ? 'Job placé en tête de queue' : 'Impossible de déplacer le job'
        break
        
      case 'remove':
        if (jobId) {
          success = await transcodingService.cancelJob(jobId)
          message = success ? 'Job supprimé' : 'Job non trouvé'
        } else if (jobIds && Array.isArray(jobIds)) {
          const removed = await transcodingService.removeJobs(jobIds)
          success = removed > 0
          message = `${removed} job(s) supprimé(s)`
        } else {
          return NextResponse.json({ error: 'jobId ou jobIds requis' }, { status: 400 })
        }
        break
        
      case 'reorder':
        if (!jobIds || !Array.isArray(jobIds)) {
          return NextResponse.json({ error: 'jobIds requis (array)' }, { status: 400 })
        }
        success = await transcodingService.reorderQueue(jobIds)
        message = success ? 'Queue réordonnée' : 'Erreur lors du réordonnement'
        break
        
      case 'start':
        await transcodingService.start()
        success = true
        message = 'Transcodage démarré'
        break
        
      case 'pause':
        await transcodingService.pause()
        success = true
        message = 'Transcodage en pause'
        break
        
      case 'resume':
        await transcodingService.resume()
        success = true
        message = 'Transcodage repris'
        break
        
      case 'stop':
        await transcodingService.stop()
        success = true
        message = 'Transcodage arrêté'
        break
        
      case 'remove-duplicates':
        const removedCount = await transcodingService.removeDuplicates()
        success = true
        message = `${removedCount} doublon(s) supprimé(s)`
        break
        
      default:
        return NextResponse.json(
          { error: `Action inconnue: ${action}` },
          { status: 400 }
        )
    }
    
    // Retourner la queue mise à jour
    const queue = transcodingService.getQueue()
    const stats = await transcodingService.getStats()
    
    return NextResponse.json({
      success,
      message,
      queue: queue.map(job => ({
        id: job.id,
        filename: job.filename,
        status: job.status,
        progress: job.progress
      })),
      stats: {
        totalPending: queue.length,
        isRunning: stats.isRunning,
        isPaused: stats.isPaused
      }
    })
    
  } catch (error) {
    console.error('Erreur action queue:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'action' },
      { status: 500 }
    )
  }
}
