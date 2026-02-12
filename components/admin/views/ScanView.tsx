'use client'

import styles from '@/app/admin/admin.module.css'
import { useMediaScan } from '@/components/admin/hooks/useMediaScan'
import { ScanSection } from '@/components/admin/components/ScanSection'
import { ImportSection } from '@/components/admin/components/ImportSection'

/**
 * Vue principale de scan des médias.
 * Orchestre les sections de scan (films, séries, nettoyage) et d'import manuel.
 */
export function ScanView() {
  const {
    scanningFilms,
    filmResult,
    handleScanFilms,
    scanningSeries,
    seriesResult,
    seriesScanProgress,
    handleScanSeries,
    cleaningUp,
    cleanupResult,
    handleCleanup
  } = useMediaScan()

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

      <ScanSection
        scanningFilms={scanningFilms}
        filmResult={filmResult}
        onScanFilms={handleScanFilms}
        scanningSeries={scanningSeries}
        seriesResult={seriesResult}
        seriesScanProgress={seriesScanProgress}
        onScanSeries={handleScanSeries}
        cleaningUp={cleaningUp}
        cleanupResult={cleanupResult}
        onCleanup={handleCleanup}
      />

      <ImportSection />
    </div>
  )
}
