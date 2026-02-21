/**
 * Système centralisé d'invalidation de cache.
 * Permet aux routes admin de forcer le rafraîchissement
 * des caches en mémoire des routes publiques.
 */

let lastInvalidation = 0

export function invalidateMediaCaches(): void {
  lastInvalidation = Date.now()
  console.log('[CACHE] Caches médias invalidés par action admin')
}

export function getLastInvalidation(): number {
  return lastInvalidation
}
