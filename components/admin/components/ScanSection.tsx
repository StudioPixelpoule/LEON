import {
  Film,
  Tv,
  Search,
  RefreshCw,
  Trash2,
  Eye
} from 'lucide-react'
import styles from '@/app/admin/admin.module.css'
import type {
  FilmScanResult,
  SeriesScanResult,
  SeriesScanProgress,
  CleanupResult
} from '../hooks/useMediaScan'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScanSectionProps {
  scanningFilms: boolean
  filmResult: FilmScanResult | null
  onScanFilms: () => void
  scanningSeries: boolean
  seriesResult: SeriesScanResult | null
  seriesScanProgress: SeriesScanProgress | null
  onScanSeries: () => void
  cleaningUp: boolean
  cleanupResult: CleanupResult | null
  onCleanup: () => void
}

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Section de scan : bannière info, scan films, scan séries et nettoyage.
 * Composant de présentation pure (pas de state interne).
 */
export function ScanSection({
  scanningFilms,
  filmResult,
  onScanFilms,
  scanningSeries,
  seriesResult,
  seriesScanProgress,
  onScanSeries,
  cleaningUp,
  cleanupResult,
  onCleanup
}: ScanSectionProps) {
  return (
    <>
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
            onClick={onScanFilms}
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
            onClick={onScanSeries}
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
            onClick={onCleanup}
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
    </>
  )
}
