/**
 * Page d'administration avec rapport détaillé du scan
 */

'use client'

import { useState } from 'react'
import Header from '@/components/Header/Header'
import styles from './admin.module.css'

interface ProcessedFile {
  filename: string
  filepath: string
  status: 'new' | 'updated' | 'skipped' | 'error' | 'unidentified' | 'deleted' | 'no_poster'
  tmdbMatch?: {
    title: string
    year: number
    confidence: number
    tmdbId: number
    hasPoster: boolean
  }
  error?: string
  reason?: string
}

interface Duplicate {
  tmdbId: number
  title: string
  year: number
  count: number
  files: {
    filename: string
    filepath: string
    status: string
  }[]
}

interface ScanResult {
  success: boolean
  message: string
  stats: {
    total: number
    new: number
    updated: number
    skipped: number
    deleted: number
    errors: number
    identificationRate: number
    confidence: {
      high: number
      medium: number
      low: number
    }
    unidentified: number
    noPoster: number
    duplicates: number
  }
  report: {
    processed: ProcessedFile[]
    deleted: ProcessedFile[]
    duplicates: Duplicate[]
  }
}

export default function AdminPage() {
  const [scanning, setScanning] = useState(false)
  const [scanningSeries, setScanningSeries] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'unidentified' | 'errors' | 'deleted' | 'duplicates' | 'no_poster'>('all')
  
  async function handleRevealFile(filepath: string) {
    try {
      const response = await fetch('/api/reveal-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath })
      })
      
      const data = await response.json()
      
      if (!data.success) {
        alert('Erreur: ' + (data.error || 'Impossible d\'ouvrir le fichier'))
      }
    } catch (error) {
      console.error('Erreur révélation fichier:', error)
      alert('Erreur lors de l\'ouverture du fichier dans le Finder')
    }
  }
  
  async function handleScan() {
    try {
      setScanning(true)
      setResult(null)
      
      const response = await fetch('/api/scan', {
        method: 'POST'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        alert(`Erreur lors du scan: ${errorData.error || 'Erreur inconnue'}`)
        setScanning(false)
        return
      }
      
      const data = await response.json()
      
      // Vérifier que la structure est correcte
      if (!data.report || !data.report.processed) {
        alert('Erreur: Réponse du serveur invalide')
        setScanning(false)
        return
      }
      
      setResult(data)
      setActiveTab('all')
      
    } catch (error) {
      console.error('Erreur scan:', error)
      alert('Erreur lors du scan: ' + (error instanceof Error ? error.message : 'Erreur inconnue'))
    } finally {
      setScanning(false)
    }
  }
  
  async function handleScanSeries() {
    try {
      setScanningSeries(true)
      
      const response = await fetch('/api/scan-series', {
        method: 'POST'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        alert(`Erreur lors du scan des séries: ${errorData.error || 'Erreur inconnue'}`)
        setScanningSeries(false)
        return
      }
      
      const data = await response.json()
      alert(`✅ Scan terminé!\n${data.stats.totalSeries} séries • ${data.stats.totalEpisodes} épisodes`)
      
    } catch (error) {
      console.error('Erreur scan séries:', error)
      alert('Erreur lors du scan des séries')
    } finally {
      setScanningSeries(false)
    }
  }
  
  const getFilteredFiles = () => {
    if (!result || !result.report) return []
    
    const allFiles = [
      ...(result.report.processed || []),
      ...(result.report.deleted || [])
    ]
    
    switch (activeTab) {
      case 'unidentified':
        return allFiles.filter(f => f.status === 'unidentified')
      case 'errors':
        return allFiles.filter(f => f.status === 'error')
      case 'deleted':
        return result.report.deleted || []
      case 'no_poster':
        return allFiles.filter(f => f.status === 'no_poster')
      default:
        return allFiles
    }
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return '+'
      case 'updated': return '↻'
      case 'skipped': return '✓'
      case 'error': return '×'
      case 'unidentified': return '?'
      case 'deleted': return '−'
      case 'no_poster': return '□'
      default: return '·'
    }
  }
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'Nouveau'
      case 'updated': return 'Mis à jour'
      case 'skipped': return 'Déjà à jour'
      case 'error': return 'Erreur'
      case 'unidentified': return 'Non identifié'
      case 'deleted': return 'Supprimé'
      case 'no_poster': return 'Sans poster TMDB'
      default: return status
    }
  }
  
  const filteredFiles = getFilteredFiles()
  const unidentifiedCount = result?.report.processed.filter(f => f.status === 'unidentified').length || 0
  const errorsCount = result?.report.processed.filter(f => f.status === 'error').length || 0
  const noPosterCount = result?.stats.noPoster || 0
  const duplicatesCount = result?.stats.duplicates || 0
  
  return (
    <>
      <Header />
      
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>LEON - Administration</h1>
          <a href="/films" className={styles.backLink}>← Retour aux films</a>
        </header>
      
      <div className={styles.content}>
        {/* Section Scan */}
        <div className={styles.scanSection}>
          <div className={styles.scanHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Scan intelligent</h2>
              <p className={styles.sectionSubtitle}>
                Détecte automatiquement les nouveaux fichiers, les modifications et les suppressions
              </p>
            </div>
            <div className={styles.actions}>
              <a href="/admin/fix" className={styles.fixButton}>
                Corriger les problèmes
              </a>
              <a href="/admin/validate" className={styles.validateButton}>
                Validation Films
              </a>
              <a href="/admin/series" className={styles.validateButton}>
                Validation Séries
              </a>
              <a href="/admin/optimize" className={styles.validateButton}>
                Optimisation Locale
              </a>
              <button 
                onClick={async () => {
                  const res = await fetch('/api/cleanup-v2', { method: 'POST' })
                  const data = await res.json()
                  alert(data.message || 'Nettoyage effectué')
                }}
                className={styles.validateButton}
              >
                Nettoyer FFmpeg
              </button>
              <button 
                onClick={handleScan} 
                disabled={scanning}
                className={styles.scanButton}
              >
                {scanning ? 'Scan en cours...' : 'Scanner les films'}
              </button>
              <button 
                onClick={handleScanSeries} 
                disabled={scanningSeries}
                className={styles.scanButton}
              >
                {scanningSeries ? 'Scan en cours...' : 'Scanner les séries'}
              </button>
            </div>
          </div>
          
          {scanning && (
            <div className={styles.scanning}>
              <div className={styles.spinner}></div>
              <p>Analyse en cours... Cela peut prendre plusieurs minutes.</p>
            </div>
          )}
        </div>
        
        {/* Résultats du scan */}
        {result && (
          <>
            {/* Statistiques */}
            <div className={styles.stats}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{result.stats.total}</div>
                <div className={styles.statLabel}>Fichiers scannés</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statValue}>{result.stats.new}</div>
                <div className={styles.statLabel}>Nouveaux</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statValue}>{result.stats.updated}</div>
                <div className={styles.statLabel}>Mis à jour</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statValue}>{result.stats.skipped}</div>
                <div className={styles.statLabel}>Déjà à jour</div>
              </div>
              
              {result.stats.deleted > 0 && (
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{result.stats.deleted}</div>
                  <div className={styles.statLabel}>Supprimés</div>
                </div>
              )}
              
              {result.stats.errors > 0 && (
                <div className={`${styles.statCard} ${styles.error}`}>
                  <div className={styles.statValue}>{result.stats.errors}</div>
                  <div className={styles.statLabel}>Erreurs</div>
                </div>
              )}
              
              {unidentifiedCount > 0 && (
                <div className={`${styles.statCard} ${styles.warning}`}>
                  <div className={styles.statValue}>{unidentifiedCount}</div>
                  <div className={styles.statLabel}>Non identifiés</div>
                </div>
              )}
              
              {noPosterCount > 0 && (
                <div className={`${styles.statCard} ${styles.warning}`}>
                  <div className={styles.statValue}>{noPosterCount}</div>
                  <div className={styles.statLabel}>Sans poster TMDB</div>
                </div>
              )}
              
              {duplicatesCount > 0 && (
                <div className={`${styles.statCard} ${styles.warning}`}>
                  <div className={styles.statValue}>{duplicatesCount}</div>
                  <div className={styles.statLabel}>Doublons</div>
                </div>
              )}
            </div>
            
            {/* Taux d'identification */}
            <div className={styles.identification}>
              <div className={styles.identificationHeader}>
                <span className={styles.identificationLabel}>Taux d&apos;identification TMDB</span>
                <span className={styles.identificationValue}>{result.stats.identificationRate}%</span>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill}
                  style={{ width: `${result.stats.identificationRate}%` }}
                />
              </div>
              <div className={styles.confidenceBreakdown}>
                <div className={styles.confidenceItem}>
                  <span className={styles.confidenceDot} style={{ backgroundColor: '#22c55e' }} />
                  <span>Haute: {result.stats.confidence.high}</span>
                </div>
                <div className={styles.confidenceItem}>
                  <span className={styles.confidenceDot} style={{ backgroundColor: '#f59e0b' }} />
                  <span>Moyenne: {result.stats.confidence.medium}</span>
                </div>
                <div className={styles.confidenceItem}>
                  <span className={styles.confidenceDot} style={{ backgroundColor: '#ef4444' }} />
                  <span>Faible: {result.stats.confidence.low}</span>
                </div>
              </div>
            </div>
            
            {/* Rapport détaillé */}
            <div className={styles.report}>
              <div className={styles.reportHeader}>
                <h3 className={styles.reportTitle}>Rapport détaillé</h3>
                
                <div className={styles.tabs}>
                  <button 
                    className={activeTab === 'all' ? styles.tabActive : styles.tab}
                    onClick={() => setActiveTab('all')}
                  >
                    Tous ({result.report.processed.length + result.report.deleted.length})
                  </button>
                  {unidentifiedCount > 0 && (
                    <button 
                      className={activeTab === 'unidentified' ? styles.tabActive : styles.tab}
                      onClick={() => setActiveTab('unidentified')}
                    >
                      Non identifiés ({unidentifiedCount})
                    </button>
                  )}
                  {errorsCount > 0 && (
                    <button 
                      className={activeTab === 'errors' ? styles.tabActive : styles.tab}
                      onClick={() => setActiveTab('errors')}
                    >
                      Erreurs ({errorsCount})
                    </button>
                  )}
                  {noPosterCount > 0 && (
                    <button 
                      className={activeTab === 'no_poster' ? styles.tabActive : styles.tab}
                      onClick={() => setActiveTab('no_poster')}
                    >
                      Sans poster TMDB ({noPosterCount})
                    </button>
                  )}
                  {result.stats.deleted > 0 && (
                    <button 
                      className={activeTab === 'deleted' ? styles.tabActive : styles.tab}
                      onClick={() => setActiveTab('deleted')}
                    >
                      Supprimés ({result.stats.deleted})
                    </button>
                  )}
                  {duplicatesCount > 0 && (
                    <button 
                      className={activeTab === 'duplicates' ? styles.tabActive : styles.tab}
                      onClick={() => setActiveTab('duplicates')}
                    >
                      Doublons ({duplicatesCount})
                    </button>
                  )}
                </div>
              </div>
              
              <div className={styles.fileList}>
                {activeTab === 'duplicates' && result.report.duplicates.length > 0 ? (
                  // Affichage spécial pour les doublons
                  result.report.duplicates.map((duplicate, index) => (
                    <div key={index} className={styles.duplicateGroup}>
                      <div className={styles.duplicateHeader}>
                        <div className={styles.duplicateTitle}>
                          <span className={styles.duplicateIcon}>×2</span>
                          <span className={styles.duplicateName}>
                            {duplicate.title} {duplicate.year > 0 && `(${duplicate.year})`}
                          </span>
                          <span className={styles.duplicateCount}>
                            {duplicate.count} fichiers
                          </span>
                        </div>
                        <div className={styles.duplicateTmdb}>
                          TMDB ID: {duplicate.tmdbId}
                        </div>
                      </div>
                      <div className={styles.duplicateFiles}>
                        {duplicate.files.map((file, fileIndex) => (
                          <div key={fileIndex} className={styles.duplicateFile}>
                            <div className={styles.duplicateFileIcon}>·</div>
                            <div className={styles.duplicateFileInfo}>
                              <div className={styles.duplicateFileName}>{file.filename}</div>
                              <div className={styles.duplicateFilePath}>{file.filepath}</div>
                            </div>
                            <button
                              className={styles.revealButtonSmall}
                              onClick={() => handleRevealFile(file.filepath)}
                              title="Ouvrir dans le Finder"
                            >
                              Ouvrir
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className={styles.duplicateAction}>
                        Conservez la meilleure version et supprimez les autres fichiers en local
                      </div>
                    </div>
                  ))
                ) : filteredFiles.length === 0 ? (
                  <div className={styles.emptyState}>
                    Aucun fichier à afficher dans cette catégorie
                  </div>
                ) : (
                  filteredFiles.map((file, index) => (
                    <div key={index} className={styles.fileItem}>
                      <div className={styles.fileIcon}>
                        {getStatusIcon(file.status)}
                      </div>
                      
                      <div className={styles.fileInfo}>
                        <div className={styles.fileName}>{file.filename}</div>
                        <div className={styles.filePath}>{file.filepath}</div>
                        
                        {file.tmdbMatch && (
                          <div className={styles.tmdbMatch}>
                            <span className={styles.tmdbTitle}>
                              → {file.tmdbMatch.title}
                            </span>
                            {file.tmdbMatch.year > 0 && (
                              <span className={styles.tmdbYear}>({file.tmdbMatch.year})</span>
                            )}
                            <span className={styles.tmdbConfidence}>
                              {file.tmdbMatch.confidence}% confiance
                            </span>
                          </div>
                        )}
                        
                        {file.reason && (
                          <div className={styles.fileReason}>
                            <span className={styles.reasonLabel}>Raison:</span> {file.reason}
                          </div>
                        )}
                        
                        {file.error && (
                          <div className={styles.fileError}>
                            <span className={styles.errorLabel}>Erreur:</span> {file.error}
                          </div>
                        )}
                      </div>
                      
                      <div className={styles.fileActions}>
                        {/* Bouton pour ouvrir dans le Finder */}
                        {(file.status === 'unidentified' || file.status === 'error') && (
                          <>
                            <button
                              className={styles.revealButton}
                              onClick={() => handleRevealFile(file.filepath)}
                              title="Ouvrir dans le Finder"
                            >
                              Finder
                            </button>
                            <a
                              href="/admin/validate"
                              className={styles.validateLink}
                              title="Valider manuellement sur TMDB"
                            >
                              Valider
                            </a>
                          </>
                        )}
                        
                        <span className={`${styles.statusBadge} ${styles[file.status]}`}>
                          {getStatusLabel(file.status)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Actions recommandées */}
            {(unidentifiedCount > 0 || errorsCount > 0 || noPosterCount > 0 || duplicatesCount > 0) && (
              <div className={styles.recommendations}>
                <h4 className={styles.recommendationsTitle}>Actions recommandées</h4>
                <ul className={styles.recommendationsList}>
                  {duplicatesCount > 0 && (
                    <li>
                      <strong>{duplicatesCount} film(s) en double détecté(s)</strong>: 
                      Consultez l&apos;onglet &quot;Doublons&quot; pour voir quels fichiers correspondent au même film. 
                      Conservez la meilleure version (qualité, taille) et supprimez les autres dans votre dossier local.
                    </li>
                  )}
                  {unidentifiedCount > 0 && (
                    <li>
                      <strong>{unidentifiedCount} fichier(s) non identifié(s)</strong>: 
                      <ol style={{ marginTop: 'var(--spacing-xs)', paddingLeft: 'var(--spacing-lg)' }}>
                        <li>Cliquez sur <strong>Finder</strong> pour ouvrir et renommer le fichier</li>
                        <li>Format recommandé: <code>Titre du Film (Année).ext</code></li>
                        <li>Relancez le scan pour réindexer</li>
                        <li>Si toujours non trouvé: cliquez sur <strong>Valider</strong> pour une <a href="/admin/validate">validation manuelle</a> sur TMDB</li>
                      </ol>
                    </li>
                  )}
                  {noPosterCount > 0 && (
                    <li>
                      <strong>{noPosterCount} film(s) sans poster TMDB</strong>: 
                      Ces films sont correctement identifiés mais TMDB n&apos;a pas de jaquette dans leur base. 
                      Vous pouvez uploader une jaquette personnalisée via <a href="/admin/validate">validation manuelle</a>.
                    </li>
                  )}
                  {errorsCount > 0 && (
                    <li>
                      <strong>{errorsCount} erreur(s) détectée(s)</strong>: 
                      Vérifiez les messages d&apos;erreur ci-dessus et corrigez les problèmes identifiés.
                    </li>
                  )}
                  <li>
                    Vous pouvez renommer les fichiers pour améliorer la reconnaissance automatique. 
                    Format recommandé: <code>Titre du Film (Année).ext</code>
                  </li>
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </>
  )
}
