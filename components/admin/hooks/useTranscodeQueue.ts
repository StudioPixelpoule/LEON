'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TranscodeStats {
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

export interface TranscodeJob {
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

export interface TranscodedFile {
  name: string
  folder: string
  transcodedAt: string
  segmentCount: number
  audioCount?: number
  subtitleCount?: number
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseTranscodeQueueReturn {
  stats: TranscodeStats | null
  queue: TranscodeJob[]
  transcoded: TranscodedFile[]
  watcher: { isWatching: boolean } | null
  loading: boolean
  isModifying: boolean
  setQueue: React.Dispatch<React.SetStateAction<TranscodeJob[]>>
  setIsModifying: React.Dispatch<React.SetStateAction<boolean>>
  modifyTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>
  loadStats: (quick?: boolean) => Promise<void>
}

/**
 * Hook de polling et gestion d'état de la queue de transcodage.
 * Gère le chargement initial, le polling adaptatif, et le blocage
 * pendant les modifications optimistes.
 */
export function useTranscodeQueue(): UseTranscodeQueueReturn {
  const [stats, setStats] = useState<TranscodeStats | null>(null)
  const [queue, setQueue] = useState<TranscodeJob[]>([])
  const [transcoded, setTranscoded] = useState<TranscodedFile[]>([])
  const [watcher, setWatcher] = useState<{ isWatching: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  
  // État pour bloquer le polling pendant les modifications
  const [isModifying, setIsModifying] = useState(false)
  const isLoadingRef = useRef(false)
  const modifyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
      console.error('[TRANSCODE] Erreur chargement stats:', error)
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [isModifying])

  // Polling avec blocage pendant modifications
  useEffect(() => {
    loadStats(true)
    const getInterval = () => stats?.isRunning && !stats?.isPaused ? 4000 : 10000
    const interval = setInterval(() => {
      if (!isModifying) loadStats(true)
    }, getInterval())
    return () => clearInterval(interval)
  }, [stats?.isRunning, stats?.isPaused, isModifying]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    stats,
    queue,
    transcoded,
    watcher,
    loading,
    isModifying,
    setQueue,
    setIsModifying,
    modifyTimeoutRef,
    loadStats,
  }
}
