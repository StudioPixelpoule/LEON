/**
 * API Route: Gestion du transcodage
 * 
 * GET /api/transcode - Obtenir les statistiques et la queue
 * POST /api/transcode - Actions: start, pause, resume, stop, scan
 * DELETE /api/transcode?jobId=xxx - Annuler un job
 */

import { NextRequest, NextResponse } from 'next/server'
import transcodingService from '@/lib/transcoding-service'
import fileWatcher from '@/lib/file-watcher'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const stats = await transcodingService.getStats()
    const queue = transcodingService.getQueue()
    const completed = transcodingService.getCompletedJobs()
    const watcherStats = fileWatcher.getStats()

    return NextResponse.json({
      stats,
      queue: queue.slice(0, 50), // Limiter à 50 pour la performance
      completed: completed.slice(-20), // 20 derniers terminés
      watcher: watcherStats
    })
  } catch (error) {
    console.error('❌ Erreur GET /api/transcode:', error)
    return NextResponse.json(
      { error: 'Erreur récupération statistiques' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, filepath, priority } = body

    switch (action) {
      case 'start':
        await transcodingService.start()
        return NextResponse.json({ success: true, message: 'Transcodage démarré' })

      case 'pause':
        transcodingService.pause()
        return NextResponse.json({ success: true, message: 'Transcodage en pause' })

      case 'resume':
        await transcodingService.resume()
        return NextResponse.json({ success: true, message: 'Transcodage repris' })

      case 'stop':
        transcodingService.stop()
        return NextResponse.json({ success: true, message: 'Transcodage arrêté' })

      case 'scan':
        const priorityMode = priority || 'alphabetical'
        const count = await transcodingService.scanAndQueue(priorityMode)
        return NextResponse.json({ 
          success: true, 
          message: `${count} films ajoutés à la queue`,
          count 
        })

      case 'add':
        if (!filepath) {
          return NextResponse.json(
            { error: 'filepath requis' },
            { status: 400 }
          )
        }
        const job = transcodingService.addToQueue(filepath, priority === 'high')
        return NextResponse.json({ 
          success: true, 
          message: 'Film ajouté à la queue',
          job 
        })

      case 'start-watcher':
        await fileWatcher.start()
        return NextResponse.json({ success: true, message: 'Watcher démarré' })

      case 'stop-watcher':
        fileWatcher.stop()
        return NextResponse.json({ success: true, message: 'Watcher arrêté' })

      default:
        return NextResponse.json(
          { error: `Action inconnue: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('❌ Erreur POST /api/transcode:', error)
    return NextResponse.json(
      { error: 'Erreur action transcodage' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const jobId = searchParams.get('jobId')
    const filepath = searchParams.get('filepath')

    if (jobId) {
      const success = transcodingService.cancelJob(jobId)
      return NextResponse.json({ 
        success, 
        message: success ? 'Job annulé' : 'Job non trouvé' 
      })
    }

    if (filepath) {
      const success = await transcodingService.cleanupTranscoded(filepath)
      return NextResponse.json({ 
        success, 
        message: success ? 'Fichiers nettoyés' : 'Erreur nettoyage' 
      })
    }

    return NextResponse.json(
      { error: 'jobId ou filepath requis' },
      { status: 400 }
    )
  } catch (error) {
    console.error('❌ Erreur DELETE /api/transcode:', error)
    return NextResponse.json(
      { error: 'Erreur annulation' },
      { status: 500 }
    )
  }
}

