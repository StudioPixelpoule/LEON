/**
 * Hook: useLazyLoad
 * Utilise Intersection Observer pour charger les composants de manière paresseuse
 * quand ils entrent dans le viewport
 */

import { useEffect, useRef, useState, useCallback } from 'react'

interface UseLazyLoadOptions {
  threshold?: number
  rootMargin?: string
  triggerOnce?: boolean
}

/**
 * Hook pour le lazy loading avec Intersection Observer
 * @param options - Options de configuration
 * @returns { ref, isVisible } - Ref à attacher et état de visibilité
 */
export function useLazyLoad<T extends HTMLElement = HTMLDivElement>(options: UseLazyLoadOptions = {}) {
  const { threshold = 0, rootMargin = '100px', triggerOnce = true } = options
  
  const ref = useRef<T>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasBeenVisible, setHasBeenVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // Si déjà visible et triggerOnce, ne pas créer d'observer
    if (hasBeenVisible && triggerOnce) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting
        setIsVisible(visible)
        
        if (visible) {
          setHasBeenVisible(true)
          
          // Si triggerOnce, déconnecter l'observer après la première intersection
          if (triggerOnce) {
            observer.disconnect()
          }
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [threshold, rootMargin, triggerOnce, hasBeenVisible])

  // Pour triggerOnce, retourner hasBeenVisible au lieu de isVisible
  const shouldRender = triggerOnce ? hasBeenVisible : isVisible

  return { ref, isVisible: shouldRender }
}

/**
 * Hook pour précharger des données quand un élément devient visible
 * @param loadFn - Fonction de chargement à appeler
 * @param options - Options de configuration
 */
export function usePreloadOnVisible<T>(
  loadFn: () => Promise<T>,
  options: UseLazyLoadOptions = {}
) {
  const { ref, isVisible } = useLazyLoad<HTMLDivElement>(options)
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const hasLoaded = useRef(false)

  useEffect(() => {
    if (!isVisible || hasLoaded.current) return

    hasLoaded.current = true
    setIsLoading(true)

    loadFn()
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false))
  }, [isVisible, loadFn])

  return { ref, data, isLoading, error, isVisible }
}
