/**
 * Page 404 minimaliste
 */

import Link from 'next/link'

export default function NotFound() {
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
        fontSize: 'var(--font-size-3xl)', 
        marginBottom: 'var(--spacing-md)',
        fontWeight: 'var(--font-weight-bold)'
      }}>
        404
      </h1>
      <p style={{ 
        fontSize: 'var(--font-size-lg)',
        color: 'var(--color-gray-500)',
        marginBottom: 'var(--spacing-xl)'
      }}>
        Page introuvable
      </p>
      <Link href="/" className="primaryButton">
        Retour à l&apos;accueil
      </Link>
    </div>
  )
}

