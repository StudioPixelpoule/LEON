/**
 * Page Ma Liste - Favoris et En cours de l'utilisateur
 * Utilise le hook partagé useContinueWatching pour la section "En cours"
 */

'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Header from '@/components/Header/Header'
import MovieModal from '@/components/MovieModal/MovieModalWithTV'
import { useAuth } from '@/contexts/AuthContext'
import { useContinueWatching } from '@/lib/hooks/useContinueWatching'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import styles from './ma-liste.module.css'

export default function MaListePage() {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState<GroupedMedia[]>([])
  const [favLoading, setFavLoading] = useState(true)
  const [selectedMovie, setSelectedMovie] = useState<GroupedMedia | null>(null)
  const [activeTab, setActiveTab] = useState<'favorites' | 'in-progress'>('favorites')

  // Hook partagé pour les médias en cours
  const {
    media: inProgress,
    loading: progressLoading,
    refresh: refreshProgress,
    remove: removeProgress
  } = useContinueWatching({ userId: user?.id })

  // Charger les favoris
  useEffect(() => {
    if (user?.id) {
      loadFavorites()
      refreshProgress()
    }
  }, [user?.id, refreshProgress])

  async function loadFavorites() {
    if (!user?.id) return
    setFavLoading(true)
    try {
      const favResponse = await fetch(`/api/favorites?type=movie&userId=${encodeURIComponent(user.id)}`)
      if (favResponse.ok) {
        const favData = await favResponse.json()
        setFavorites(favData.favorites || [])
      }
    } catch (error) {
      console.error('Erreur chargement favoris:', error)
    } finally {
      setFavLoading(false)
    }
  }

  async function handleRemoveFavorite(mediaId: string, e: React.MouseEvent) {
    e.stopPropagation()

    // Optimistic update
    setFavorites(prev => prev.filter(m => m.id !== mediaId))

    try {
      await fetch(`/api/favorites?mediaId=${mediaId}&mediaType=movie&userId=${user?.id}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.error('Erreur suppression favori:', error)
      loadFavorites()
    }
  }

  async function handleRemoveProgress(mediaId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await removeProgress(mediaId)
  }

  const loading = activeTab === 'favorites' ? favLoading : progressLoading
  const currentList = activeTab === 'favorites' ? favorites : inProgress
  const emptyMessage = activeTab === 'favorites'
    ? "Vous n'avez pas encore de favoris. Cliquez sur le coeur d'un film pour l'ajouter."
    : "Aucun film en cours. Commencez a regarder un film pour le voir ici."

  if (loading) {
    return (
      <>
        <Header />
        <main className={styles.main}>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Chargement de votre liste...</p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Ma liste</h1>

          {/* Onglets */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'favorites' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              Favoris
              {favorites.length > 0 && (
                <span className={styles.badge}>{favorites.length}</span>
              )}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'in-progress' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('in-progress')}
            >
              En cours
              {inProgress.length > 0 && (
                <span className={styles.badge}>{inProgress.length}</span>
              )}
            </button>
          </div>
        </div>

        {currentList.length === 0 ? (
          <div className={styles.empty}>
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {currentList.map((movie) => (
              <div
                key={movie.id}
                className={styles.card}
                onClick={() => setSelectedMovie(movie)}
              >
                {/* Bouton supprimer */}
                <button
                  className={styles.removeBtn}
                  onClick={(e) => activeTab === 'favorites'
                    ? handleRemoveFavorite(movie.id, e)
                    : handleRemoveProgress(movie.id, e)
                  }
                  title="Retirer de la liste"
                >
                  x
                </button>

                <div className={styles.posterContainer}>
                  <Image
                    src={movie.poster_url || '/placeholder-poster.svg'}
                    alt={movie.title}
                    width={240}
                    height={360}
                    className={styles.poster}
                    unoptimized
                  />

                  {/* Barre de progression pour les medias en cours */}
                  {activeTab === 'in-progress' && 'progress_percent' in movie && (movie as { progress_percent?: number }).progress_percent && (
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${(movie as { progress_percent?: number }).progress_percent}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className={styles.cardInfo}>
                  <h3 className={styles.cardTitle}>{movie.title}</h3>
                  <div className={styles.cardMeta}>
                    {movie.year && <span>{movie.year}</span>}
                    {movie.formatted_runtime && (
                      <>
                        <span>·</span>
                        <span>{movie.formatted_runtime}</span>
                      </>
                    )}
                  </div>
                  {activeTab === 'in-progress' && 'progress_percent' in movie && (movie as { progress_percent?: number }).progress_percent && (
                    <div className={styles.cardProgress}>
                      {(movie as { progress_percent?: number }).progress_percent}% regarde
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedMovie && (
          <MovieModal
            movie={selectedMovie}
            onClose={() => {
              setSelectedMovie(null)
              loadFavorites()
              refreshProgress(true)
            }}
            onPlayClick={() => {}}
          />
        )}
      </main>
    </>
  )
}
