/**
 * Fonctions de formatage spécifiques à la vue Activité.
 * Séparées de formatters.ts (utilisé par d'autres vues admin).
 */

/**
 * Formate une date ISO en temps relatif français.
 * @param iso - Date au format ISO 8601
 * @returns Temps relatif (ex: "Il y a 5min", "Il y a 2h", "Il y a 3j")
 */
export function formatRelativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'À l\'instant'
  if (diff < 60) return `Il y a ${diff}min`
  const h = Math.floor(diff / 60)
  if (h < 24) return `Il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `Il y a ${d}j`
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

/**
 * Formate une durée en minutes vers un format lisible.
 * @param minutes - Durée en minutes
 * @returns Durée formatée (ex: "45min", "1h 23min", "2h")
 */
export function formatActivityDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

/**
 * Formate une date ISO pour l'affichage dans l'historique.
 * Affiche l'année uniquement si différente de l'année en cours.
 * @param iso - Date au format ISO 8601
 * @returns Objet avec date et heure formatées
 */
export function formatWatchDate(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const date = d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return { date, time }
}

/**
 * Formate une position en secondes vers un format mm:ss.
 * @param seconds - Position en secondes
 * @returns Position formatée (ex: "12:45", "1:03:22")
 */
export function formatPosition(seconds: number): string {
  const totalSecs = Math.floor(seconds)
  const hours = Math.floor(totalSecs / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)
  const secs = totalSecs % 60

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Formate une date ISO en texte relatif pour l'interface utilisateurs.
 * @param dateStr - Date au format ISO 8601
 * @returns Texte relatif (ex: "Aujourd'hui", "Hier", "Il y a 3 jours", "12 janv.")
 */
export function formatUserDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 7) return `Il y a ${days} jours`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
