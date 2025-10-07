/**
 * Grille responsive de médias
 * Auto-fill avec minmax pour adaptation automatique
 */

import MediaCard from './MediaCard'
import type { Media } from '@/lib/supabase'

type MediaGridProps = {
  media: Media[]
  loading?: boolean
}

export default function MediaGrid({ media, loading = false }: MediaGridProps) {
  if (loading) {
    return (
      <div className="mediaGrid">
        {/* Placeholders pendant le chargement */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="mediaCard">
            <div className="downloadingState">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        ))}
      </div>
    )
  }
  
  if (media.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: 'var(--spacing-2xl)',
        color: 'var(--color-gray-500)'
      }}>
        <p>Aucun média trouvé</p>
      </div>
    )
  }
  
  return (
    <div className="mediaGrid">
      {media.map((item) => (
        <MediaCard key={item.id} media={item} />
      ))}
    </div>
  )
}




