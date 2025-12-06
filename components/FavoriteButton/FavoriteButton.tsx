/**
 * FavoriteButton - Bouton cœur élégant et sobre
 * Design minimaliste, animation subtile
 */

'use client'

import { useFavorites } from '@/lib/hooks/useFavorites'
import styles from './FavoriteButton.module.css'

interface FavoriteButtonProps {
  mediaId: string
  mediaType?: 'movie' | 'series'
  size?: 'small' | 'medium' | 'large'
  className?: string
  onToggle?: (isFavorite: boolean) => void
}

export default function FavoriteButton({ 
  mediaId, 
  mediaType = 'movie',
  size = 'medium',
  className = '',
  onToggle
}: FavoriteButtonProps) {
  const { isFavorite, loading, toggleFavorite } = useFavorites({ mediaId, mediaType })

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation() // Empêcher la propagation au parent (card)
    await toggleFavorite()
    onToggle?.(!isFavorite)
  }

  const sizeClass = styles[size] || styles.medium

  return (
    <button
      className={`${styles.button} ${sizeClass} ${isFavorite ? styles.active : ''} ${className}`}
      onClick={handleClick}
      disabled={loading}
      aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      title={isFavorite ? 'Retirer de ma liste' : 'Ajouter à ma liste'}
    >
      <svg 
        viewBox="0 0 24 24" 
        className={styles.heart}
        fill={isFavorite ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={isFavorite ? 0 : 1.5}
      >
        <path 
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </svg>
    </button>
  )
}













