/**
 * Modal Série - Orchestrateur principal
 * Compose les hooks et sous-composants pour afficher détails, saisons et épisodes
 * Style Netflix avec progression de visionnage et trailer auto-play
 */

'use client'

import { useState, useCallback } from 'react'
import styles from './SeriesModal.module.css'
import SimpleVideoPlayer, { PlayerPreferences, SeasonInfo } from '@/components/SimpleVideoPlayer/SimpleVideoPlayer'
import { useAuth } from '@/contexts/AuthContext'
import { useSeriesDetails } from './hooks/useSeriesDetails'
import { useEpisodeProgress } from './hooks/useEpisodeProgress'
import { useSeriesTrailer } from './hooks/useSeriesTrailer'
import { SeriesHero } from './SeriesHero'
import { SeriesMetadata } from './SeriesMetadata'
import { SeriesEpisodesList } from './SeriesEpisodesList'
import type { Episode } from './hooks/useSeriesDetails'

interface SeriesInput {
  id: string
  title: string
  tmdb_id?: number | null
  trailer_url?: string | null
}

interface SeriesModalProps {
  series: SeriesInput
  onClose: () => void
}

export default function SeriesModal({ series, onClose }: SeriesModalProps) {
  const { user } = useAuth()
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
  const [showPlayer, setShowPlayer] = useState(false)
  const [playerPreferences, setPlayerPreferences] = useState<PlayerPreferences | undefined>(undefined)
  const [creditsDuration, setCreditsDuration] = useState<number>(45)

  // Hooks extraits
  const {
    episodeProgress,
    nextToWatch,
    loadProgress,
    getEpisodeProgressPercent,
    isEpisodeCompleted,
    formatTimeRemaining,
  } = useEpisodeProgress(user?.id)

  const onEpisodesLoaded = useCallback((episodes: Episode[]) => {
    loadProgress(episodes)
  }, [loadProgress])

  const {
    seriesDetails,
    loading,
    selectedSeason,
    setSelectedSeason,
    currentSeasonData,
    allEpisodes,
  } = useSeriesDetails(series.id, onEpisodesLoaded)

  const {
    trailerKey,
    trailerEnded,
    trailerMuted,
    trailerRef,
    setTrailerEnded,
    setTrailerMuted,
  } = useSeriesTrailer(series)

  // Lancer la lecture d'un épisode
  async function handlePlayEpisode(episode: Episode, preferences?: PlayerPreferences) {
    if (preferences) {
      setPlayerPreferences(preferences)
    }

    // Charger la durée du générique pour cette série/saison
    try {
      const params = new URLSearchParams({ show_name: series.title })
      if (episode.season_number) params.append('season', episode.season_number.toString())
      const response = await fetch(`/api/credits-duration?${params.toString()}`)
      const data = await response.json()
      if (data.success && data.credits_duration) {
        setCreditsDuration(data.credits_duration)
        console.log(`[SERIES_MODAL] 🎬 Durée générique pour ${series.title} S${episode.season_number}: ${data.credits_duration}s (${data.level})`)
      }
    } catch {
      console.log('[SERIES_MODAL] ⚠️ Impossible de charger la durée du générique, utilisation du défaut (45s)')
      setCreditsDuration(45)
    }

    setCurrentEpisode(episode)
    setShowPlayer(true)
  }

  // Trouver l'épisode suivant dans l'ordre global
  function getNextEpisode(current: Episode): Episode | null {
    if (!seriesDetails) return null
    const sorted = seriesDetails.seasons
      .flatMap(s => s.episodes)
      .sort((a, b) => {
        if (a.season_number !== b.season_number) return a.season_number - b.season_number
        return a.episode_number - b.episode_number
      })

    const currentIndex = sorted.findIndex(ep => ep.id === current.id)
    if (currentIndex >= 0 && currentIndex < sorted.length - 1) {
      return sorted[currentIndex + 1]
    }
    return null
  }

  // --- Rendu : états de chargement ---

  if (loading) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.loading}>Chargement...</div>
        </div>
      </div>
    )
  }

  if (!seriesDetails) {
    return null
  }

  // --- Rendu : lecteur vidéo ---

  if (showPlayer && currentEpisode) {
    const ext = currentEpisode.filepath.toLowerCase().split('.').pop()
    const needsTranscode = ext === 'mkv' || ext === 'avi'

    const audioParam = (needsTranscode && playerPreferences?.audioStreamIndex !== undefined)
      ? `&audio=${playerPreferences.audioStreamIndex}`
      : ''

    const videoUrl = needsTranscode
      ? `/api/hls?path=${encodeURIComponent(currentEpisode.filepath)}&playlist=true${audioParam}`
      : `/api/stream?path=${encodeURIComponent(currentEpisode.filepath)}`

    const nextEp = getNextEpisode(currentEpisode)

    const allSeasonsForPlayer: SeasonInfo[] = seriesDetails.seasons.map(season => ({
      seasonNumber: season.season,
      episodes: season.episodes.map(ep => ({
        id: ep.id,
        title: ep.title,
        seasonNumber: ep.season_number,
        episodeNumber: ep.episode_number,
        thumbnail: ep.still_url
          ? `/api/proxy-image?url=${encodeURIComponent(ep.still_url)}`
          : undefined,
        overview: ep.overview,
        runtime: ep.runtime,
      })),
    }))

    const handleEpisodeSelectFromPlayer = (episodeId: string, preferences: PlayerPreferences) => {
      for (const season of seriesDetails.seasons) {
        const episode = season.episodes.find(ep => ep.id === episodeId)
        if (episode) {
          console.log('[SERIES_MODAL] 📺 Épisode sélectionné depuis player:', episode.title)
          handlePlayEpisode(episode, preferences)
          break
        }
      }
    }

    return (
      <SimpleVideoPlayer
        src={videoUrl}
        title={seriesDetails.title}
        subtitle={`S${currentEpisode.season_number}E${currentEpisode.episode_number} · ${currentEpisode.title}`}
        poster={
          currentEpisode.still_url || seriesDetails.backdrop_url
            ? `/api/proxy-image?url=${encodeURIComponent(currentEpisode.still_url || seriesDetails.backdrop_url || '')}`
            : undefined
        }
        mediaId={currentEpisode.id}
        mediaType="episode"
        nextEpisode={nextEp ? {
          id: nextEp.id,
          title: nextEp.title,
          seasonNumber: nextEp.season_number,
          episodeNumber: nextEp.episode_number,
          thumbnail: nextEp.still_url
            ? `/api/proxy-image?url=${encodeURIComponent(nextEp.still_url)}`
            : undefined,
        } : undefined}
        onNextEpisode={nextEp ? (preferences: PlayerPreferences) => {
          console.log('[SERIES_MODAL] ➡️ Passage à l\'épisode suivant:', nextEp.title)
          handlePlayEpisode(nextEp, preferences)
        } : undefined}
        initialPreferences={playerPreferences}
        creditsDuration={creditsDuration}
        allSeasons={allSeasonsForPlayer}
        currentEpisodeId={currentEpisode.id}
        onEpisodeSelect={handleEpisodeSelectFromPlayer}
        onClose={() => {
          setShowPlayer(false)
          setCurrentEpisode(null)
          if (seriesDetails) {
            loadProgress(allEpisodes)
          }
        }}
      />
    )
  }

  // --- Rendu : modal série ---
  // Structure DOM préservée : .heroSection en dehors de .content,
  // puis un unique .content wrappant métadonnées + épisodes

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          ✕
        </button>

        <SeriesHero
          seriesDetails={seriesDetails}
          trailerKey={trailerKey}
          trailerEnded={trailerEnded}
          trailerRef={trailerRef}
          onTrailerEnded={() => setTrailerEnded(true)}
          onMuteChange={setTrailerMuted}
        />

        <div className={styles.content}>
          <SeriesMetadata
            seriesDetails={seriesDetails}
            trailerKey={trailerKey}
            trailerEnded={trailerEnded}
            trailerMuted={trailerMuted}
            trailerRef={trailerRef}
            nextToWatch={nextToWatch}
            episodeProgress={episodeProgress}
            onPlayEpisode={handlePlayEpisode}
          />

          <SeriesEpisodesList
            seasons={seriesDetails.seasons}
            selectedSeason={selectedSeason}
            onSeasonChange={setSelectedSeason}
            currentSeasonData={currentSeasonData}
            onPlayEpisode={handlePlayEpisode}
            getEpisodeProgressPercent={getEpisodeProgressPercent}
            isEpisodeCompleted={isEpisodeCompleted}
            formatTimeRemaining={formatTimeRemaining}
          />
        </div>
      </div>
    </div>
  )
}
