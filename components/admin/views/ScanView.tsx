'use client'

import { useState } from 'react'
import Image from 'next/image'
import { 
  Film, 
  Tv, 
  Search, 
  RefreshCw, 
  Trash2, 
  Upload, 
  Eye, 
  Check, 
  AlertCircle, 
  FileVideo
} from 'lucide-react'
import styles from '@/app/admin/admin.module.css'
import { useAdminToast } from '@/components/admin/Toast/Toast'

export function ScanView() {
  const [scanningFilms, setScanningFilms] = useState(false)
  const [scanningSeries, setScanningSeries] = useState(false)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [filmResult, setFilmResult] = useState<{ stats?: { total?: number; new?: number; updated?: number } } | null>(null)
  const [seriesResult, setSeriesResult] = useState<{ stats?: { totalSeries?: number; newSeries?: number; totalEpisodes?: number; newEpisodes?: number; enrichedEpisodes?: number } } | null>(null)
  const [cleanupResult, setCleanupResult] = useState<{ result?: { checked?: number; missing?: number; deleted?: number; details?: Array<{ title: string }> } } | null>(null)
  const [seriesScanProgress, setSeriesScanProgress] = useState<{
    currentSeries: string | null
    processedSeries: number
    totalSeries: number
  } | null>(null)
  
  // Import
  const [showImport, setShowImport] = useState(false)
  const [importPath, setImportPath] = useState('')
  const [importQuery, setImportQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const [searchingTMDB, setSearchingTMDB] = useState(false)
  const [tmdbResults, setTmdbResults] = useState<Array<{
    id: number
    title: string
    year: number | null
    poster_url: string | null
    overview: string
    vote_average: number
  }>>([])
  const [importResult, setImportResult] = useState<{ success: boolean; message?: string; error?: string; film?: any } | null>(null)
  const [unimportedFiles, setUnimportedFiles] = useState<Array<{ filename: string; filepath: string; cleanName: string; year: number | null }>>([])
  const [loadingUnimported, setLoadingUnimported] = useState(false)

  async function handleScanFilms() {
    setScanningFilms(true)
    setFilmResult(null)
    try {
      const response = await fetch('/api/scan', { method: 'POST', credentials: 'include' })
      const data = await response.json()
      setFilmResult(data)
    } catch (error) {
      console.error('Erreur scan films:', error)
      alert('Erreur lors du scan des films')
    } finally {
      setScanningFilms(false)
    }
  }

  async function handleScanSeries() {
    setScanningSeries(true)
    setSeriesResult(null)
    setSeriesScanProgress(null)
    
    try {
      // Lancer le scan en mode background pour éviter le timeout Cloudflare
      const response = await fetch('/api/scan-series?background=true', { method: 'POST', credentials: 'include' })
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Erreur lors du lancement du scan')
      }
      
      // Polling pour suivre la progression
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch('/api/scan-series')
          const statusData = await statusResponse.json()
          
          if (statusData.scan) {
            // Mettre à jour la progression
            setSeriesScanProgress({
              currentSeries: statusData.scan.currentSeries,
              processedSeries: statusData.scan.progress?.processedSeries || 0,
              totalSeries: statusData.scan.progress?.totalSeries || 0
            })
            
            // Si le scan est terminé
            if (!statusData.scan.isRunning) {
              clearInterval(pollInterval)
              setScanningSeries(false)
              setSeriesScanProgress(null)
              
              if (statusData.scan.error) {
                alert(`Erreur: ${statusData.scan.error}`)
              } else {
                setSeriesResult({ stats: statusData.scan.stats })
              }
            }
          }
        } catch (pollError) {
          console.error('Erreur polling:', pollError)
        }
      }, 2000) // Poll toutes les 2 secondes
      
    } catch (error) {
      console.error('Erreur scan séries:', error)
      alert('Erreur lors du scan des séries')
      setScanningSeries(false)
    }
  }

  async function handleCleanup() {
    if (!confirm('Supprimer les médias dont le fichier n\'existe plus sur le disque ?')) return
    
    setCleaningUp(true)
    setCleanupResult(null)
    try {
      const response = await fetch('/api/admin/cleanup-missing', { method: 'POST', credentials: 'include' })
      const data = await response.json()
      setCleanupResult(data)
    } catch (error) {
      console.error('Erreur nettoyage:', error)
      alert('Erreur lors du nettoyage')
    } finally {
      setCleaningUp(false)
    }
  }

  // Import functions
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
      console.error('Erreur chargement fichiers:', error)
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
      console.error('Erreur recherche TMDB:', error)
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
    } catch (error) {
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
    } catch (error) {
      setImportResult({ success: false, error: 'Erreur lors de l\'import' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.sectionTitle}>Scanner les médias</h1>
          <p className={styles.sectionDesc}>
            Analyser les dossiers pour détecter les nouveaux films et séries TV
          </p>
        </div>
      </div>

      {/* Info automatisation */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14
      }}>
        <Eye size={24} style={{ color: '#22c55e', flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: '#22c55e', marginBottom: 6, fontSize: 15 }}>
            Surveillance automatique active
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.5 }}>
            LEON détecte automatiquement les nouveaux fichiers ajoutés au NAS et les importe avec leurs métadonnées TMDB.
            Les scans manuels ci-dessous ne sont nécessaires que pour :
          </p>
          <ul style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '8px 0 0', paddingLeft: 20 }}>
            <li>Premier import d&apos;une bibliothèque existante</li>
            <li>Réindexation complète après un problème</li>
            <li>Forcer la mise à jour des métadonnées</li>
          </ul>
        </div>
      </div>

      {/* Scanner Films */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}>
            <Film size={20} />
          </div>
          <h3 className={styles.cardTitle}>Films</h3>
          <span className={styles.cardBadge}>/media/films</span>
        </div>
        
        <div className={styles.actions}>
          <button
            className={styles.btnPrimary}
            onClick={handleScanFilms}
            disabled={scanningFilms}
          >
            {scanningFilms ? (
              <><RefreshCw size={16} className={styles.spin} /> Scan en cours...</>
            ) : (
              <><Search size={16} /> Scanner les films</>
            )}
          </button>
        </div>

        {filmResult && (
          <div className={styles.statsGrid} style={{ marginTop: 20 }}>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{filmResult.stats?.total || 0}</div>
              <div className={styles.statLabel}>Analysés</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{filmResult.stats?.new || 0}</div>
              <div className={styles.statLabel}>Nouveaux</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{filmResult.stats?.updated || 0}</div>
              <div className={styles.statLabel}>Mis à jour</div>
            </div>
          </div>
        )}
      </div>

      {/* Scanner Séries */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}>
            <Tv size={20} />
          </div>
          <h3 className={styles.cardTitle}>Séries TV</h3>
          <span className={styles.cardBadge}>/media/series</span>
        </div>
        
        <div className={styles.actions}>
          <button
            className={styles.btnPrimary}
            onClick={handleScanSeries}
            disabled={scanningSeries}
          >
            {scanningSeries ? (
              <><RefreshCw size={16} className={styles.spin} /> Scan en cours...</>
            ) : (
              <><Search size={16} /> Scanner les séries</>
            )}
          </button>
        </div>

        {/* Progression du scan en temps réel */}
        {scanningSeries && seriesScanProgress && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, opacity: 0.7 }}>
              <span>Progression</span>
              <span>{seriesScanProgress.processedSeries} / {seriesScanProgress.totalSeries}</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  background: '#22c55e', 
                  borderRadius: 2,
                  width: seriesScanProgress.totalSeries > 0 
                    ? `${(seriesScanProgress.processedSeries / seriesScanProgress.totalSeries) * 100}%` 
                    : '0%',
                  transition: 'width 0.3s ease'
                }} 
              />
            </div>
            {seriesScanProgress.currentSeries && (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6, fontStyle: 'italic' }}>
                {seriesScanProgress.currentSeries}
              </div>
            )}
          </div>
        )}

        {seriesResult && (
          <div className={styles.statsGrid} style={{ marginTop: 20 }}>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{seriesResult.stats?.totalSeries || 0}</div>
              <div className={styles.statLabel}>Séries</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{seriesResult.stats?.newSeries || 0}</div>
              <div className={styles.statLabel}>Nouvelles</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{seriesResult.stats?.totalEpisodes || 0}</div>
              <div className={styles.statLabel}>Épisodes</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{seriesResult.stats?.newEpisodes || 0}</div>
              <div className={styles.statLabel}>Nouveaux ép.</div>
            </div>
            {(seriesResult.stats?.enrichedEpisodes || 0) > 0 && (
              <div className={styles.statBox}>
                <div className={styles.statValue}>{seriesResult.stats?.enrichedEpisodes || 0}</div>
                <div className={styles.statLabel}>Enrichis</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nettoyage */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}>
            <Trash2 size={20} />
          </div>
          <h3 className={styles.cardTitle}>Nettoyage</h3>
        </div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px' }}>
          Supprimer de la base les médias dont le fichier n&apos;existe plus
        </p>
        
        <div className={styles.actions}>
          <button
            className={styles.btnDanger}
            onClick={handleCleanup}
            disabled={cleaningUp}
          >
            {cleaningUp ? (
              <><RefreshCw size={16} className={styles.spin} /> Nettoyage...</>
            ) : (
              <><Trash2 size={16} /> Nettoyer les fichiers manquants</>
            )}
          </button>
        </div>

        {cleanupResult && (
          <div className={styles.statsGrid} style={{ marginTop: 20 }}>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{cleanupResult.result?.checked || 0}</div>
              <div className={styles.statLabel}>Vérifiés</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{cleanupResult.result?.missing || 0}</div>
              <div className={styles.statLabel}>Manquants</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{cleanupResult.result?.deleted || 0}</div>
              <div className={styles.statLabel}>Supprimés</div>
            </div>
          </div>
        )}
      </div>

      {/* Import manuel */}
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
    </div>
  )
}
