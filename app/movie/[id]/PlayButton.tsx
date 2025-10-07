/**
 * Composant bouton de lecture pour ouvrir le film dans VLC/QuickTime
 */

'use client'

import { useState } from 'react'
import styles from './page.module.css'

type PlayButtonProps = {
  filepath: string
  title: string
  quality: string | null
  fileSize: string | null
}

export default function PlayButton({ filepath, title, quality, fileSize }: PlayButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  async function handlePlay() {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filepath }),
      })
      
      if (!response.ok) {
        throw new Error('Erreur lors de l\'ouverture du film')
      }
      
      const data = await response.json()
      console.log('✅', data.message)
      
    } catch (err) {
      console.error('Erreur:', err)
      setError('Impossible d\'ouvrir le film')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <>
      <button 
        className={styles.primaryButton}
        onClick={handlePlay}
        disabled={loading}
      >
        {loading ? (
          '⏳ Ouverture...'
        ) : (
          <>
            ▶ Lire{quality && ` · ${quality}`}{fileSize && ` · ${fileSize}`}
          </>
        )}
      </button>
      
      {error && (
        <p style={{ 
          color: 'var(--color-red)', 
          fontSize: 'var(--font-size-sm)',
          marginTop: 'var(--spacing-xs)'
        }}>
          {error}
        </p>
      )}
    </>
  )
}


