'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { RefreshCw, Film, Clock, HardDrive, Check, BarChart3 } from 'lucide-react'
import styles from '@/app/admin/admin.module.css'

interface DashboardStatsData {
  library: { totalMovies: number; totalSeries: number; totalDurationMinutes: number; averageDurationMinutes: number }
  posters: { withPosters: number; withoutPosters: number; validationRate: number }
  storage: { mediaSizeGB: number; transcodedSizeGB: number }
  transcoding: { completed: number; pending: number }
  genres: Array<{ name: string; count: number }>
  years: Array<{ year: number; count: number }>
  activity: { recentlyAdded: Array<{ id: string; title: string; poster_url: string | null; created_at: string }>; inProgress: Array<{ id: string; title: string; poster_url: string | null; progress: number }> }
}

export function StatsView() {
  const [stats, setStats] = useState<DashboardStatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const response = await fetch('/api/stats/dashboard')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Erreur chargement stats:', error)
    } finally {
      setLoading(false)
    }
  }

  function formatDuration(min: number): string {
    if (min < 60) return `${min}min`
    const h = Math.floor(min / 60)
    if (h < 24) return `${h}h`
    const d = Math.floor(h / 24)
    return `${d}j ${h % 24}h`
  }

  if (loading) {
    return (
      <div className={styles.section}>
        <div className={styles.loading}>
          <RefreshCw size={32} className={styles.spin} />
          <p className={styles.loadingText}>Chargement...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className={styles.section}>
        <div className={styles.error}>
          <p className={styles.errorText}>Impossible de charger les statistiques</p>
          <button className={styles.btnSecondary} onClick={loadStats}><RefreshCw size={16} /> Réessayer</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.sectionTitle}>Statistiques</h1>
          <p className={styles.sectionDesc}>Vue d&apos;ensemble de votre bibliothèque</p>
        </div>
        <button className={styles.btnIcon} onClick={loadStats}><RefreshCw size={18} /></button>
      </div>

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.green}`}><Film size={24} /></div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats.library.totalMovies}</span>
            <span className={styles.kpiLabel}>Films</span>
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.blue}`}><Clock size={24} /></div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{formatDuration(stats.library.totalDurationMinutes)}</span>
            <span className={styles.kpiLabel}>Durée totale</span>
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.purple}`}><HardDrive size={24} /></div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats.storage.mediaSizeGB} GB</span>
            <span className={styles.kpiLabel}>Stockage</span>
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.orange}`}><Check size={24} /></div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats.posters.validationRate}%</span>
            <span className={styles.kpiLabel}>Affiches OK</span>
          </div>
        </div>
      </div>

      {/* Genres */}
      {stats.genres.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}><BarChart3 size={20} /></div>
            <h3 className={styles.cardTitle}>Top Genres</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats.genres.slice(0, 8).map((genre) => {
              const max = stats.genres[0]?.count || 1
              return (
                <div key={genre.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 100, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{genre.name}</span>
                  <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(genre.count / max) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 32, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textAlign: 'right' }}>{genre.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Récemment ajoutés */}
      {stats.activity.recentlyAdded.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}><Clock size={20} /></div>
            <h3 className={styles.cardTitle}>Récemment ajoutés</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
            {stats.activity.recentlyAdded.slice(0, 6).map((movie) => (
              <div key={movie.id} style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '2/3', borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.05)', marginBottom: 8 }}>
                  {movie.poster_url && !movie.poster_url.includes('placeholder') ? (
                    <Image src={movie.poster_url} alt={movie.title} fill sizes="120px" style={{ objectFit: 'cover' }} unoptimized />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)' }}><Film size={24} /></div>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{movie.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
