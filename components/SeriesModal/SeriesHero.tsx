/**
 * Section hero visuelle de la modal série
 * Affiche le trailer auto-play ou l'image backdrop avec le poster flottant
 * Ne gère que la partie visuelle (.heroSection) — les métadonnées restent dans l'orchestrateur
 */

'use client'

import Image from 'next/image'
import TrailerPlayer, { TrailerPlayerRef } from '@/components/TrailerPlayer/TrailerPlayer'
import type { SeriesDetails } from './hooks/useSeriesDetails'
import styles from './SeriesModal.module.css'

interface SeriesHeroProps {
  seriesDetails: SeriesDetails
  trailerKey: string | null
  trailerEnded: boolean
  trailerRef: React.RefObject<TrailerPlayerRef>
  onTrailerEnded: () => void
  onMuteChange: (muted: boolean) => void
}

/**
 * Partie visuelle du hero : backdrop/trailer + poster flottant.
 * Correspond au div .heroSection dans le DOM.
 */
export function SeriesHero({
  seriesDetails,
  trailerKey,
  trailerEnded,
  trailerRef,
  onTrailerEnded,
  onMuteChange,
}: SeriesHeroProps) {
  return (
    <div className={styles.heroSection}>
      {/* Trailer ou Image */}
      {trailerKey && !trailerEnded ? (
        <TrailerPlayer
          ref={trailerRef}
          youtubeKey={trailerKey}
          backdropUrl={seriesDetails.backdrop_url || '/placeholder-backdrop.png'}
          onEnded={onTrailerEnded}
          className={styles.trailerContainer}
          showMuteButton={false}
          onMuteChange={onMuteChange}
        />
      ) : seriesDetails.backdrop_url && (
        <div className={styles.backdrop}>
          <Image
            src={seriesDetails.backdrop_url}
            alt={seriesDetails.title}
            fill
            className={styles.backdropImage}
            unoptimized
          />
          <div className={styles.backdropOverlay} />
        </div>
      )}

      {/* Poster à gauche */}
      {seriesDetails.poster_url && (
        <div className={styles.heroPoster}>
          <Image
            src={seriesDetails.poster_url}
            alt={seriesDetails.title}
            width={200}
            height={300}
            className={styles.posterImage}
            unoptimized
          />
        </div>
      )}
    </div>
  )
}
