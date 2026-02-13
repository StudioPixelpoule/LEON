/**
 * Composant: ContinueWatchingRow
 * Affiche les films ET épisodes en cours de visionnage avec badge de progression
 *
 * Optimisations :
 * - Refresh intelligent via document.visibilitychange (pas de polling en arrière-plan)
 * - Suppression optimiste avec rollback propre (sans hack removedIdsRef)
 * - Debounce sur le refresh pour éviter les appels multiples
 */

'use client'

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import styles from './ContinueWatchingRow.module.css'

interface MediaWithProgress extends GroupedMedia {
  position: number
  saved_duration: number | null
  progress_percent: number
  playback_updated_at: string
  content_type?: 'movie' | 'episode'
  subtitle?: string
  series_id?: string
  season_number?: number
  episode_number?: number
}

interface ContinueWatchingRowProps {
  onMovieClick: (movie: GroupedMedia) => void
  onMoviePlay?: (movie: GroupedMedia) => void
  onEpisodeClick?: (episode: MediaWithProgress) => void
  onRefresh: () => void
  refreshKey?: number
  filter?: 'all' | 'movies' | 'episodes'
}

const REFRESH_INTERVAL = 30_000 // 30s entre les refresh automatiques
const DEBOUNCE_DELAY = 500 // Debounce sur le refresh

