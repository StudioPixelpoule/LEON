/**
 * Barrel export — lib/watcher/
 * 
 * API publique identique à l'ancien lib/file-watcher.ts :
 * - export default fileWatcher (singleton)
 * - export { FileWatcher } (classe)
 */

import { FileWatcher } from './file-watcher'

// Déclaration globale pour le singleton (survie au HMR)
declare global {
  // eslint-disable-next-line no-var
  var __fileWatcherSingleton: FileWatcher | undefined
}

// Singleton global
if (!global.__fileWatcherSingleton) {
  global.__fileWatcherSingleton = new FileWatcher()
}

const fileWatcher = global.__fileWatcherSingleton

export default fileWatcher
export { FileWatcher }
