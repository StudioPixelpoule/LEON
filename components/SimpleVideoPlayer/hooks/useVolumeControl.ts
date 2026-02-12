/**
 * Hook: useVolumeControl
 * Gere le volume et le mute du lecteur video
 *
 * - Toggle mute/unmute
 * - Ajustement du volume via slider
 * - Restauration automatique du volume apres unmute
 */

import { useState, useCallback, RefObject } from 'react'

interface UseVolumeControlOptions {
  videoRef: RefObject<HTMLVideoElement>
}

interface UseVolumeControlReturn {
  volume: number
  isMuted: boolean
  setVolume: (v: number) => void
  setIsMuted: (m: boolean) => void
  handleVolumeToggle: () => void
  handleVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function useVolumeControl({
  videoRef
}: UseVolumeControlOptions): UseVolumeControlReturn {
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  const handleVolumeToggle = useCallback(() => {
    if (!videoRef.current) return

    if (isMuted || volume === 0) {
      videoRef.current.muted = false
      setIsMuted(false)
      if (volume === 0) {
        videoRef.current.volume = 1
        setVolume(1)
      }
    } else {
      videoRef.current.muted = true
      setIsMuted(true)
    }
  }, [isMuted, volume, videoRef])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return
    const newVolume = parseFloat(e.target.value)
    videoRef.current.volume = newVolume
    setVolume(newVolume)
    if (newVolume > 0 && isMuted) {
      videoRef.current.muted = false
      setIsMuted(false)
    }
  }, [isMuted, videoRef])

  return {
    volume,
    isMuted,
    setVolume,
    setIsMuted,
    handleVolumeToggle,
    handleVolumeChange
  }
}
