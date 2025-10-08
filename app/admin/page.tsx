/**
 * Page d'administration avec rapport détaillé du scan
 */

'use client'

import { useState } from 'react'
import styles from './admin.module.css'

interface ProcessedFile {
  filename: string
  filepath: string
  status: 'new' | 'updated' | 'skipped' | 'error' | 'unidentified' | 'deleted'
  tmdbMatch?: {
    title: string
    year: number
    confidence: number
    tmdbId: number
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
  const [result, setResult] = useState<ScanResult | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'unidentified' | 'errors' | 'deleted' | 'duplicates'>('all')
  
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
      
      const data = await response.json()
      setResult(data)
      setActiveTab('all')
      
    } catch (error) {
      console.error('Erreur scan:', error)
    } finally {
      setScanning(false)
    }
  }
  
  const getFilteredFiles = () => {
    if (!result) return []
    
    const allFiles = [
      ...result.report.processed,
      ...result.report.deleted
    ]
    
    switch (activeTab) {
      case 'unidentified':
        return allFiles.filter(f => f.status === 'unidentified')
      case 'errors':
        return allFiles.filter(f => f.status === 'error')
      case 'deleted':
        return result.report.deleted
      default:
        return allFiles
    }
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return '🆕'
      case 'updated': return '🔄'
      case 'skipped': return '✅'
      case 'error': return '❌'
      case 'unidentified': return '❓'
      case 'deleted': return '🗑️'
      default: return '📄'
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
      default: return status
    }
  }
  
  const filteredFiles = getFilteredFiles()
  const unidentifiedCount = result?.report.processed.filter(f => f.status === 'unidentified').length || 0
  const errorsCount = result?.report.processed.filter(f => f.status === 'error').length || 0
  const duplicatesCount = result?.stats.duplicates || 0
  
  return (
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
              <a href="/admin/validate" className={styles.validateButton}>
                🔍 Validation manuelle
              </a>
              <button 
                onClick={handleScan} 
                disabled={scanning}
                className={styles.scanButton}
              >
                {scanning ? '⏳ Scan en cours...' : '🔄 Lancer le scan'}
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
                <div className={styles.statIcon}>📁</div>
                <div className={styles.statValue}>{result.stats.total}</div>
                <div className={styles.statLabel}>Fichiers scannés</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statIcon}>🆕</div>
                <div className={styles.statValue}>{result.stats.new}</div>
                <div className={styles.statLabel}>Nouveaux</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statIcon}>🔄</div>
                <div className={styles.statValue}>{result.stats.updated}</div>
                <div className={styles.statLabel}>Mis à jour</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statIcon}>✅</div>
                <div className={styles.statValue}>{result.stats.skipped}</div>
                <div className={styles.statLabel}>Déjà à jour</div>
              </div>
              
              {result.stats.deleted > 0 && (
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>🗑️</div>
                  <div className={styles.statValue}>{result.stats.deleted}</div>
                  <div className={styles.statLabel}>Supprimés</div>
                </div>
              )}
              
              {result.stats.errors > 0 && (
                <div className={`${styles.statCard} ${styles.error}`}>
                  <div className={styles.statIcon}>❌</div>
                  <div className={styles.statValue}>{result.stats.errors}</div>
                  <div className={styles.statLabel}>Erreurs</div>
                </div>
              )}
              
              {unidentifiedCount > 0 && (
                <div className={`${styles.statCard} ${styles.warning}`}>
                  <div className={styles.statIcon}>❓</div>
                  <div className={styles.statValue}>{unidentifiedCount}</div>
                  <div className={styles.statLabel}>Non identifiés</div>
                </div>
              )}
              
              {duplicatesCount > 0 && (
                <div className={`${styles.statCard} ${styles.warning}`}>
                  <div className={styles.statIcon}>👥</div>
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
                <h3 className={styles.reportTitle}>📊 Rapport détaillé</h3>
                
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
                          <span className={styles.duplicateIcon}>👥</span>
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
                            <div className={styles.duplicateFileIcon}>📄</div>
                            <div className={styles.duplicateFileInfo}>
                              <div className={styles.duplicateFileName}>{file.filename}</div>
                              <div className={styles.duplicateFilePath}>{file.filepath}</div>
                            </div>
                            <button
                              className={styles.revealButtonSmall}
                              onClick={() => handleRevealFile(file.filepath)}
                              title="Ouvrir dans le Finder"
                            >
                              📁
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className={styles.duplicateAction}>
                        💡 Conservez la meilleure version et supprimez les autres fichiers en local
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
                          <button
                            className={styles.revealButton}
                            onClick={() => handleRevealFile(file.filepath)}
                            title="Ouvrir dans le Finder"
                          >
                            📁 Finder
                          </button>
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
            {(unidentifiedCount > 0 || errorsCount > 0 || duplicatesCount > 0) && (
              <div className={styles.recommendations}>
                <h4 className={styles.recommendationsTitle}>💡 Actions recommandées</h4>
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
                      Utilisez l&apos;outil de <a href="/admin/validate">validation manuelle</a> pour rechercher 
                      manuellement sur TMDB et associer les bonnes métadonnées.
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
  )
}
