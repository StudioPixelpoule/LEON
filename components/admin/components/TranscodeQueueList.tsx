'use client'

import { useState, useRef } from 'react'
import {
  RefreshCw,
  Clock,
  Check,
  HardDrive,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  X,
} from 'lucide-react'
import type { TranscodeJob } from '@/components/admin/hooks/useTranscodeQueue'
import styles from '@/app/admin/admin.module.css'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TranscodeQueueListProps {
  queue: TranscodeJob[]
  isModifying: boolean
  onMoveToTop: (jobId: string) => Promise<void>
  onRemove: (jobId: string, filename: string) => Promise<void>
  onCleanupDuplicates: () => Promise<void>
  onMoveToPosition: (jobId: string, newPosition: number) => Promise<void>
  onMoveBy: (jobId: string, delta: number) => Promise<void>
  onReorder: (newQueue: TranscodeJob[]) => void
}

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Affiche la file d'attente de transcodage avec support drag-and-drop,
 * réorganisation manuelle, et modal de positionnement.
 */
export function TranscodeQueueList({
  queue,
  isModifying,
  onMoveToTop,
  onRemove,
  onCleanupDuplicates,
  onMoveToPosition,
  onMoveBy,
  onReorder,
}: TranscodeQueueListProps) {
  // Drag and drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const queueListRef = useRef<HTMLDivElement>(null)
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Modal déplacement vers position
  const [moveModal, setMoveModal] = useState<{
    jobId: string
    filename: string
    currentIndex: number
  } | null>(null)
  const [targetPosition, setTargetPosition] = useState('')

  // ── Drag and Drop handlers avec auto-scroll ──

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
    const scrollZone = 60
    const scrollSpeed = 8
    
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current)
      scrollIntervalRef.current = null
    }
    
    if (e.clientY < rect.top + scrollZone && container.scrollTop > 0) {
      scrollIntervalRef.current = setInterval(() => {
        container.scrollTop -= scrollSpeed
      }, 16)
    } else if (e.clientY > rect.bottom - scrollZone && container.scrollTop < container.scrollHeight - container.clientHeight) {
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

    // Mise à jour optimiste : réorganiser et notifier le parent
    const newQueue = [...queue]
    const [draggedItem] = newQueue.splice(draggedIndex, 1)
    newQueue.splice(dropIndex, 0, draggedItem)
    onReorder(newQueue)

    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  // ── Handlers du modal de positionnement ──

  function handlePositionClick(jobId: string, filename: string, index: number) {
    setMoveModal({ jobId, filename, currentIndex: index })
    setTargetPosition((index + 1).toString())
  }

  function handleMoveConfirm() {
    if (!moveModal) return
    const pos = parseInt(targetPosition)
    if (pos >= 1 && pos <= queue.length) {
      onMoveToPosition(moveModal.jobId, pos)
      setMoveModal(null)
      setTargetPosition('')
    }
  }

  function handlePositionKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleMoveConfirm()
    }
  }

  // ── Rendu ──

  return (
    <>
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
              onClick={onCleanupDuplicates}
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
                  
                  <button 
                    className={styles.queueItemPositionBtn}
                    onClick={() => handlePositionClick(job.id, job.filename, i)}
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
                    {i > 0 && (
                      <button 
                        className={`${styles.queueActionBtn} ${styles.secondary}`}
                        onClick={() => onMoveBy(job.id, -1)} 
                        title="Monter d'une position"
                        disabled={isModifying}
                      >
                        <ChevronUp size={16} />
                      </button>
                    )}
                    {i < queue.length - 1 && (
                      <button 
                        className={`${styles.queueActionBtn} ${styles.secondary}`}
                        onClick={() => onMoveBy(job.id, 1)} 
                        title="Descendre d'une position"
                        disabled={isModifying}
                      >
                        <ChevronDown size={16} />
                      </button>
                    )}
                    {i > 0 && (
                      <button 
                        className={`${styles.queueActionBtn} ${styles.primary}`}
                        onClick={() => onMoveToTop(job.id)} 
                        title="Passer en priorité (position 1)"
                        disabled={isModifying}
                      >
                        <ChevronsUp size={16} />
                      </button>
                    )}
                    <button 
                      className={`${styles.queueActionBtn} ${styles.danger}`}
                      onClick={() => onRemove(job.id, job.filename)} 
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
                  onKeyDown={handlePositionKeyDown}
                  autoFocus
                  className={styles.positionInput}
                />
                <span className={styles.positionMax}>/ {queue.length}</span>
              </div>
              
              <div className={styles.quickPositions}>
                <button 
                  className={styles.quickPosBtn}
                  onClick={() => {
                    onMoveToPosition(moveModal.jobId, 1)
                    setMoveModal(null)
                    setTargetPosition('')
                  }}
                  disabled={moveModal.currentIndex === 0}
                >
                  <ChevronsUp size={14} /> Premier
                </button>
                <button 
                  className={styles.quickPosBtn}
                  onClick={() => {
                    onMoveToPosition(moveModal.jobId, Math.ceil(queue.length / 2))
                    setMoveModal(null)
                    setTargetPosition('')
                  }}
                >
                  Milieu
                </button>
                <button 
                  className={styles.quickPosBtn}
                  onClick={() => {
                    onMoveToPosition(moveModal.jobId, queue.length)
                    setMoveModal(null)
                    setTargetPosition('')
                  }}
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
                onClick={handleMoveConfirm}
                disabled={!targetPosition || parseInt(targetPosition) < 1 || parseInt(targetPosition) > queue.length}
              >
                Déplacer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
