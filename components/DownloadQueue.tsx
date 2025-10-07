/**
 * File d'attente de téléchargement flottante
 * Affiche la progression avec les 3 points animés
 */

'use client'

import { useState } from 'react'

export type DownloadItem = {
  id: string
  title: string
  fileSize: number
  progress: number // 0-100
  status: 'pending' | 'downloading' | 'completed' | 'error'
}

type DownloadQueueProps = {
  downloads: DownloadItem[]
  onCancel: (id: string) => void
  onClear: () => void
}

export default function DownloadQueue({ 
  downloads, 
  onCancel, 
  onClear 
}: DownloadQueueProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  
  // Ne rien afficher si pas de téléchargements
  if (downloads.length === 0) {
    return null
  }
  
  const activeDownloads = downloads.filter(d => d.status !== 'completed')
  const completedCount = downloads.filter(d => d.status === 'completed').length
  
  return (
    <div className="downloadQueue">
      <div className="queueHeader">
        <h3 className="queueTitle">
          Téléchargements ({activeDownloads.length})
        </h3>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="secondaryButton"
            style={{ padding: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
          {completedCount > 0 && (
            <button 
              onClick={onClear}
              className="secondaryButton"
              style={{ padding: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}
            >
              Effacer
            </button>
          )}
        </div>
      </div>
      
      {!isMinimized && (
        <div>
          {downloads.map((item) => (
            <div key={item.id} className="queueItem">
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--spacing-xs)'
              }}>
                <span style={{ 
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-regular)'
                }}>
                  {item.title}
                </span>
                
                {item.status !== 'completed' && (
                  <button
                    onClick={() => onCancel(item.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-lg)',
                      color: 'var(--color-gray-500)',
                      padding: '0',
                      lineHeight: '1'
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              
              {/* État selon le statut */}
              {item.status === 'downloading' && (
                <div className="downloadingState">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              )}
              
              {item.status === 'completed' && (
                <div style={{ 
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-gray-500)'
                }}>
                  ✓ Terminé
                </div>
              )}
              
              {item.status === 'error' && (
                <div style={{ 
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-red)'
                }}>
                  Erreur
                </div>
              )}
              
              {item.status === 'pending' && (
                <div style={{ 
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-gray-500)'
                }}>
                  En attente...
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}




