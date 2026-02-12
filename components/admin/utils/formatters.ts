/**
 * Fonctions utilitaires de formatage pour les vues admin.
 * Fonctions pures, réutilisables par toutes les vues admin.
 */

/**
 * Formate une durée en secondes vers un format lisible (ex: "1h 23min", "45min").
 * @param seconds - Durée en secondes
 * @returns Chaîne formatée ou '--:--' si invalide
 */
export function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '--:--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

/**
 * Formate une date ISO en format français court (ex: "12 janv. 2026").
 * @param iso - Date au format ISO 8601
 * @returns Date formatée ou chaîne vide si invalide
 */
export function formatDate(iso: string | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

/**
 * Formate une taille en octets vers un format lisible (ex: "1.5 Go").
 * @param bytes - Taille en octets
 * @returns Taille formatée
 */
export function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 o'
  const units = ['o', 'Ko', 'Mo', 'Go', 'To']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`
}
