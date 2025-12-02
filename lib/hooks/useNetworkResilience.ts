/**
 * Hook React: useNetworkResilience
 * Gère les erreurs réseau avec reconnexion automatique et reprise transparente
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'

interface NetworkState {
  isOnline: boolean
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline'
  lastError: string | null
  reconnectAttempts: number
  isReconnecting: boolean
}

interface ReconnectConfig {
  maxAttempts: number
  baseDelay: number // ms
  maxDelay: number // ms
  backoffMultiplier: number
}

const DEFAULT_CONFIG: ReconnectConfig = {
  maxAttempts: 5,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
}

interface UseNetworkResilienceOptions {
  onReconnect?: () => void
  onDisconnect?: () => void
  onError?: (error: string) => void
  config?: Partial<ReconnectConfig>
}

export function useNetworkResilience(options: UseNetworkResilienceOptions = {}) {
  const { onReconnect, onDisconnect, onError, config: userConfig } = options
  
  // Mémoriser la config pour éviter les re-renders
  const config = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...userConfig,
  }), [userConfig?.maxAttempts, userConfig?.baseDelay, userConfig?.maxDelay, userConfig?.backoffMultiplier])
  
  const [state, setState] = useState<NetworkState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    connectionQuality: 'good',
    lastError: null,
    reconnectAttempts: 0,
    isReconnecting: false,
  })
  
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const savedPositionRef = useRef<number>(0)
  
  /**
   * Écoute les changements de connectivité
   */
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleOnline = () => {
      console.log('[NETWORK] ✅ Connexion rétablie')
      setState(prev => ({
        ...prev,
        isOnline: true,
        reconnectAttempts: 0,
        isReconnecting: false,
        connectionQuality: 'good',
      }))
      onReconnect?.()
    }
    
    const handleOffline = () => {
      console.log('[NETWORK] ❌ Connexion perdue')
      setState(prev => ({
        ...prev,
        isOnline: false,
        connectionQuality: 'offline',
      }))
      onDisconnect?.()
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [onReconnect, onDisconnect])
  
  /**
   * Calcule le délai de reconnexion avec backoff exponentiel
   */
  const calculateDelay = useCallback((attempt: number): number => {
    const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt)
    return Math.min(delay, config.maxDelay)
  }, [config])
  
  /**
   * Tente une reconnexion
   */
  const attemptReconnect = useCallback(async (
    reconnectFn: () => Promise<boolean>
  ): Promise<boolean> => {
    if (state.reconnectAttempts >= config.maxAttempts) {
      console.error(`[NETWORK] ❌ Maximum de tentatives atteint (${config.maxAttempts})`)
      setState(prev => ({
        ...prev,
        isReconnecting: false,
        lastError: `Échec après ${config.maxAttempts} tentatives`,
      }))
      onError?.(`Échec après ${config.maxAttempts} tentatives`)
      return false
    }
    
    const delay = calculateDelay(state.reconnectAttempts)
    console.log(`[NETWORK] 🔄 Tentative ${state.reconnectAttempts + 1}/${config.maxAttempts} dans ${delay}ms`)
    
    setState(prev => ({
      ...prev,
      isReconnecting: true,
      reconnectAttempts: prev.reconnectAttempts + 1,
    }))
    
    await new Promise(resolve => setTimeout(resolve, delay))
    
    try {
      const success = await reconnectFn()
      
      if (success) {
        console.log('[NETWORK] ✅ Reconnexion réussie')
        setState(prev => ({
          ...prev,
          isReconnecting: false,
          reconnectAttempts: 0,
          lastError: null,
          connectionQuality: 'good',
        }))
        onReconnect?.()
        return true
      } else {
        // Réessayer
        return attemptReconnect(reconnectFn)
      }
    } catch (error: any) {
      console.error('[NETWORK] ❌ Erreur reconnexion:', error.message)
      setState(prev => ({
        ...prev,
        lastError: error.message,
      }))
      // Réessayer
      return attemptReconnect(reconnectFn)
    }
  }, [state.reconnectAttempts, config, calculateDelay, onReconnect, onError])
  
  /**
   * Signale une erreur réseau et démarre la reconnexion
   */
  const handleNetworkError = useCallback((
    error: string,
    reconnectFn?: () => Promise<boolean>
  ) => {
    console.error('[NETWORK] ❌ Erreur:', error)
    
    setState(prev => ({
      ...prev,
      lastError: error,
      connectionQuality: 'poor',
    }))
    onError?.(error)
    
    // Démarrer la reconnexion si une fonction est fournie
    if (reconnectFn && state.isOnline) {
      attemptReconnect(reconnectFn)
    }
  }, [state.isOnline, attemptReconnect, onError])
  
  /**
   * Sauvegarde la position de lecture pour reprise
   */
  const savePosition = useCallback((position: number) => {
    savedPositionRef.current = position
  }, [])
  
  /**
   * Récupère la position sauvegardée
   */
  const getSavedPosition = useCallback((): number => {
    return savedPositionRef.current
  }, [])
  
  /**
   * Réinitialise l'état de reconnexion
   */
  const reset = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    setState(prev => ({
      ...prev,
      reconnectAttempts: 0,
      isReconnecting: false,
      lastError: null,
    }))
  }, [])
  
  /**
   * Mesure la qualité de connexion via un ping
   */
  const measureConnectionQuality = useCallback(async (): Promise<'excellent' | 'good' | 'poor' | 'offline'> => {
    if (!state.isOnline) return 'offline'
    
    const startTime = Date.now()
    
    try {
      // Ping léger vers l'API
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-store',
      })
      
      const latency = Date.now() - startTime
      
      let quality: 'excellent' | 'good' | 'poor' = 'good'
      if (latency < 100) {
        quality = 'excellent'
      } else if (latency < 500) {
        quality = 'good'
      } else {
        quality = 'poor'
      }
      
      setState(prev => ({
        ...prev,
        connectionQuality: quality,
      }))
      
      return quality
    } catch {
      setState(prev => ({
        ...prev,
        connectionQuality: 'poor',
      }))
      return 'poor'
    }
  }, [state.isOnline])
  
  // Cleanup
  useEffect(() => {
    const timeoutRef = reconnectTimeoutRef.current
    return () => {
      if (timeoutRef) {
        clearTimeout(timeoutRef)
      }
    }
  }, [])
  
  return {
    ...state,
    handleNetworkError,
    attemptReconnect,
    savePosition,
    getSavedPosition,
    measureConnectionQuality,
    reset,
  }
}

