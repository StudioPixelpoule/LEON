/**
 * Composant d'affichage des résultats du scan intelligent
 * Affiche les statistiques détaillées après chaque scan
 */

'use client'

import styles from './ScanResult.module.css'

export interface ScanStats {
  total: number
  new: number
  updated: number
  skipped: number
  deleted: number
  errors: number
  identificationRate: number
  confidence?: {
    high: number
    medium: number
    low: number
  }
  unidentified?: number
}

interface ScanResultProps {
  stats: ScanStats
  onClose?: () => void
}

export function ScanResult({ stats, onClose }: ScanResultProps) {
  const totalProcessed = stats.new + stats.updated
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>✅ Scan terminé</h3>
        {onClose && (
          <button className={styles.closeButton} onClick={onClose} aria-label="Fermer">
            ×
          </button>
        )}
      </div>
      
      {/* Statistiques principales */}
      <div className={styles.mainStats}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📁</div>
          <div className={styles.statValue}>{stats.total}</div>
          <div className={styles.statLabel}>Fichiers scannés</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🆕</div>
          <div className={styles.statValue}>{stats.new}</div>
          <div className={styles.statLabel}>Nouveaux</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🔄</div>
          <div className={styles.statValue}>{stats.updated}</div>
          <div className={styles.statLabel}>Mis à jour</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statValue}>{stats.skipped}</div>
          <div className={styles.statLabel}>Déjà à jour</div>
        </div>
        
        {stats.deleted > 0 && (
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🗑️</div>
            <div className={styles.statValue}>{stats.deleted}</div>
            <div className={styles.statLabel}>Supprimés</div>
          </div>
        )}
        
        {stats.errors > 0 && (
          <div className={`${styles.statCard} ${styles.error}`}>
            <div className={styles.statIcon}>❌</div>
            <div className={styles.statValue}>{stats.errors}</div>
            <div className={styles.statLabel}>Erreurs</div>
          </div>
        )}
      </div>
      
      {/* Taux d'identification */}
      {totalProcessed > 0 && (
        <div className={styles.identification}>
          <div className={styles.identificationHeader}>
            <span className={styles.identificationLabel}>Taux d&apos;identification</span>
            <span className={styles.identificationValue}>{stats.identificationRate}%</span>
          </div>
          
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ width: `${stats.identificationRate}%` }}
            />
          </div>
          
          {stats.confidence && (
            <div className={styles.confidenceBreakdown}>
              <div className={styles.confidenceItem}>
                <span className={styles.confidenceDot} style={{ backgroundColor: '#22c55e' }} />
                <span className={styles.confidenceLabel}>Haute</span>
                <span className={styles.confidenceCount}>{stats.confidence.high}</span>
              </div>
              <div className={styles.confidenceItem}>
                <span className={styles.confidenceDot} style={{ backgroundColor: '#f59e0b' }} />
                <span className={styles.confidenceLabel}>Moyenne</span>
                <span className={styles.confidenceCount}>{stats.confidence.medium}</span>
              </div>
              <div className={styles.confidenceItem}>
                <span className={styles.confidenceDot} style={{ backgroundColor: '#ef4444' }} />
                <span className={styles.confidenceLabel}>Faible</span>
                <span className={styles.confidenceCount}>{stats.confidence.low}</span>
              </div>
            </div>
          )}
          
          {stats.unidentified && stats.unidentified > 0 && (
            <div className={styles.unidentified}>
              ⚠️ {stats.unidentified} film{stats.unidentified > 1 ? 's' : ''} non identifié{stats.unidentified > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
      
      {/* Message de synthèse */}
      <div className={styles.summary}>
        {stats.new === 0 && stats.updated === 0 && stats.deleted === 0 ? (
          <p>Aucune modification détectée. Tous les fichiers sont déjà à jour ! 🎉</p>
        ) : (
          <p>
            La bibliothèque a été mise à jour avec succès.
            {stats.deleted > 0 && ` ${stats.deleted} fichier${stats.deleted > 1 ? 's' : ''} supprimé${stats.deleted > 1 ? 's' : ''}.`}
          </p>
        )}
      </div>
    </div>
  )
}

