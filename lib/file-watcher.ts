/**
 * Rétro-compatibilité : re-exporte tout depuis lib/watcher/
 * Les consommateurs existants n'ont pas besoin de changer leurs imports.
 */

export { FileWatcher } from './watcher'
export { default } from './watcher'