function ContinueWatchingRowComponent({
  onMovieClick,
  onMoviePlay,
  onEpisodeClick,
  onRefresh,
  refreshKey,
  filter = 'all'
}: ContinueWatchingRowProps) {
  const [media, setMedia] = useState<MediaWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const userId = user?.id

  // Ref pour le set d'IDs supprimés localement (suppression optimiste)
  const deletedIdsRef = useRef<Set<string>>(new Set())

  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Refs pour le refresh intelligent
  const lastRefreshRef = useRef<number>(0)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  const checkScrollability = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 20)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 20)
  }, [])

  // Chargement des données avec debounce
  const loadInProgressMedia = useCallback(async (silent = false) => {
    if (!userId || !isMountedRef.current) return

    // Debounce : ne pas rafraîchir si le dernier refresh était il y a moins de DEBOUNCE_DELAY
    const now = Date.now()
    if (silent && now - lastRefreshRef.current < DEBOUNCE_DELAY) return
    lastRefreshRef.current = now

    try {
      if (!silent) setLoading(true)
      const response = await fetch(`/api/media/in-progress?userId=${encodeURIComponent(userId)}`)

      if (!response.ok) {
        console.error(`[CONTINUE] Erreur API: ${response.status}`)
        return
      }

      const data = await response.json()

      if (!isMountedRef.current) return

      if (data.success) {
        let filtered = data.media as MediaWithProgress[]

        if (filter === 'movies') {
          filtered = filtered.filter(m => m.content_type !== 'episode')
        } else if (filter === 'episodes') {
          filtered = filtered.filter(m => m.content_type === 'episode')
        }

        // Exclure les IDs supprimés localement (le temps que l'API se synchronise)
        if (deletedIdsRef.current.size > 0) {
          filtered = filtered.filter(m => !deletedIdsRef.current.has(m.id))
        }

        setMedia(filtered)

        // Vider les IDs supprimés qui ne sont plus dans la réponse API
        // (la suppression a été prise en compte côté serveur)
        if (deletedIdsRef.current.size > 0) {
          const serverIds = new Set((data.media as MediaWithProgress[]).map(m => m.id))
          for (const deletedId of deletedIdsRef.current) {
            if (!serverIds.has(deletedId)) {
              deletedIdsRef.current.delete(deletedId)
            }
          }
        }
      }
    } catch (error) {
      console.error('[CONTINUE] Erreur chargement médias en cours:', error)
    } finally {
      if (!silent && isMountedRef.current) setLoading(false)
    }
  }, [userId, filter])

  // Chargement initial + refresh quand refreshKey change
  useEffect(() => {
    if (userId) {
      loadInProgressMedia()
    }
  }, [refreshKey, userId, loadInProgressMedia])

  // Refresh intelligent : visibilitychange + intervalle conditionnel
  useEffect(() => {
    if (!userId) return

    // Planifier le prochain refresh automatique
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = setTimeout(() => {
        // Ne rafraîchir que si l'onglet est visible
        if (document.visibilityState === 'visible') {
          loadInProgressMedia(true)
        }
        scheduleRefresh() // Planifier le suivant
      }, REFRESH_INTERVAL)
    }

    // Rafraîchir quand l'utilisateur revient sur l'onglet
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadInProgressMedia(true)
        scheduleRefresh() // Redémarrer le timer
      } else {
        // Arrêter le timer quand l'onglet est masqué
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current)
          refreshTimerRef.current = null
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    scheduleRefresh()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [userId, loadInProgressMedia])

  // Cleanup au démontage
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Scrollability check
  useEffect(() => {
    checkScrollability()
    const el = scrollRef.current
    if (el) {
      el.addEventListener('scroll', checkScrollability)
      window.addEventListener('resize', checkScrollability)
    }
    return () => {
      if (el) {
        el.removeEventListener('scroll', checkScrollability)
        window.removeEventListener('resize', checkScrollability)
      }
    }
  }, [checkScrollability, media])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const scrollAmount = el.clientWidth * 0.75
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }

  // Suppression optimiste avec rollback propre
  async function handleRemove(mediaId: string, mediaType: string | undefined, event: React.MouseEvent) {
    event.stopPropagation()
    event.preventDefault()

    if (!userId) return

    console.log(`[REMOVE] Suppression de ${mediaId} (type: ${mediaType}) pour user ${userId}`)

    // Suppression optimiste immédiate
    deletedIdsRef.current.add(mediaId)
    setMedia(prev => prev.filter(m => m.id !== mediaId))

    try {
      const params = new URLSearchParams({ mediaId, userId })
      const response = await fetch(`/api/playback-position?${params.toString()}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`[REMOVE] Supprimé:`, result)
        // L'ID sera retiré de deletedIdsRef au prochain refresh quand l'API
        // confirmera que l'item n'existe plus
      } else {
        // Rollback : l'API a rejeté la suppression
        console.error(`[REMOVE] Erreur API: ${response.status}`)
        deletedIdsRef.current.delete(mediaId)
        loadInProgressMedia(true)
      }
    } catch (error) {
      // Rollback : erreur réseau
      console.error('[REMOVE] Erreur réseau:', error)
      deletedIdsRef.current.delete(mediaId)
      loadInProgressMedia(true)
    }
  }

  function handleClick(item: MediaWithProgress) {
    if (item.content_type === 'episode' && onEpisodeClick) {
      onEpisodeClick(item)
    } else if (onMoviePlay) {
      onMoviePlay(item)
    } else {
      onMovieClick(item)
    }
  }

  if (!loading && media.length === 0) return null

  if (loading) {
    return (
      <section className={styles.row}>
        <h2 className={styles.title}>Continuer le visionnage</h2>
        <div className={styles.loading}>Chargement...</div>
      </section>
    )
  }

  return (
    <section className={styles.row}>
      <h2 className={styles.title}>Continuer le visionnage</h2>

      <div className={styles.scrollContainer}>
        <button
          className={`${styles.navArrow} ${styles.navLeft} ${canScrollLeft ? styles.visible : ''}`}
          onClick={() => scroll('left')}
          aria-label="Précédent"
        >
          <ChevronLeft size={32} strokeWidth={2.5} />
        </button>

        <div className={styles.scroll} ref={scrollRef}>
          {media.map((item) => (
            <div
              key={item.id}
              className={styles.card}
              onClick={() => handleClick(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleClick(item)
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={item.content_type === 'episode'
                ? `Lire ${item.subtitle || item.title}`
                : `Lire ${item.title}`}
            >
              {/* Bouton supprimer */}
              <button
                className={styles.removeBtn}
                onClick={(e) => handleRemove(item.id, item.content_type, e)}
                title="Marquer comme terminé"
              >
                <X size={16} />
              </button>

              {/* Poster avec barre de progression */}
              <div className={styles.posterContainer}>
                <Image
                  src={item.poster_url || '/placeholder-poster.svg'}
                  alt={item.title}
                  width={240}
                  height={360}
                  className={styles.poster}
                  unoptimized
                />

                {item.content_type === 'episode' && item.season_number && item.episode_number && (
                  <div className={styles.episodeBadge}>
                    S{item.season_number}E{item.episode_number}
                  </div>
                )}

                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${item.progress_percent}%` }}
                  />
                </div>
              </div>

              {/* Info au hover */}
              <div className={styles.cardHover}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                {item.subtitle && (
                  <div className={styles.cardSubtitle}>{item.subtitle}</div>
                )}
                <div className={styles.cardMeta}>
                  {item.year && <span>{item.year}</span>}
                  {item.formatted_runtime && (
                    <>
                      <span>·</span>
                      <span>{item.formatted_runtime}</span>
                    </>
                  )}
                </div>
                {item.progress_percent > 0 && (
                  <div className={styles.cardProgress}>
                    {item.progress_percent}% regardé
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          className={`${styles.navArrow} ${styles.navRight} ${canScrollRight ? styles.visible : ''}`}
          onClick={() => scroll('right')}
          aria-label="Suivant"
        >
          <ChevronRight size={32} strokeWidth={2.5} />
        </button>
      </div>
    </section>
  )
}

export default memo(ContinueWatchingRowComponent)
