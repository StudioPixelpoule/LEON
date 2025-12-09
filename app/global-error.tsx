'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Envoyer l'erreur à Sentry
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body style={{
        backgroundColor: '#000',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        margin: 0,
        padding: '20px',
        textAlign: 'center',
      }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            Une erreur est survenue
          </h1>
          <p style={{ color: '#888', marginBottom: '2rem' }}>
            L&apos;erreur a été signalée automatiquement.
          </p>
          <button
            onClick={() => reset()}
            style={{
              backgroundColor: '#fff',
              color: '#000',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  )
}












