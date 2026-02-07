'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  RefreshCw, 
  BarChart3, 
  Film, 
  Search, 
  Play, 
  Pause, 
  Square, 
  Eye,
  Clock,
  Check,
  HardDrive,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  X,
  Trash2
} from 'lucide-react'
import { useAdminToast } from '@/components/admin/Toast/Toast'
import type { ToastType } from '@/types/admin'
import styles from '@/app/admin/admin.module.css'

interface TranscodeStats {
  totalFiles: number
  completedFiles: number
  pendingFiles: number
  failedFiles: number
  currentJob?: {
    id: string
    filename: string
    progress: number
    speed?: number
    currentTime?: number
    estimatedDuration?: number
    mtime?: string
  }
  activeJobs?: Array<{
    id: string
    filename: string
    progress: number
    speed?: number
    currentTime?: number
    estimatedDuration?: number
  }>
  activeCount?: number
  maxConcurrent?: number
  isRunning: boolean
  isPaused: boolean
  estimatedTimeRemaining?: number
  autoStartEnabled?: boolean
  watcherActive?: boolean
  diskUsage?: string
}

interface TranscodeJob {
  id: string
  filename: string
  status: 'pending' | 'transcoding' | 'completed' | 'failed' | 'cancelled'
  progress: number
  error?: string
  mtime?: string
  priority?: number
  fileSize?: number
  filepath?: string
}

interface TranscodedFile {
  name: string
  folder: string
  transcodedAt: string
  segmentCount: number
  audioCount?: number
  subtitleCount?: number
}

