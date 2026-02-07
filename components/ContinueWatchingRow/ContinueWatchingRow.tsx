/**
 * Composant: ContinueWatchingRow
 * Affiche les films ET épisodes en cours de visionnage avec badge de progression
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
  subtitle?: string // Pour les épisodes: "S1E3 · Titre épisode"
  series_id?: string
  season_number?: number
  episode_number?: number
}

interface ContinueWatchingRowProps {
  onMovieClick: (movie: GroupedMedia) => void
  onMoviePlay?: (movie: GroupedMedia) => void
  onEpisodeClick?: (episode: MediaWithProgress) => void // Pour les épisodes
  onRefresh: () => void
  refreshKey?: number
  filter?: 'all' | 'movies' | 'episodes' // Filtrer par type
}

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
  
  // 🔧 FIX: Garder trace des IDs supprimés pour éviter qu'ils réapparaissent
  const removedIdsRef = useRef<Set<string>>(new Set())
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScrollability = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 20)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 20)
  }, [])

  useEffect(() => {
    if (userId) {
      loadInProgressMedia()
    }
    
    const intervalId = setInterval(() => {
      if (userId) loadInProgressMedia(true)
    }, 30000)
    
    return () => clearInterval(intervalId)
  }, [refreshKey, userId])

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

  async function loadInProgressMedia(silent = false) {
    if (!userId) return
    
    try {
      if (!silent) setLoading(true)
      const response = await fetch(`/api/media/in-progress?userId=${encodeURIComponent(userId)}`)
      const data = await response.json()
      
      if (data.success) {
        let filtered = data.media
        // Filtrer par type si demandé
        if (filter === 'movies') {
          filtered = data.media.filter((m: MediaWithProgress) => m.content_type !== 'episode')
        } else if (filter === 'episodes') {
          filtered = data.media.filter((m: MediaWithProgress) => m.content_type === 'episode')
        }
        // 🔧 FIX: Exclure les éléments récemment supprimés (évite le flash de réapparition)
        filtered = filtered.filter((m: MediaWithProgress) => !removedIdsRef.current.has(m.id))
        setMedia(filtered)
      }
    } catch (error) {
      console.error('Erreur chargement médias en cours:', error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  async function handleRemove(mediaId: string, mediaType: string | undefined, event: React.MouseEvent) {
    event.stopPropagation()
    event.preventDefault()
    
    console.log(`[REMOVE] Suppression de ${mediaId} (type: ${mediaType}) pour user ${userId}`)
    
    // 🔧 FIX: Ajouter à la liste des supprimés IMMÉDIATEMENT pour éviter réapparition
    removedIdsRef.current.add(mediaId)
    
    // Mettre à jour l'état local IMMÉDIATEMENT pour feedback utilisateur
    setMedia(prev => prev.filter(m => m.id !== mediaId))
    
    try {
      // Utiliser DELETE qui est plus fiable que POST avec position=0
      const params = new URLSearchParams({ mediaId })
      if (userId) params.append('userId', userId)
      
      const response = await fetch(`/api/playback-position?${params.toString()}`, {
        method: 'DELETE',
      })
      
      const result = await response.json()
      console.log(`[REMOVE] Résultat:`, result)
      
      if (response.ok) {
        // 🔧 FIX: Garder l'ID dans la liste des supprimés pendant 60s (assez pour que le cache soit invalidé)
        setTimeout(() => {
          removedIdsRef.current.delete(mediaId)
        }, 60000) // 60 secondes au lieu de 10
        // Pas besoin d'appeler onRefresh - l'état local est déjà à jour
      } else {
        console.error('[REMOVE] Erreur API:', result)
        // Restaurer si erreur - retirer de la liste des supprimés et recharger
        removedIdsRef.current.delete(mediaId)
        loadInProgressMedia()
      }
    } catch (error) {
      console.error('[REMOVE] Erreur suppression position:', error)
      // Restaurer si erreur - retirer de la liste des supprimés et recharger
      removedIdsRef.current.delete(mediaId)
      loadInProgressMedia()
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

  // Ne rien afficher si pas de médias en cours
  if (!loading && media.length === 0) {
    return null
  }

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
              aria-label={`${item.content_type === 'episode' ? `Lire ${item.subtitle || item.title}` : `Lire ${item.title}`}`}
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
                
                {/* Badge épisode */}
                {item.content_type === 'episode' && item.season_number && item.episode_number && (
                  <div className={styles.episodeBadge}>
                    S{item.season_number}E{item.episode_number}
                  </div>
                )}
                
                {/* Barre de progression */}
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

