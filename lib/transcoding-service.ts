/**
 * Rétro-compatibilité : re-exporte tout depuis lib/transcoding/
 * Les consommateurs existants n'ont pas besoin de changer leurs imports.
 */

export { TranscodingService, TRANSCODED_DIR, MEDIA_DIR } from './transcoding'
export type { TranscodeJob, TranscodeStats } from './transcoding'
export { default } from './transcoding'
