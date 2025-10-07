/**
 * Page d'erreur globale minimaliste
 */

'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Erreur globale:', error)
  }, [error])

  return (
    <div className="container" style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: '100vh',
      textAlign: 'center'
    }}>
      <h1 style={{ 
        fontSize: 'var(--font-size-2xl)', 
        marginBottom: 'var(--spacing-md)',
        fontWeight: 'var(--font-weight-bold)'
      }}>
        Une erreur est survenue
      </h1>
      <p style={{ 
        fontSize: 'var(--font-size-base)',
        color: 'var(--color-gray-500)',
        marginBottom: 'var(--spacing-xl)',
        maxWidth: '600px'
      }}>
        {error.message || 'Erreur inattendue'}
      </p>
      <button onClick={reset} className="primaryButton">
        Réessayer
      </button>
    </div>
  )
}




