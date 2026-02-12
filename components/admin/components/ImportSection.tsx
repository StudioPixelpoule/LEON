'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Film,
  Search,
  RefreshCw,
  Upload,
  Check,
  AlertCircle,
  FileVideo
} from 'lucide-react'
import styles from '@/app/admin/admin.module.css'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TMDBResult {
  id: number
  title: string
  year: number | null
  poster_url: string | null
  overview: string
  vote_average: number
}

interface UnimportedFile {
  filename: string
  filepath: string
  cleanName: string
  year: number | null
}

interface ImportResult {
  success: boolean
  message?: string
  error?: string
  film?: { title?: string }
}

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Section d'import manuel : import par chemin, recherche TMDB,
 * et liste des fichiers non importés.
 * Gère son propre état interne (auto-contenu).
 */
export function ImportSection() {
  const [showImport, setShowImport] = useState(false)
  const [importPath, setImportPath] = useState('')
  const [importQuery, setImportQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const [searchingTMDB, setSearchingTMDB] = useState(false)
  const [tmdbResults, setTmdbResults] = useState<TMDBResult[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [unimportedFiles, setUnimportedFiles] = useState<UnimportedFile[]>([])
  const [loadingUnimported, setLoadingUnimported] = useState(false)

  async function loadUnimportedFiles() {
    setLoadingUnimported(true)
    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'list-unimported' }),
        credentials: 'include'
      })
      const data = await response.json()
      if (data.files) {
        setUnimportedFiles(data.files)
      }
    } catch (error) {
      console.error('[IMPORT] Erreur chargement fichiers:', error)
    } finally {
      setLoadingUnimported(false)
    }
  }

  async function searchTMDB(query: string) {
    if (!query.trim()) return
    setSearchingTMDB(true)
    setTmdbResults([])
    try {
      const response = await fetch(`/api/import?query=${encodeURIComponent(query)}`, { credentials: 'include' })
      const data = await response.json()
      if (data.results) {
        setTmdbResults(data.results)
      }
    } catch (error) {
      console.error('[IMPORT] Erreur recherche TMDB:', error)
    } finally {
      setSearchingTMDB(false)
    }
  }

  async function handleImportByPath() {
    if (!importPath.trim()) return
    setImporting(true)
    setImportResult(null)
    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'filepath', filepath: importPath }),
        credentials: 'include'
      })
      const data = await response.json()
      setImportResult(data)
      if (data.success) {
        setImportPath('')
        loadUnimportedFiles()
      }
    } catch {
      setImportResult({ success: false, error: 'Erreur lors de l\'import' })
    } finally {
      setImporting(false)
    }
  }

  async function handleImportWithTMDB(filepath: string, tmdbId: number) {
    setImporting(true)
    setImportResult(null)
    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'tmdb', filepath, tmdbId }),
        credentials: 'include'
      })
      const data = await response.json()
      setImportResult(data)
      if (data.success) {
        setTmdbResults([])
        setImportQuery('')
        setImportPath('')
        loadUnimportedFiles()
      }
    } catch {
      setImportResult({ success: false, error: 'Erreur lors de l\'import' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>
          <Upload size={20} />
        </div>
        <h3 className={styles.cardTitle}>Import manuel</h3>
        <button 
          className={styles.btnSecondary}
          onClick={() => {
            setShowImport(!showImport)
            if (!showImport) loadUnimportedFiles()
          }}
          style={{ marginLeft: 'auto' }}
        >
          {showImport ? 'Fermer' : 'Ouvrir'}
        </button>
      </div>
      
      {showImport && (
        <div style={{ marginTop: 16 }}>
          {/* Message résultat */}
          {importResult && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 8,
              marginBottom: 16,
              background: importResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${importResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              {importResult.success ? (
                <Check size={18} style={{ color: '#10b981' }} />
              ) : (
                <AlertCircle size={18} style={{ color: '#ef4444' }} />
              )}
              <span style={{ fontSize: 14 }}>
                {importResult.success 
                  ? `✅ ${importResult.film?.title} importé avec succès`
                  : importResult.error
                }
              </span>
            </div>
          )}

          {/* Import par chemin */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
              Chemin du fichier (relatif ou absolu)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={importPath}
                onChange={(e) => setImportPath(e.target.value)}
                placeholder="/leon/media/films/MonFilm.mkv"
                className={styles.input}
                style={{ flex: 1 }}
              />
              <button
                className={styles.btnPrimary}
                onClick={handleImportByPath}
                disabled={importing || !importPath.trim()}
              >
                {importing ? <RefreshCw size={16} className={styles.spin} /> : <Upload size={16} />}
                Importer
              </button>
            </div>
          </div>

          {/* Recherche TMDB pour association manuelle */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
              Rechercher sur TMDB (pour forcer une correspondance)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={importQuery}
                onChange={(e) => setImportQuery(e.target.value)}
                placeholder="Nom du film..."
                className={styles.input}
                style={{ flex: 1 }}
                onKeyDown={(e) => e.key === 'Enter' && searchTMDB(importQuery)}
              />
              <button
                className={styles.btnSecondary}
                onClick={() => searchTMDB(importQuery)}
                disabled={searchingTMDB || !importQuery.trim()}
              >
                {searchingTMDB ? <RefreshCw size={16} className={styles.spin} /> : <Search size={16} />}
                Rechercher
              </button>
            </div>
          </div>

          {/* Résultats TMDB */}
          {tmdbResults.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
                Sélectionnez un film puis cliquez sur &quot;Associer&quot; :
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                {tmdbResults.map((movie) => (
                  <div 
                    key={movie.id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: 12,
                      background: '#1a1a1a',
                      borderRadius: 8,
                      alignItems: 'center'
                    }}
                  >
                    {movie.poster_url ? (
                      <Image 
                        src={movie.poster_url} 
                        alt={movie.title}
                        width={40}
                        height={60}
                        style={{ borderRadius: 4, objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: 40, height: 60, background: '#2a2a2a', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Film size={16} style={{ opacity: 0.3 }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 500, fontSize: 14 }}>{movie.title}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                        {movie.year || 'Date inconnue'} • ⭐ {movie.vote_average?.toFixed(1)}
                      </p>
                    </div>
                    <button
                      className={styles.btnPrimary}
                      onClick={() => {
                        if (importPath.trim()) {
                          handleImportWithTMDB(importPath, movie.id)
                        } else {
                          alert('Entrez d\'abord le chemin du fichier')
                        }
                      }}
                      disabled={importing || !importPath.trim()}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      Associer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fichiers non importés */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                Fichiers non importés ({unimportedFiles.length})
              </p>
              <button
                className={styles.btnSecondary}
                onClick={loadUnimportedFiles}
                disabled={loadingUnimported}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                {loadingUnimported ? <RefreshCw size={14} className={styles.spin} /> : <RefreshCw size={14} />}
                Rafraîchir
              </button>
            </div>
            
            {unimportedFiles.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {unimportedFiles.map((file, idx) => (
                  <div 
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '10px 12px',
                      background: '#141414',
                      borderRadius: 6,
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                    onClick={() => setImportPath(file.filepath)}
                  >
                    <FileVideo size={16} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {file.cleanName}
                        {file.year && <span style={{ color: 'rgba(255,255,255,0.5)' }}> ({file.year})</span>}
                      </p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {file.filename}
                      </p>
                    </div>
                    <button
                      className={styles.btnSecondary}
                      onClick={(e) => {
                        e.stopPropagation()
                        setImportPath(file.filepath)
                        handleImportByPath()
                      }}
                      style={{ padding: '4px 10px', fontSize: 12 }}
                    >
                      Import auto
                    </button>
                  </div>
                ))}
              </div>
            ) : loadingUnimported ? (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 20 }}>
                Chargement...
              </p>
            ) : (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 20 }}>
                ✅ Tous les fichiers sont importés
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
