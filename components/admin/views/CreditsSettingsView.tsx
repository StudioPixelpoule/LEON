'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Search, Tv, ChevronRight, X } from 'lucide-react'
import { useAdminToast } from '@/components/admin/Toast/Toast'
import styles from '@/app/admin/admin.module.css'

interface SeriesWithSeasons {
  show_name: string
  poster_url?: string
  seasons: number[]
  totalEpisodes: number
}

interface CreditsSetting {
  id: string
  show_name: string
  season_number: number | null
  credits_duration: number
  timing_source: 'manual' | 'auto' | 'chapters'
  updated_at: string
}

export function CreditsSettingsView() {
  const [series, setSeries] = useState<SeriesWithSeasons[]>([])
  const [settings, setSettings] = useState<CreditsSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'configured' | 'unconfigured'>('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set())
  const [editingValue, setEditingValue] = useState<{ showName: string; season: number | null; value: string } | null>(null)
  
  const { addToast } = useAdminToast()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Charger les séries et les settings en parallèle
      const [seriesRes, settingsRes] = await Promise.all([
        fetch('/api/series/list'),
        fetch('/api/admin/credits-settings')
      ])
      
      const seriesData = await seriesRes.json()
      const settingsData = await settingsRes.json()
      
      if (seriesData.success) {
        // Transformer les données pour avoir show_name unique avec les saisons
        const seriesMap = new Map<string, SeriesWithSeasons>()
        
        for (const s of seriesData.series || []) {
          if (!seriesMap.has(s.title)) {
            seriesMap.set(s.title, {
              show_name: s.title,
              poster_url: s.poster_url,
              seasons: s.seasons?.map((season: { season: number }) => season.season) || [],
              totalEpisodes: s.totalEpisodes || 0
            })
          }
        }
        
        setSeries(Array.from(seriesMap.values()).sort((a, b) => a.show_name.localeCompare(b.show_name)))
      }
      
      if (settingsData.success) {
        setSettings(settingsData.settings || [])
      }
    } catch (error) {
      console.error('Erreur chargement données génériques:', error)
      addToast('error', 'Erreur', 'Impossible de charger les données')
    } finally {
      setLoading(false)
    }
  }

  // Obtenir la durée configurée pour une série/saison
  function getConfiguredDuration(showName: string, seasonNumber: number | null): CreditsSetting | undefined {
    return settings.find(s => s.show_name === showName && s.season_number === seasonNumber)
  }

  // Vérifier si une série a au moins un setting
  function hasAnySetting(showName: string): boolean {
    return settings.some(s => s.show_name === showName)
  }

  // Sauvegarder un setting
  async function saveSetting(showName: string, seasonNumber: number | null, duration: number) {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/credits-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          show_name: showName,
          season_number: seasonNumber,
          credits_duration: duration,
          timing_source: 'manual'
        }),
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        // Mettre à jour le state local
        setSettings(prev => {
          const existing = prev.findIndex(s => s.show_name === showName && s.season_number === seasonNumber)
          if (existing >= 0) {
            const updated = [...prev]
            updated[existing] = data.setting
            return updated
          }
          return [...prev, data.setting]
        })
        addToast('success', 'Enregistré', `${showName} ${seasonNumber ? `S${seasonNumber}` : '(défaut)'}: ${duration}s`)
      } else {
        addToast('error', 'Erreur', 'Impossible de sauvegarder')
      }
    } catch (error) {
      addToast('error', 'Erreur', 'Erreur de connexion')
    } finally {
      setSaving(false)
      setEditingValue(null)
    }
  }

  // Supprimer un setting
  async function deleteSetting(showName: string, seasonNumber: number | null) {
    if (!confirm(`Supprimer le paramètre pour ${showName} ${seasonNumber ? `S${seasonNumber}` : '(défaut)'} ?`)) return
    
    try {
      const params = new URLSearchParams({ show_name: showName })
      if (seasonNumber !== null) params.append('season_number', seasonNumber.toString())
      
      const response = await fetch(`/api/admin/credits-settings?${params.toString()}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (response.ok) {
        setSettings(prev => prev.filter(s => !(s.show_name === showName && s.season_number === seasonNumber)))
        addToast('success', 'Supprimé', `Paramètre supprimé`)
      }
    } catch (error) {
      addToast('error', 'Erreur', 'Impossible de supprimer')
    }
  }

  // Formater les secondes en MM:SS
  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Parser MM:SS en secondes
  function parseDuration(value: string): number | null {
    // Accepter "90" ou "1:30" ou "01:30"
    if (/^\d+$/.test(value)) {
      return parseInt(value)
    }
    const match = value.match(/^(\d+):(\d{2})$/)
    if (match) {
      return parseInt(match[1]) * 60 + parseInt(match[2])
    }
    return null
  }

  // Filtrer les séries
  const filteredSeries = series.filter(s => {
    if (searchFilter && !s.show_name.toLowerCase().includes(searchFilter.toLowerCase())) return false
    if (filter === 'configured' && !hasAnySetting(s.show_name)) return false
    if (filter === 'unconfigured' && hasAnySetting(s.show_name)) return false
    return true
  })

  // Compter les séries configurées
  const configuredCount = series.filter(s => hasAnySetting(s.show_name)).length
  const unconfiguredCount = series.length - configuredCount

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

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Paramètres des génériques</h2>
          <p className={styles.sectionSubtitle}>
            Définir la durée du générique par série (avec override par saison si nécessaire)
          </p>
        </div>
        <button className={styles.btnIcon} onClick={loadData}>
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Filtres */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <button
            className={`${styles.filterBtn} ${filter === 'unconfigured' ? styles.active : ''}`}
            onClick={() => setFilter('unconfigured')}
          >
            À configurer ({unconfiguredCount})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'configured' ? styles.active : ''}`}
            onClick={() => setFilter('configured')}
          >
            Configurés ({configuredCount})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => setFilter('all')}
          >
            Tous ({series.length})
          </button>
        </div>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Rechercher une série..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Liste des séries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredSeries.map(s => {
          const isExpanded = expandedSeries.has(s.show_name)
          const defaultSetting = getConfiguredDuration(s.show_name, null)
          const hasConfig = hasAnySetting(s.show_name)
          
          return (
            <div key={s.show_name} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, overflow: 'hidden' }}>
              {/* Ligne principale */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12, 
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onClick={() => setExpandedSeries(prev => {
                  const next = new Set(prev)
                  if (next.has(s.show_name)) next.delete(s.show_name)
                  else next.add(s.show_name)
                  return next
                })}
              >
                {/* Poster miniature */}
                <div style={{ width: 40, height: 60, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.05)' }}>
                  {s.poster_url ? (
                    <img src={s.poster_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                      <Tv size={16} />
                    </div>
                  )}
                </div>

                {/* Infos */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.show_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    {s.seasons.length} saison{s.seasons.length > 1 ? 's' : ''} · {s.totalEpisodes} épisodes
                  </div>
                </div>

                {/* Durée par défaut */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingValue?.showName === s.show_name && editingValue?.season === null ? (
                    <input
                      type="text"
                      autoFocus
                      defaultValue={defaultSetting ? formatDuration(defaultSetting.credits_duration) : ''}
                      placeholder="1:30"
                      style={{ 
                        width: 60, 
                        padding: '4px 8px', 
                        background: 'rgba(255,255,255,0.1)', 
                        border: '1px solid rgba(255,255,255,0.2)', 
                        borderRadius: 4, 
                        color: 'white',
                        textAlign: 'center'
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const duration = parseDuration((e.target as HTMLInputElement).value)
                          if (duration !== null && duration >= 0) {
                            saveSetting(s.show_name, null, duration)
                          } else {
                            addToast('error', 'Format invalide', 'Utilisez "90" ou "1:30"')
                          }
                        } else if (e.key === 'Escape') {
                          setEditingValue(null)
                        }
                      }}
                      onBlur={() => setEditingValue(null)}
                    />
                  ) : (
                    <div 
                      style={{ 
                        padding: '4px 12px', 
                        background: hasConfig ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)', 
                        borderRadius: 4,
                        color: hasConfig ? '#22c55e' : 'rgba(255,255,255,0.5)',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        minWidth: 50,
                        textAlign: 'center'
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingValue({ showName: s.show_name, season: null, value: '' })
                      }}
                    >
                      {defaultSetting ? formatDuration(defaultSetting.credits_duration) : '—'}
                    </div>
                  )}
                  
                  {defaultSetting && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSetting(s.show_name, null) }}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 4 }}
                    >
                      <X size={14} />
                    </button>
                  )}
                  
                  <ChevronRight 
                    size={16} 
                    style={{ 
                      color: 'rgba(255,255,255,0.3)', 
                      transform: isExpanded ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.2s'
                    }} 
                  />
                </div>
              </div>

              {/* Saisons (expanded) */}
              {isExpanded && s.seasons.length > 0 && (
                <div style={{ padding: '0 16px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Override par saison
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {s.seasons.sort((a, b) => a - b).map(season => {
                      const seasonSetting = getConfiguredDuration(s.show_name, season)
                      const isEditing = editingValue?.showName === s.show_name && editingValue?.season === season
                      
                      return (
                        <div key={season} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', width: 24 }}>S{season}</span>
                          {isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              defaultValue={seasonSetting ? formatDuration(seasonSetting.credits_duration) : ''}
                              placeholder="1:30"
                              style={{ 
                                width: 50, 
                                padding: '2px 6px', 
                                background: 'rgba(255,255,255,0.1)', 
                                border: '1px solid rgba(255,255,255,0.2)', 
                                borderRadius: 4, 
                                color: 'white',
                                textAlign: 'center',
                                fontSize: 12
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const duration = parseDuration((e.target as HTMLInputElement).value)
                                  if (duration !== null && duration >= 0) {
                                    saveSetting(s.show_name, season, duration)
                                  } else {
                                    addToast('error', 'Format invalide', 'Utilisez "90" ou "1:30"')
                                  }
                                } else if (e.key === 'Escape') {
                                  setEditingValue(null)
                                }
                              }}
                              onBlur={() => setEditingValue(null)}
                            />
                          ) : (
                            <div 
                              style={{ 
                                padding: '2px 8px', 
                                background: seasonSetting ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', 
                                borderRadius: 4,
                                color: seasonSetting ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                                fontSize: 12,
                                cursor: 'pointer',
                                minWidth: 40,
                                textAlign: 'center'
                              }}
                              onClick={() => setEditingValue({ showName: s.show_name, season, value: '' })}
                            >
                              {seasonSetting ? formatDuration(seasonSetting.credits_duration) : '—'}
                            </div>
                          )}
                          {seasonSetting && (
                            <button
                              onClick={() => deleteSetting(s.show_name, season)}
                              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 2 }}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filteredSeries.length === 0 && (
          <p className={styles.emptyText}>Aucune série trouvée</p>
        )}
      </div>
    </div>
  )
}
