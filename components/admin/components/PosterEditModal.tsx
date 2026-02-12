'use client'

import Image from 'next/image'
import {
  RefreshCw,
  Search,
  X,
  Image as ImageIcon
} from 'lucide-react'
import styles from '@/app/admin/admin.module.css'
import type { TMDBResult } from '../hooks/usePosterUpdate'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PosterEditModalProps {
  type: 'movie' | 'series'
  title: string
  year?: number
  posterUrl?: string
  searchQuery: string
  setSearchQuery: (query: string) => void
  suggestions: TMDBResult[]
  searching: boolean
  saving: boolean
  onSearch: () => void
  onSelect: (tmdbId: number) => void
  onClose: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PosterEditModal({
  type,
  title,
  year,
  posterUrl,
  searchQuery,
  setSearchQuery,
  suggestions,
  searching,
  saving,
  onSearch,
  onSelect,
  onClose,
}: PosterEditModalProps) {
  const hasPoster = posterUrl && !posterUrl.includes('placeholder')
  const placeholder = type === 'movie' ? 'Titre du film...' : 'Titre de la série...'
  const emptyLabel = type === 'movie'
    ? 'Recherchez le film pour voir les suggestions'
    : 'Recherchez la série pour voir les suggestions'

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose}>
          <X size={20} />
        </button>

        <div className={styles.modalGrid}>
          {/* Affiche actuelle */}
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Affiche actuelle</h3>
            <div style={{ borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
              {hasPoster ? (
                <Image
                  src={posterUrl!}
                  alt={title}
                  width={280}
                  height={420}
                  unoptimized
                  style={{ width: '100%', height: 'auto' }}
                />
              ) : (
                <div style={{ aspectRatio: '2/3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                  <ImageIcon size={48} />
                </div>
              )}
            </div>
            <div style={{ marginTop: 16, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>{title}</h4>
              {year && <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{year}</p>}
            </div>
          </div>

          {/* Recherche TMDB */}
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Rechercher sur TMDB</h3>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <input
                type="text"
                placeholder={placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && onSearch()}
                className={styles.searchInput}
                style={{ flex: 1 }}
              />
              <button
                className={styles.btnPrimary}
                onClick={onSearch}
                disabled={searching || !searchQuery}
              >
                {searching ? <RefreshCw size={16} className={styles.spin} /> : <Search size={16} />}
                Rechercher
              </button>
            </div>

            {/* Résultats TMDB */}
            {suggestions.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, maxHeight: 400, overflowY: 'auto' }}>
                {suggestions.map((result) => {
                  const displayTitle = type === 'series'
                    ? (result.name || result.title)
                    : result.title
                  const displayDate = type === 'series'
                    ? (result.first_air_date ? new Date(result.first_air_date).getFullYear() : 'N/A')
                    : new Date(result.release_date).getFullYear()

                  return (
                    <div
                      key={result.id}
                      onClick={() => onSelect(result.id)}
                      style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8, transition: 'all 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    >
                      {result.poster_path ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w300${result.poster_path}`}
                          alt={displayTitle}
                          width={120}
                          height={180}
                          unoptimized
                          style={{ width: '100%', height: 'auto', borderRadius: 4 }}
                        />
                      ) : (
                        <div style={{ aspectRatio: '2/3', background: 'rgba(255,255,255,0.05)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <X size={24} color="rgba(255,255,255,0.3)" />
                        </div>
                      )}
                      <p style={{ margin: '8px 0 4px', fontSize: 12, fontWeight: 500 }}>{displayTitle}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{displayDate}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* État vide */}
            {suggestions.length === 0 && !searching && (
              <div className={styles.empty}>
                <Search size={32} />
                <p className={styles.emptyText}>{emptyLabel}</p>
              </div>
            )}
          </div>
        </div>

        {/* Overlay de sauvegarde */}
        {saving && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, borderRadius: 16 }}>
            <RefreshCw size={32} className={styles.spin} />
            <p style={{ margin: 0 }}>Validation en cours...</p>
          </div>
        )}
      </div>
    </div>
  )
}