export function TranscodeView() {
  const { addToast } = useAdminToast()
  const [stats, setStats] = useState<TranscodeStats | null>(null)
  const [queue, setQueue] = useState<TranscodeJob[]>([])
  const [transcoded, setTranscoded] = useState<TranscodedFile[]>([])
  const [watcher, setWatcher] = useState<{ isWatching: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showTranscoded, setShowTranscoded] = useState(false)
  
  // État pour bloquer le polling pendant les modifications
  const [isModifying, setIsModifying] = useState(false)
  const isLoadingRef = useRef(false)
  const modifyTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Drag and drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  
  // Modal déplacement vers position
  const [moveModal, setMoveModal] = useState<{ jobId: string; filename: string; currentIndex: number } | null>(null)
  const [targetPosition, setTargetPosition] = useState('')
  const queueListRef = useRef<HTMLDivElement>(null)

  // Polling avec blocage pendant modifications
  useEffect(() => {
    loadStats(true)
    const getInterval = () => stats?.isRunning && !stats?.isPaused ? 4000 : 10000
    const interval = setInterval(() => {
      if (!isModifying) loadStats(true)
    }, getInterval())
    return () => clearInterval(interval)
  }, [stats?.isRunning, stats?.isPaused, isModifying])

  const loadStats = useCallback(async (quick: boolean = true) => {
    if (isLoadingRef.current || isModifying) return
    isLoadingRef.current = true
    
    try {
      const response = await fetch(`/api/transcode${quick ? '?quick=true' : ''}`)
      const data = await response.json()
      setStats(data.stats)
      setQueue(data.queue || [])
      setWatcher(data.watcher || null)
      if (data.transcoded) setTranscoded(data.transcoded)
    } catch (error) {
      console.error('Erreur chargement stats:', error)
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [isModifying])

  async function performAction(action: string) {
    setActionLoading(action)
    try {
      await fetch('/api/transcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        credentials: 'include'
      })
      
      const messages: Record<string, { title: string; type: ToastType }> = {
        'start': { title: 'Transcodage démarré', type: 'success' },
        'pause': { title: 'Transcodage en pause', type: 'info' },
        'resume': { title: 'Transcodage repris', type: 'success' },
        'stop': { title: 'Transcodage arrêté', type: 'warning' },
        'scan': { title: 'Scan terminé', type: 'success' },
        'start-watcher': { title: 'Watcher activé', type: 'success' },
        'stop-watcher': { title: 'Watcher désactivé', type: 'info' }
      }
      
      const msg = messages[action]
      if (msg) addToast(msg.type, msg.title)
      
      await loadStats(true)
    } catch (error) {
      console.error(`Erreur action ${action}:`, error)
      addToast('error', 'Erreur', `Action "${action}" échouée`)
    } finally {
      setActionLoading(null)
    }
  }

  async function deleteTranscoded(folder: string, name: string) {
    if (!confirm(`Supprimer "${name}" ?`)) return
    try {
      await fetch(`/api/transcode?folder=${encodeURIComponent(folder)}`, { method: 'DELETE', credentials: 'include' })
      addToast('success', 'Supprimé', name)
      await loadStats(false)
    } catch (error) {
      console.error('Erreur suppression:', error)
      addToast('error', 'Erreur suppression')
    }
  }

  // Gestion optimiste de la queue
  async function moveJobToTop(jobId: string) {
    // Bloquer le polling
    setIsModifying(true)
    if (modifyTimeoutRef.current) clearTimeout(modifyTimeoutRef.current)
    
    // Mise à jour optimiste immédiate
    const jobIndex = queue.findIndex(j => j.id === jobId)
    if (jobIndex > 0) {
      const newQueue = [...queue]
      const [job] = newQueue.splice(jobIndex, 1)
      newQueue.unshift(job)
      setQueue(newQueue)
    }
    
    try {
      await fetch('/api/admin/transcode-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move-to-top', jobId }),
        credentials: 'include'
      })
      addToast('success', 'Placé en priorité')
    } catch (error) {
      console.error('Erreur move-to-top:', error)
      addToast('error', 'Erreur', 'Déplacement échoué')
      await loadStats(true) // Resync en cas d'erreur
    }
    
    // Débloquer le polling après 2s
    modifyTimeoutRef.current = setTimeout(() => {
      setIsModifying(false)
      loadStats(true)
    }, 2000)
  }
  
  async function removeFromQueue(jobId: string, filename: string) {
    if (!confirm(`Retirer "${filename}" de la file ?`)) return
    
    // Bloquer le polling
    setIsModifying(true)
    if (modifyTimeoutRef.current) clearTimeout(modifyTimeoutRef.current)
    
    // Mise à jour optimiste immédiate
    setQueue(prev => prev.filter(j => j.id !== jobId))
    
    try {
      await fetch('/api/admin/transcode-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', jobId }),
        credentials: 'include'
      })
      addToast('info', 'Retiré de la file')
    } catch (error) {
      console.error('Erreur remove:', error)
      addToast('error', 'Erreur', 'Suppression échouée')
      await loadStats(true) // Resync en cas d'erreur
    }
    
    // Débloquer le polling après 2s
    modifyTimeoutRef.current = setTimeout(() => {
      setIsModifying(false)
      loadStats(true)
    }, 2000)
  }

  // Nettoyage des doublons
  async function cleanupDuplicates() {
    setIsModifying(true)
    try {
      const response = await fetch('/api/admin/transcode-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-duplicates' }),
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success) {
        addToast('success', 'Nettoyage terminé', data.message)
        await loadStats(true)
      } else {
        addToast('error', 'Erreur', 'Nettoyage échoué')
      }
    } catch (error) {
      console.error('Erreur nettoyage:', error)
      addToast('error', 'Erreur', 'Nettoyage échoué')
    } finally {
      setIsModifying(false)
    }
  }

  // Déplacer un job à une position spécifique
  async function moveJobToPosition(jobId: string, newPosition: number) {
    const currentIndex = queue.findIndex(j => j.id === jobId)
    if (currentIndex === -1) return
    
    // Valider la position (1-indexed pour l'utilisateur)
    const targetIndex = Math.max(0, Math.min(newPosition - 1, queue.length - 1))
    if (targetIndex === currentIndex) return
    
    setIsModifying(true)
    if (modifyTimeoutRef.current) clearTimeout(modifyTimeoutRef.current)
    
    // Mise à jour optimiste
    const newQueue = [...queue]
    const [job] = newQueue.splice(currentIndex, 1)
    newQueue.splice(targetIndex, 0, job)
    setQueue(newQueue)
    
    // Envoyer au serveur
    const newOrder = newQueue.map(j => j.id)
    try {
      await fetch('/api/admin/transcode-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', jobIds: newOrder }),
        credentials: 'include'
      })
      addToast('success', 'Position modifiée', `Déplacé en position ${targetIndex + 1}`)
    } catch (error) {
      console.error('Erreur déplacement:', error)
      addToast('error', 'Erreur', 'Déplacement échoué')
      await loadStats(true)
    }
    
    setMoveModal(null)
    setTargetPosition('')
    
    modifyTimeoutRef.current = setTimeout(() => {
      setIsModifying(false)
      loadStats(true)
    }, 2000)
  }
  
  // Monter/descendre d'une position
  async function moveJobBy(jobId: string, delta: number) {
    const currentIndex = queue.findIndex(j => j.id === jobId)
    if (currentIndex === -1) return
    const newPosition = currentIndex + 1 + delta // 1-indexed
    if (newPosition < 1 || newPosition > queue.length) return
    await moveJobToPosition(jobId, newPosition)
  }

  // Drag and Drop handlers avec auto-scroll
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
    const target = e.target as HTMLElement
    target.style.opacity = '0.5'
  }

  function handleDragEnd(e: React.DragEvent) {
    const target = e.target as HTMLElement
    target.style.opacity = '1'
    setDraggedIndex(null)
    setDragOverIndex(null)
    // Arrêter l'auto-scroll
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current)
      scrollIntervalRef.current = null
    }
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIndex !== index) {
      setDragOverIndex(index)
    }
    
    // Auto-scroll vers le haut ou le bas
    const container = queueListRef.current
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const scrollZone = 60 // pixels depuis le bord pour déclencher le scroll
    const scrollSpeed = 8
    
    // Arrêter le scroll précédent
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current)
      scrollIntervalRef.current = null
    }
    
    if (e.clientY < rect.top + scrollZone && container.scrollTop > 0) {
      // Scroll vers le haut
      scrollIntervalRef.current = setInterval(() => {
        container.scrollTop -= scrollSpeed
      }, 16)
    } else if (e.clientY > rect.bottom - scrollZone && container.scrollTop < container.scrollHeight - container.clientHeight) {
      // Scroll vers le bas
      scrollIntervalRef.current = setInterval(() => {
        container.scrollTop += scrollSpeed
      }, 16)
    }
  }

  function handleDragLeave() {
    setDragOverIndex(null)
  }

  async function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    // Bloquer le polling
    setIsModifying(true)
    if (modifyTimeoutRef.current) clearTimeout(modifyTimeoutRef.current)

    // Mise à jour optimiste immédiate
    const newQueue = [...queue]
    const [draggedItem] = newQueue.splice(draggedIndex, 1)
    newQueue.splice(dropIndex, 0, draggedItem)
    setQueue(newQueue)

    // Envoyer le nouvel ordre au serveur
    const newOrder = newQueue.map(j => j.id)
    try {
      await fetch('/api/admin/transcode-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', jobIds: newOrder }),
        credentials: 'include'
      })
      addToast('success', 'Ordre modifié')
    } catch (error) {
      console.error('Erreur reorder:', error)
      addToast('error', 'Erreur', 'Réorganisation échouée')
      await loadStats(true) // Resync en cas d'erreur
    }

    setDraggedIndex(null)
    setDragOverIndex(null)

    // Débloquer le polling après 2s
    modifyTimeoutRef.current = setTimeout(() => {
      setIsModifying(false)
      loadStats(true)
    }, 2000)
  }

  function formatTime(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return '--:--'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return h > 0 ? `${h}h ${m}min` : `${m}min`
  }

  function formatDate(iso: string | undefined): string {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className={styles.section}>
        <div className={styles.loading}>
          <RefreshCw size={32} className={styles.spin} />
          <p className={styles.loadingText}>Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.sectionTitle}>Pré-transcodage</h1>
          <p className={styles.sectionDesc}>
            Transcoder les films à l&apos;avance pour un seek instantané
          </p>
        </div>
      </div>

      {/* Status */}
      <div className={styles.systemStatus}>
        <div className={styles.statusItem}>
          <span className={`${styles.statusDot} ${stats?.isRunning && !stats?.isPaused ? styles.active : ''}`} />
          <span>Transcodage: {stats?.isRunning ? (stats?.isPaused ? 'Pause' : 'Actif') : 'Arrêté'}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={`${styles.statusDot} ${watcher?.isWatching ? styles.active : ''}`} />
          <span>Watcher: {watcher?.isWatching ? 'Actif' : 'Inactif'}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={`${styles.statusDot} ${stats?.autoStartEnabled ? styles.active : ''}`} />
          <span>Auto-reprise: {stats?.autoStartEnabled ? 'Oui' : 'Non'}</span>
        </div>
      </div>

      {/* Info watcher */}
      {watcher?.isWatching && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.08)',
          borderLeft: '3px solid #22c55e',
          padding: '10px 14px',
          marginBottom: 16,
          fontSize: 13,
          color: 'rgba(255,255,255,0.7)'
        }}>
          <strong style={{ color: '#22c55e' }}>File Watcher actif</strong> — Les nouveaux fichiers sont automatiquement détectés et ajoutés à la queue de transcodage.
        </div>
      )}

      {/* Stats */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}><BarChart3 size={20} /></div>
          <h3 className={styles.cardTitle}>Progression globale</h3>
          <span className={styles.cardBadge}>{stats?.diskUsage || 'N/A'}</span>
        </div>
        <div className={styles.statsGrid}>
          <div className={styles.statBox}>
            <div className={styles.statValue}>{transcoded.length || stats?.completedFiles || 0}</div>
            <div className={styles.statLabel}>Transcodés</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statValue}>{stats?.pendingFiles || 0}</div>
            <div className={styles.statLabel}>En attente</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statValue}>{stats?.failedFiles || 0}</div>
            <div className={styles.statLabel}>Échecs</div>
          </div>
        </div>
        {stats && stats.totalFiles > 0 && (
          <div className={styles.progressContainer}>
            <div className={styles.progressLabel}>
              <span>{stats.completedFiles} / {stats.totalFiles} films</span>
              <span>{Math.round((stats.completedFiles / stats.totalFiles) * 100)}%</span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${(stats.completedFiles / stats.totalFiles) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Jobs en cours (support multi-transcodage) */}
      {stats?.activeJobs && stats.activeJobs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
            🔄 {stats.activeCount || stats.activeJobs.length}/{stats.maxConcurrent || 2} transcodes actifs
          </div>
          {stats.activeJobs.map((job, index) => (
            <div key={job.id} className={styles.currentJob}>
              <div className={styles.jobHeader}>
                <Film size={20} className={styles.jobIcon} />
                <div>
                  <p className={styles.jobTitle}>{job.filename}</p>
                  <p className={styles.jobMeta}>
                    {job.speed && `${job.speed.toFixed(1)}x`}
                    {job.currentTime && job.estimatedDuration && (
                      <> • {formatTime(job.currentTime)} / {formatTime(job.estimatedDuration)}</>
                    )}
                  </p>
                </div>
              </div>
              <div className={styles.jobProgress}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${job.progress}%` }} />
                </div>
                <span className={styles.jobPercent}>{Math.round(job.progress)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Fallback pour ancien format (1 seul job) */}
      {stats?.currentJob && !stats?.activeJobs && (
        <div className={styles.currentJob}>
          <div className={styles.jobHeader}>
            <Film size={20} className={styles.jobIcon} />
            <div>
              <p className={styles.jobTitle}>{stats.currentJob.filename}</p>
              <p className={styles.jobMeta}>
                {stats.currentJob.speed && `${stats.currentJob.speed.toFixed(1)}x`}
                {stats.currentJob.currentTime && stats.currentJob.estimatedDuration && (
                  <> • {formatTime(stats.currentJob.currentTime)} / {formatTime(stats.currentJob.estimatedDuration)}</>
                )}
              </p>
            </div>
          </div>
          <div className={styles.jobProgress}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${stats.currentJob.progress}%` }} />
            </div>
            <span className={styles.jobPercent}>{Math.round(stats.currentJob.progress)}%</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className={styles.card}>
        <div className={styles.actions}>
          {!stats?.isRunning ? (
            <>
              <button className={styles.btnSecondary} onClick={() => performAction('scan')} disabled={actionLoading !== null}>
                {actionLoading === 'scan' ? <RefreshCw size={16} className={styles.spin} /> : <Search size={16} />}
                Scanner
              </button>
              <button className={styles.btnPrimary} onClick={() => performAction('start')} disabled={actionLoading !== null || !stats?.pendingFiles}>
                {actionLoading === 'start' ? <RefreshCw size={16} className={styles.spin} /> : <Play size={16} />}
                Démarrer
              </button>
            </>
          ) : (
            <>
              {stats?.isPaused ? (
                <button className={styles.btnPrimary} onClick={() => performAction('resume')} disabled={actionLoading !== null}>
                  {actionLoading === 'resume' ? <RefreshCw size={16} className={styles.spin} /> : <Play size={16} />}
                  Reprendre
                </button>
              ) : (
                <button className={styles.btnSecondary} onClick={() => performAction('pause')} disabled={actionLoading !== null}>
                  {actionLoading === 'pause' ? <RefreshCw size={16} className={styles.spin} /> : <Pause size={16} />}
                  Pause
                </button>
              )}
              <button className={styles.btnDanger} onClick={() => confirm('Arrêter ?') && performAction('stop')} disabled={actionLoading !== null}>
                {actionLoading === 'stop' ? <RefreshCw size={16} className={styles.spin} /> : <Square size={16} />}
                Arrêter
              </button>
            </>
          )}
          <button 
            className={styles.btnSecondary} 
            onClick={() => performAction(watcher?.isWatching ? 'stop-watcher' : 'start-watcher')}
            disabled={actionLoading !== null}
          >
            <Eye size={16} />
            {watcher?.isWatching ? 'Désactiver watcher' : 'Activer watcher'}
          </button>
        </div>
      </div>

      {/* Queue - Design Pro Simplifié */}
      <div className={styles.queueContainer}>
        <div className={styles.queueHeader}>
          <div className={styles.queueHeaderLeft}>
            <div className={styles.queueIcon}>
              <Clock size={20} />
            </div>
            <div>
              <h3 className={styles.queueTitle}>File d&apos;attente</h3>
              <p className={styles.queueSubtitle}>
                {queue.length} fichier{queue.length > 1 ? 's' : ''} en attente
                {isModifying && <span style={{ marginLeft: 8, color: '#fbbf24' }}>• Modification...</span>}
              </p>
            </div>
          </div>
          <div className={styles.queueHeaderActions}>
            <button
              className={styles.btnCleanup}
              onClick={cleanupDuplicates}
              disabled={isModifying || queue.length === 0}
              title="Nettoyer les doublons"
            >
              <RefreshCw size={14} />
              Nettoyer doublons
            </button>
          </div>
        </div>
        
        {queue.length > 0 ? (
          <>
            <div className={styles.queueList} ref={queueListRef}>
              {queue.slice(0, 50).map((job, i) => (
                <div 
                  key={job.id} 
                  className={`${styles.queueItem} ${isModifying ? styles.queueItemModifying : ''} ${draggedIndex === i ? styles.queueItemDragging : ''} ${dragOverIndex === i ? styles.queueItemDragOver : ''}`}
                  draggable={!isModifying}
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, i)}
                >
                  <div className={styles.queueItemDragHandle} title="Glisser pour réorganiser">
                    <span>⋮⋮</span>
                  </div>
                  
                  {/* Position cliquable pour ouvrir le modal */}
                  <button 
                    className={styles.queueItemPositionBtn}
                    onClick={() => {
                      setMoveModal({ jobId: job.id, filename: job.filename, currentIndex: i })
                      setTargetPosition((i + 1).toString())
                    }}
                    title="Cliquer pour déplacer à une position spécifique"
                    disabled={isModifying}
                  >
                    {i + 1}
                  </button>
                  
                  <div className={styles.queueItemContent}>
                    <div className={styles.queueItemTitle}>{job.filename}</div>
                    <div className={styles.queueItemMeta}>
                      {job.fileSize && (
                        <span>
                          <HardDrive size={12} />
                          {(job.fileSize / (1024 * 1024 * 1024)).toFixed(1)} Go
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className={styles.queueItemActions}>
                    {/* Monter d'une position */}
                    {i > 0 && (
                      <button 
                        className={`${styles.queueActionBtn} ${styles.secondary}`}
                        onClick={() => moveJobBy(job.id, -1)} 
                        title="Monter d'une position"
                        disabled={isModifying}
                      >
                        <ChevronUp size={16} />
                      </button>
                    )}
                    {/* Descendre d'une position */}
                    {i < queue.length - 1 && (
                      <button 
                        className={`${styles.queueActionBtn} ${styles.secondary}`}
                        onClick={() => moveJobBy(job.id, 1)} 
                        title="Descendre d'une position"
                        disabled={isModifying}
                      >
                        <ChevronDown size={16} />
                      </button>
                    )}
                    {/* Passer en priorité (premier) */}
                    {i > 0 && (
                      <button 
                        className={`${styles.queueActionBtn} ${styles.primary}`}
                        onClick={() => moveJobToTop(job.id)} 
                        title="Passer en priorité (position 1)"
                        disabled={isModifying}
                      >
                        <ChevronsUp size={16} />
                      </button>
                    )}
                    {/* Supprimer */}
                    <button 
                      className={`${styles.queueActionBtn} ${styles.danger}`}
                      onClick={() => removeFromQueue(job.id, job.filename)} 
                      title="Retirer de la file"
                      disabled={isModifying}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  <span className={`${styles.queueItemStatus} ${job.status === 'failed' ? styles.failed : styles.pending}`}>
                    {job.status === 'pending' ? 'Attente' : 'Échec'}
                  </span>
                </div>
              ))}
            </div>
            
            {queue.length > 50 && (
              <div className={styles.queueFooter}>
                <span>Affichage des 50 premiers sur {queue.length}</span>
              </div>
            )}
          </>
        ) : (
          <div className={styles.queueEmpty}>
            <div className={styles.queueEmptyIcon}>
              <Check size={32} />
            </div>
            <p className={styles.queueEmptyTitle}>File d&apos;attente vide</p>
            <p className={styles.queueEmptyText}>
              Tous les fichiers ont été transcodés ou aucun nouveau fichier détecté
            </p>
          </div>
        )}
      </div>
      
      {/* Modal de déplacement vers position */}
      {moveModal && (
        <div className={styles.modalOverlay} onClick={() => setMoveModal(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Déplacer vers une position</h3>
              <button className={styles.modalClose} onClick={() => setMoveModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalFilename}>{moveModal.filename}</p>
              <p className={styles.modalCurrentPos}>
                Position actuelle : <strong>{moveModal.currentIndex + 1}</strong> / {queue.length}
              </p>
              
              <div className={styles.positionInputGroup}>
                <label htmlFor="targetPosition">Nouvelle position :</label>
                <input
                  id="targetPosition"
                  type="number"
                  min="1"
                  max={queue.length}
                  value={targetPosition}
                  onChange={(e) => setTargetPosition(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const pos = parseInt(targetPosition)
                      if (pos >= 1 && pos <= queue.length) {
                        moveJobToPosition(moveModal.jobId, pos)
                      }
                    }
                  }}
                  autoFocus
                  className={styles.positionInput}
                />
                <span className={styles.positionMax}>/ {queue.length}</span>
              </div>
              
              {/* Raccourcis rapides */}
              <div className={styles.quickPositions}>
                <button 
                  className={styles.quickPosBtn}
                  onClick={() => moveJobToPosition(moveModal.jobId, 1)}
                  disabled={moveModal.currentIndex === 0}
                >
                  <ChevronsUp size={14} /> Premier
                </button>
                <button 
                  className={styles.quickPosBtn}
                  onClick={() => moveJobToPosition(moveModal.jobId, Math.ceil(queue.length / 2))}
                >
                  Milieu
                </button>
                <button 
                  className={styles.quickPosBtn}
                  onClick={() => moveJobToPosition(moveModal.jobId, queue.length)}
                  disabled={moveModal.currentIndex === queue.length - 1}
                >
                  Dernier <ChevronsDown size={14} />
                </button>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button 
                className={styles.btnSecondary}
                onClick={() => setMoveModal(null)}
              >
                Annuler
              </button>
              <button 
                className={styles.btnPrimary}
                onClick={() => {
                  const pos = parseInt(targetPosition)
                  if (pos >= 1 && pos <= queue.length) {
                    moveJobToPosition(moveModal.jobId, pos)
                  }
                }}
                disabled={!targetPosition || parseInt(targetPosition) < 1 || parseInt(targetPosition) > queue.length}
              >
                Déplacer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transcodés */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}><Check size={20} /></div>
          <h3 className={styles.cardTitle}>Transcodés ({transcoded.length})</h3>
          <button className={`${styles.btnSecondary} ${styles.btnSmall}`} onClick={() => setShowTranscoded(!showTranscoded)}>
            {showTranscoded ? 'Masquer' : 'Afficher'}
          </button>
        </div>
        {showTranscoded && transcoded.length > 0 && (
          <div className={styles.list} style={{ maxHeight: 400, overflowY: 'auto' }}>
            {transcoded.map((film) => (
              <div key={film.folder} className={styles.listItem}>
                <div className={styles.listContent}>
                  <span className={styles.listTitle}>{film.name}</span>
                  <span className={styles.listMeta}>
                    {film.segmentCount} seg • {formatDate(film.transcodedAt)}
                    <span style={{ marginLeft: 8 }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: (film.audioCount || 1) > 1 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)', color: (film.audioCount || 1) > 1 ? '#22c55e' : 'rgba(255,255,255,0.5)', marginRight: 4 }}>
                        🔊 {film.audioCount || 1}
                      </span>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: (film.subtitleCount || 0) > 0 ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.1)', color: (film.subtitleCount || 0) > 0 ? '#3b82f6' : 'rgba(255,255,255,0.5)' }}>
                        📝 {film.subtitleCount || 0}
                      </span>
                    </span>
                  </span>
                </div>
                <button onClick={() => deleteTranscoded(film.folder, film.name)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 8 }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        {transcoded.length === 0 && <p className={styles.emptyText}>Aucun film transcodé</p>}
      </div>
    </div>
  )
}
