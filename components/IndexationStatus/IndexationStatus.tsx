/**
 * Dashboard de statut d'indexation
 * Affiche les métriques de reconnaissance intelligente
 */

'use client'

import styles from './IndexationStatus.module.css'

export interface IndexationStats {
  total: number
  identified: number
  unidentified: number
  highConfidence: number
  mediumConfidence: number
  lowConfidence: number
  withSubtitles: number
  avgConfidence: number
}

interface IndexationStatusProps {
  stats: IndexationStats
  onViewUnidentified?: () => void
}

export function IndexationStatus({ stats, onViewUnidentified }: IndexationStatusProps) {
  const identificationRate = stats.total > 0 
    ? Math.round((stats.identified / stats.total) * 100)
    : 0
  
  const subtitleRate = stats.total > 0
    ? Math.round((stats.withSubtitles / stats.total) * 100)
    : 0
  
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Statut de l&apos;indexation</h3>
      
      {/* Statistiques principales */}
      <div className={styles.mainStats}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.total}</div>
          <div className={styles.statLabel}>Fichiers totaux</div>
        </div>
        
        <div className={styles.stat}>
          <div className={styles.statValue}>
            {stats.identified}
            <span className={styles.statPercent}>({identificationRate}%)</span>
          </div>
          <div className={styles.statLabel}>Identifiés</div>
        </div>
        
        {stats.unidentified > 0 && (
          <div className={styles.stat}>
            <div className={styles.statValue}>
              {stats.unidentified}
            </div>
            <div className={styles.statLabel}>
              À valider
              {onViewUnidentified && (
                <button 
                  className={styles.viewButton}
                  onClick={onViewUnidentified}
                >
                  Voir
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Répartition par confiance */}
      {stats.identified > 0 && (
        <div className={styles.confidence}>
          <h4 className={styles.confidenceTitle}>
            Niveau de confiance moyen : {Math.round(stats.avgConfidence)}%
          </h4>
          
          <div className={styles.confidenceBar}>
            <div 
              className={`${styles.confidenceSegment} ${styles.high}`}
              style={{ width: `${(stats.highConfidence / stats.identified) * 100}%` }}
              title={`${stats.highConfidence} films - Haute confiance (>80%)`}
            />
            <div 
              className={`${styles.confidenceSegment} ${styles.medium}`}
              style={{ width: `${(stats.mediumConfidence / stats.identified) * 100}%` }}
              title={`${stats.mediumConfidence} films - Confiance moyenne (60-80%)`}
            />
            <div 
              className={`${styles.confidenceSegment} ${styles.low}`}
              style={{ width: `${(stats.lowConfidence / stats.identified) * 100}%` }}
              title={`${stats.lowConfidence} films - Faible confiance (<60%)`}
            />
          </div>
          
          <div className={styles.confidenceLegend}>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.high}`}></span>
              <span className={styles.legendLabel}>
                Haute ({stats.highConfidence})
              </span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.medium}`}></span>
              <span className={styles.legendLabel}>
                Moyenne ({stats.mediumConfidence})
              </span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.low}`}></span>
              <span className={styles.legendLabel}>
                Faible ({stats.lowConfidence})
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Sous-titres */}
      {stats.withSubtitles > 0 && (
        <div className={styles.subtitles}>
          <div className={styles.subtitleStat}>
            <span className={styles.subtitleValue}>{stats.withSubtitles}</span>
            <span className={styles.subtitleLabel}>
              films avec sous-titres ({subtitleRate}%)
            </span>
          </div>
        </div>
      )}
    </div>
  )
}




