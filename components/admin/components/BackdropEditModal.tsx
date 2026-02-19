'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { X, RefreshCw, ImageIcon } from 'lucide-react'
import styles from '@/app/admin/admin.module.css'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BackdropOption {
  url: string
  thumbnail: string
  width: number
  height: number
  voteAverage: number
  language: string | null
}

interface BackdropEditModalProps {
  tmdbId: number
  type: 'movie' | 'series'
  title: string
  currentBackdropUrl?: string
  onSelect: (url: string) => void
  onClose: () => void
}

// ─── Composant ───────────────────────────────────────────────────────────────

export function BackdropEditModal({
  tmdbId,
  type,
  title,
  currentBackdropUrl,
  onSelect,
  onClose,
}: BackdropEditModalProps) {
  const [backdrops, setBackdrops] = useState<BackdropOption[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const loadBackdrops = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/admin/tmdb-images?tmdbId=${tmdbId}&type=${type}`,
        { credentials: 'include' }
      )
      const data = await response.json()
      if (data.success) {
        setBackdrops(data.backdrops)
      }
    } catch (error) {
      console.error('[BACKDROP] Erreur chargement:', error)
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [tmdbId, type])

  if (!loaded && !loading) {
    loadBackdrops()
  }

  const hasCurrentBackdrop = currentBackdropUrl && !currentBackdropUrl.includes('placeholder')

  return (
    <div className={styles.modal} onClick={onClose}>
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 800 }}
      >
        <button className={styles.modalClose} onClick={onClose}>
          <X size={20} />
        </button>

        <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Choisir le backdrop</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          {title} — {backdrops.length} image{backdrops.length !== 1 ? 's' : ''} disponible{backdrops.length !== 1 ? 's' : ''} sur TMDB
        </p>

        {/* Backdrop actuel */}
        {hasCurrentBackdrop && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Actuel
            </p>
            <div style={{ borderRadius: 8, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)', maxWidth: 400 }}>
              <Image
                src={currentBackdropUrl!}
                alt="Backdrop actuel"
                width={400}
                height={225}
                unoptimized
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
          </div>
        )}

        {/* Grille de sélection */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <RefreshCw size={28} className={styles.spin} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <p style={{ margin: '12px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              Chargement des images TMDB...
            </p>
          </div>
        ) : backdrops.length > 0 ? (
          <>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Choisir un nouveau backdrop
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240, 1fr))',
              gap: 12,
              maxHeight: 420,
              overflowY: 'auto',
              paddingRight: 4,
            }}>
              {backdrops.map((backdrop, index) => {
                const isSelected = backdrop.url === currentBackdropUrl
                return (
                  <div
                    key={index}
                    onClick={() => {
                      if (!isSelected) onSelect(backdrop.url)
                    }}
                    style={{
                      cursor: isSelected ? 'default' : 'pointer',
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: isSelected
                        ? '2px solid white'
                        : '2px solid transparent',
                      opacity: isSelected ? 0.5 : 1,
                      transition: 'all 0.15s',
                      background: 'rgba(255,255,255,0.03)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.border = '2px solid rgba(255,255,255,0.4)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.border = '2px solid transparent'
                    }}
                  >
                    <Image
                      src={backdrop.thumbnail!}
                      alt={`Backdrop ${index + 1}`}
                      width={400}
                      height={225}
                      unoptimized
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                    <div style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      <span>{backdrop.width}x{backdrop.height}</span>
                      {backdrop.language && <span>{backdrop.language.toUpperCase()}</span>}
                      {isSelected && <span style={{ color: 'white', fontWeight: 600 }}>Actuel</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <ImageIcon size={32} style={{ color: 'rgba(255,255,255,0.2)' }} />
            <p style={{ margin: '12px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              Aucun backdrop disponible sur TMDB
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
