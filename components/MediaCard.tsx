/**
 * Carte de média minimaliste avec jaquette
 * Animation hover: translateY(-8px) + bordure noire
 */

import Image from 'next/image'
import Link from 'next/link'
import type { Media } from '@/lib/supabase'

type MediaCardProps = {
  media: Media
}

export default function MediaCard({ media }: MediaCardProps) {
  const posterUrl = media.poster_url || '/placeholder-poster.png'
  
  return (
    <Link href={`/movie/${media.id}`} className="mediaCard">
      <Image
        src={posterUrl}
        alt={media.title}
        fill
        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className="object-cover"
        priority={false}
      />
      
      {/* Overlay au hover avec infos basiques */}
      <div className="overlay">
        <h3 className="title">{media.title}</h3>
        <div className="metadata">
          {media.year && <span>{media.year}</span>}
          {media.year && media.duration && <span>·</span>}
          {media.duration && <span>{media.duration} min</span>}
          {media.quality && (
            <>
              <span>·</span>
              <span>{media.quality}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}




