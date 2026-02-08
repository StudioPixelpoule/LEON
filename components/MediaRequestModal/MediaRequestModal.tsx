/**
 * MediaRequestModal - Modal de demande de films/séries
 * Recherche TMDB intégrée, multi-sélection, commentaire libre
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './MediaRequestModal.module.css'

interface TMDBResult {
  tmdb_id: number
  media_type: 'movie' | 'tv'
  title: string
  year: number | null
  poster_url: string | null
  overview: string | null
}

interface MediaRequestModalProps {
  isOpen: boolean
  onClose: () => void
}

export function MediaRequestModal({ isOpen, onClose }: MediaRequestModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TMDBResult[]>([])
  const [selected, setSelected] = useState<TMDBResult[]>([])
  const [comment, setComment] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      // Focus l'input après l'animation
      setTimeout(() => inputRef.current?.focus(), 300)
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Reset à la fermeture
  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setResults([])
      setSelected([])
      setComment('')
      setHasSearched(false)
      setShowSuccess(false)
    }
  }, [isOpen])

  // Recherche TMDB avec debounce 300ms
  const handleSearch = useCallback((value: string) => {
    setQuery(value)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (value.trim().length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(value.trim())}`)
        if (!res.ok) throw new Error('Erreur recherche')
        const data = await res.json()
        setResults(data.results || [])
        setHasSearched(true)
      } catch (error) {
        console.error('[REQUEST] Erreur recherche TMDB:', error)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [])

  // Toggle sélection
  const toggleSelect = useCallback((item: TMDBResult) => {
    setSelected(prev => {
      const exists = prev.find(s => s.tmdb_id === item.tmdb_id && s.media_type === item.media_type)
      if (exists) {
        return prev.filter(s => !(s.tmdb_id === item.tmdb_id && s.media_type === item.media_type))
      }
      return [...prev, item]
    })
  }, [])

  // Retirer une sélection
  const removeSelection = useCallback((item: TMDBResult) => {
    setSelected(prev => prev.filter(s => !(s.tmdb_id === item.tmdb_id && s.media_type === item.media_type)))
  }, [])

  // Vérifier si un item est sélectionné
  const isSelected = useCallback((item: TMDBResult) => {
    return selected.some(s => s.tmdb_id === item.tmdb_id && s.media_type === item.media_type)
  }, [selected])

  // Envoi de la demande
  const handleSubmit = useCallback(async () => {
    if (selected.length === 0 && comment.trim() === '') return

    setIsSending(true)
    try {
      const body = {
        items: selected.map(s => ({
          tmdb_id: s.tmdb_id,
          media_type: s.media_type,
          title: s.title,
          year: s.year,
          poster_url: s.poster_url
        })),
        comment: comment.trim() || undefined
      }

      const res = await fetch('/api/media-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) throw new Error('Erreur envoi')

      // Succès
      setShowSuccess(true)
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (error) {
      console.error('[REQUEST] Erreur envoi:', error)
    } finally {
      setIsSending(false)
    }
  }, [selected, comment, onClose])

  // Fermer avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleEscape)
      return () => window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const canSubmit = selected.length > 0 || comment.trim() !== ''

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div 
        className={`${styles.modal} ${isSending ? styles.sending : ''}`} 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Demander un film ou une série</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        {showSuccess ? (
          /* Message de succès */
          <div className={styles.body}>
            <div className={styles.successMessage}>
              <div className={styles.successIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <p className={styles.successText}>Demande envoyée !</p>
              <p className={styles.successSub}>
                {selected.length > 0 
                  ? `${selected.length} titre${selected.length > 1 ? 's' : ''} demandé${selected.length > 1 ? 's' : ''}`
                  : 'Votre message a été transmis'
                }
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Corps */}
            <div className={styles.body}>
              {/* Recherche TMDB */}
              <input
                ref={inputRef}
                type="text"
                className={styles.searchInput}
                placeholder="Rechercher un film ou une série..."
                value={query}
                onChange={e => handleSearch(e.target.value)}
              />

              {/* Résultats */}
              {isSearching && (
                <div className={styles.searchLoader}>Recherche en cours...</div>
              )}

              {!isSearching && hasSearched && results.length === 0 && (
                <div className={styles.noResults}>Aucun résultat pour &quot;{query}&quot;</div>
              )}

              {!isSearching && results.length > 0 && (
                <div className={styles.resultsGrid}>
                  {results.map(item => (
                    <div
                      key={`${item.media_type}-${item.tmdb_id}`}
                      className={`${styles.resultCard} ${isSelected(item) ? styles.resultCardSelected : ''}`}
                      onClick={() => toggleSelect(item)}
                    >
                      {item.poster_url ? (
                        <img
                          src={item.poster_url}
                          alt={item.title}
                          className={styles.resultPoster}
                          loading="lazy"
                        />
                      ) : (
                        <div className={styles.resultPosterPlaceholder}>
                          Pas d&apos;affiche
                        </div>
                      )}
                      <div className={styles.resultInfo}>
                        <p className={styles.resultTitle}>{item.title}</p>
                        <div className={styles.resultMeta}>
                          {item.year && <span className={styles.resultYear}>{item.year}</span>}
                          <span className={styles.resultBadge}>
                            {item.media_type === 'movie' ? 'Film' : 'Série'}
                          </span>
                        </div>
                      </div>
                      {isSelected(item) && (
                        <div className={styles.checkmark}>
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Sélections (chips) */}
              {selected.length > 0 && (
                <>
                  <p className={styles.selectionsLabel}>
                    {selected.length} sélectionné{selected.length > 1 ? 's' : ''}
                  </p>
                  <div className={styles.selections}>
                    {selected.map(item => (
                      <div key={`chip-${item.media_type}-${item.tmdb_id}`} className={styles.chip}>
                        {item.poster_url && (
                          <img src={item.poster_url} alt="" className={styles.chipPoster} />
                        )}
                        <span className={styles.chipTitle}>{item.title}</span>
                        <button
                          className={styles.chipRemove}
                          onClick={() => removeSelection(item)}
                          aria-label={`Retirer ${item.title}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Commentaire libre */}
              <textarea
                className={styles.textarea}
                placeholder="Un commentaire ? Un film introuvable sur TMDB ?"
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
              />
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <button
                className={styles.submitButton}
                onClick={handleSubmit}
                disabled={!canSubmit || isSending}
              >
                {isSending ? 'Envoi en cours...' : 'Envoyer la demande'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
