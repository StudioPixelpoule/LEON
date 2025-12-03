/**
 * Hook React: useBufferStatus
 * Récupère le statut du buffer adaptatif depuis l'API
 */

import { useEffect, useState } from 'react'

interface BufferStatus {
  needsBuffering: boolean
  reason?: string
  currentSpeed: number
  targetSpeed: number
  bufferLevel: number
  minBuffer: number
}

interface BufferResponse {
  sessionId: string
  bufferStatus: BufferStatus
  timestamp: string
}

export function useBufferStatus(filepath: string | null, audioTrack: string = '0', enabled: boolean = false) {
  const [bufferStatus, setBufferStatus] = useState<BufferStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !filepath) {
      setBufferStatus(null)
      return
    }

    // Polling toutes les 2 secondes
    const interval = setInterval(async () => {
      setIsLoading(true)
      
      try {
        const response = await fetch(`/api/buffer-status?path=${encodeURIComponent(filepath)}&audio=${audioTrack}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            // Pas de session active, c'est normal
            setBufferStatus(null)
            return
          }
          throw new Error(`HTTP ${response.status}`)
        }

        const data: BufferResponse = await response.json()
        setBufferStatus(data.bufferStatus)
        setError(null)
      } catch (err: any) {
        setError(err.message)
        setBufferStatus(null)
      } finally {
        setIsLoading(false)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [filepath, audioTrack, enabled])

  return { bufferStatus, error, isLoading }
}








