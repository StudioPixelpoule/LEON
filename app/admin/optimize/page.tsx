'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './optimize.module.css'

interface LocalFile {
  filename: string
  codec: string
  audioCodec: string
  resolution: string
  audioCount: number
  subtitleCount: number
  size: number
  needsOptimization: boolean
  isOptimized: boolean
}

interface EncodingState {
  filename: string
  percent: number
  speed: number
  fps: number
  currentTime: string
  duration: string
  isRunning: boolean
}

export default function OptimizePage() {
  const [files, setFiles] = useState<LocalFile[]>([])
  const [encoding, setEncoding] = useState<EncodingState>({
    filename: '',
    percent: 0,
    speed: 0,
    fps: 0,
    currentTime: '00:00:00',
    duration: '00:00:00',
    isRunning: false
  })
  const [loading, setLoading] = useState(false)
  const [autoEncode, setAutoEncode] = useState(false)
  const [previousEncodingState, setPreviousEncodingState] = useState<EncodingState>({
    filename: '',
    percent: 0,
    speed: 0,
    fps: 0,
    currentTime: '00:00:00',
    duration: '00:00:00',
    isRunning: false
  })

  const loadFiles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/optimize-local')
      const data = await response.json()
      
      if (data.files) {
        setFiles(data.files)
      }
      if (data.currentEncoding) {
        // Debug: logger l'état reçu
        if (data.currentEncoding.isRunning) {
          console.log(`📊 Frontend reçoit: ${data.currentEncoding.filename} - ${data.currentEncoding.percent}% - isRunning: ${data.currentEncoding.isRunning}`)
        }
        setEncoding(data.currentEncoding)
      }
    } catch (error) {
      console.error('Erreur chargement:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOptimize = useCallback(async (filename: string) => {
    console.log('🎬 handleOptimize appelé pour:', filename)
    console.log('   encoding.isRunning:', encoding.isRunning)
    
    if (encoding.isRunning) {
      alert('Un encodage est déjà en cours')
      return
    }

    console.log('   Envoi POST...')
    try {
      const response = await fetch('/api/admin/optimize-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      })

      const data = await response.json()
      console.log('   Réponse:', data)

      if (!data.success) {
        alert(data.error || 'Erreur')
      } else {
        // Recharger la liste après le démarrage
        setTimeout(() => loadFiles(), 1000)
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors du lancement')
    }
  }, [encoding.isRunning])

  const handleStop = async () => {
    if (!confirm('Arrêter l\'encodage en cours ?')) {
      return
    }
    
    try {
      console.log('🛑 Arrêt demandé...')
      
      // Mettre à jour l'état immédiatement pour feedback visuel
      setEncoding(prev => ({ ...prev, isRunning: false }))
      
      const response = await fetch('/api/admin/optimize-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      })
      
      const data = await response.json()
      console.log('   Réponse stop:', data)
      
      // Attendre un peu puis recharger pour être sûr
      setTimeout(() => {
        loadFiles()
      }, 1000)
    } catch (error) {
      console.error('Erreur stop:', error)
      // Recharger quand même
      loadFiles()
    }
  }

  useEffect(() => {
    loadFiles()
    // Polling plus fréquent pendant un encodage (500ms) pour UX fluide
    const interval = setInterval(loadFiles, encoding.isRunning ? 500 : 2000)
    return () => clearInterval(interval)
  }, [encoding.isRunning])

  // Détecter la fin d'un encodage et lancer le suivant si auto-encodage activé
  useEffect(() => {
    // Vérifier que l'encodage est vraiment terminé :
    // 1. Était en cours avant
    // 2. N'est plus en cours maintenant
    // 3. Le pourcentage est à 100% (ou très proche)
    // 4. Le nom du fichier correspond (pour éviter les faux positifs)
    const wasRunning = previousEncodingState.isRunning
    const isNowStopped = !encoding.isRunning
    const isComplete = encoding.percent >= 99.5 || previousEncodingState.percent >= 99.5
    const sameFile = previousEncodingState.filename === encoding.filename || encoding.filename === ''
    
    if (wasRunning && isNowStopped && isComplete && sameFile && autoEncode) {
      console.log(`🔄 Encodage terminé (${previousEncodingState.filename} - ${previousEncodingState.percent.toFixed(1)}%), recherche du suivant...`)
      
      // Attendre un peu pour s'assurer que le fichier est bien écrit et l'état est stable
      setTimeout(() => {
        // Recharger la liste pour avoir les fichiers à jour, puis trouver le suivant
        const findAndStartNext = async () => {
          // Recharger les fichiers
          const response = await fetch('/api/admin/optimize-local')
          const data = await response.json()
          
          // Vérifier qu'aucun encodage n'est en cours (double vérification)
          if (data.currentEncoding?.isRunning) {
            console.log('⚠️  Un encodage est encore en cours, annulation du lancement automatique')
            return
          }
          
          if (data.files) {
            // Trouver le prochain fichier à optimiser
            const nextFile = data.files.find((f: LocalFile) => 
              f.needsOptimization && 
              !f.isOptimized && 
              f.filename !== previousEncodingState.filename
            )
            
            if (nextFile) {
              console.log(`✅ Film suivant trouvé: ${nextFile.filename}`)
              // Attendre encore 2 secondes avant de lancer le suivant pour être sûr
              setTimeout(() => {
                handleOptimize(nextFile.filename)
              }, 2000)
            } else {
              console.log('ℹ️  Aucun autre film à optimiser')
            }
          }
        }
        
        findAndStartNext()
      }, 3000) // Attendre 3 secondes pour s'assurer que tout est bien terminé
    }
    
    // Mettre à jour l'état précédent seulement si l'encodage a changé
    if (previousEncodingState.isRunning !== encoding.isRunning || 
        previousEncodingState.filename !== encoding.filename ||
        Math.abs(previousEncodingState.percent - encoding.percent) > 1) {
      setPreviousEncodingState(encoding)
    }
  }, [encoding.isRunning, encoding.filename, encoding.percent, autoEncode, handleOptimize, previousEncodingState])

  const toOptimize = files.filter(f => f.needsOptimization && !f.isOptimized)
  const optimized = files.filter(f => f.isOptimized)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <div className={styles.breadcrumb}>
            <a href="/admin">Administration</a>
            <span className={styles.breadcrumbSeparator}>/</span>
            <span>Optimisation Locale</span>
          </div>
          <h1 className={styles.title}>Optimisation Locale</h1>
          <p className={styles.subtitle}>
            Placez vos films dans <code>~/Desktop/temp/</code> pour les optimiser
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoEncode}
              onChange={(e) => setAutoEncode(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
              Encodage automatique séquentiel
            </span>
          </label>
          <a href="/admin" className={styles.backLink}>Retour</a>
        </div>
      </div>

      <div className={styles.content}>
        {/* Barre d'encodage */}
        {encoding.isRunning && (
          <div className={styles.encodingSection}>
            <div className={styles.encodingHeader}>
              <div className={styles.encodingInfo}>
                <div className={styles.encodingLabel}>Encodage en cours</div>
                <div className={styles.encodingFilename}>{encoding.filename}</div>
              </div>
              <button onClick={handleStop} className={styles.stopButton}>
                Arrêter
              </button>
            </div>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ width: `${Math.min(100, Math.max(0, encoding.percent))}%` }}
              />
              <span className={styles.progressPercent}>{encoding.percent.toFixed(1)}%</span>
            </div>
            <div className={styles.encodingStats}>
              <span>{encoding.currentTime} / {encoding.duration}</span>
              <span>{encoding.speed.toFixed(1)}x</span>
              <span>{encoding.fps} fps</span>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{files.length}</div>
            <div className={styles.statLabel}>Films totaux</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{toOptimize.length}</div>
            <div className={styles.statLabel}>À optimiser</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{optimized.length}</div>
            <div className={styles.statLabel}>Optimisés</div>
          </div>
        </div>

        {/* Films à optimiser */}
        {toOptimize.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Films à optimiser</h2>
            <div className={styles.fileList}>
              {toOptimize.map(file => {
                const isCurrentFile = encoding.isRunning && encoding.filename === file.filename

                return (
                  <div 
                    key={file.filename} 
                    className={`${styles.fileItem} ${isCurrentFile ? styles.processing : ''}`}
                  >
                    <div className={styles.fileInfo}>
                      <div className={styles.fileName}>{file.filename}</div>
                      <div className={styles.fileMeta}>
                        <span className={styles.metaItem}>{file.codec}</span>
                        <span className={styles.metaItem}>{file.audioCodec}</span>
                        <span className={styles.metaItem}>{file.resolution}</span>
                        <span className={styles.metaItem}>{file.size} MB</span>
                        {file.audioCount > 0 && (
                          <span className={styles.metaItem}>{file.audioCount} audio</span>
                        )}
                        {file.subtitleCount > 0 && (
                          <span className={styles.metaItem}>{file.subtitleCount} ST</span>
                        )}
                      </div>
                    </div>

                    {isCurrentFile && (
                      <div className={styles.fileProgress}>
                        <div className={styles.fileProgressBar}>
                          <div 
                            className={styles.fileProgressFill}
                            style={{ width: `${Math.min(100, Math.max(0, encoding.percent))}%` }}
                          />
                          <span className={styles.fileProgressPercent}>{encoding.percent.toFixed(1)}%</span>
                        </div>
                        <div className={styles.fileProgressText}>
                          {encoding.currentTime} / {encoding.duration} · {encoding.speed.toFixed(1)}x · {encoding.fps} fps
                        </div>
                      </div>
                    )}

                    {!isCurrentFile && (
                      <button
                        onClick={() => {
                          console.log('🔘 Clic sur bouton Optimiser:', file.filename)
                          handleOptimize(file.filename)
                        }}
                        disabled={encoding.isRunning}
                        className={styles.optimizeButton}
                      >
                        Optimiser
                      </button>
                    )}

                    {isCurrentFile && (
                      <div className={styles.processingLabel}>
                        En cours...
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Films optimisés */}
        {optimized.length > 0 && (
          <div className={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
              <h2 className={styles.sectionTitle}>Films optimisés</h2>
              <button
                onClick={async () => {
                  if (!confirm('Mettre à jour la base de données pour les fichiers optimisés remplacés dans pCloud ?\n\nAssurez-vous d\'avoir remplacé les fichiers dans pCloud avant de continuer.')) {
                    return
                  }
                  
                  try {
                    const response = await fetch('/api/admin/update-optimized', {
                      method: 'POST'
                    })
                    const data = await response.json()
                    
                    if (data.success) {
                      alert(`✅ ${data.message}\n\n${data.updates?.map((u: any) => `• ${u.title}`).join('\n') || ''}`)
                      // Recharger la liste des fichiers
                      loadFiles()
                    } else {
                      alert(`❌ Erreur: ${data.error}`)
                    }
                  } catch (error) {
                    console.error('Erreur:', error)
                    alert('Erreur lors de la mise à jour')
                  }
                }}
                className={styles.updateButton}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  background: 'var(--color-black)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  transition: 'all 150ms ease'
                }}
              >
                Mettre à jour la base
              </button>
            </div>
            <div className={styles.fileList}>
              {optimized.map(file => (
                <div key={file.filename} className={`${styles.fileItem} ${styles.completed}`}>
                  <div className={styles.fileInfo}>
                    <div className={styles.fileName}>{file.filename}</div>
                    <div className={styles.fileMeta}>
                      <span className={styles.metaItem}>H.264</span>
                      <span className={styles.metaItem}>AAC</span>
                      <span className={styles.metaItem}>{file.resolution}</span>
                    </div>
                  </div>
                  <div className={styles.completedLabel}>
                    Terminé
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {files.length === 0 && !loading && (
          <div className={styles.emptyState}>
            <h3>Aucun fichier trouvé</h3>
            <p>
              1. Créez le dossier <code>~/Desktop/temp/</code><br />
              2. Placez-y vos films (.mkv, .mp4, .avi, .mov)<br />
              3. Rechargez cette page
            </p>
          </div>
        )}

        {loading && files.length === 0 && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Chargement...</p>
          </div>
        )}
      </div>
    </div>
  )
}
