/**
 * Utilitaires de formatage temporel pour le lecteur vidéo
 */

/** Formate un temps en secondes en chaîne lisible (H:MM:SS ou M:SS) */
export function formatTime(time: number): string {
  if (!isFinite(time) || time < 0) return '0:00'
  
  const hours = Math.floor(time / 3600)
  const minutes = Math.floor((time % 3600) / 60)
  const seconds = Math.floor(time % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
