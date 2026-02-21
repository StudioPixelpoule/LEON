/**
 * Extrait l'ID vidéo YouTube depuis n'importe quel format d'URL.
 * Supporte: youtube.com/watch?v=XXX, youtu.be/XXX, youtube.com/embed/XXX
 */
export function extractYoutubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}
