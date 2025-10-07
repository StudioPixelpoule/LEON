/**
 * Page d'administration
 * Permet de lancer le scan pCloud manuellement
 */

'use client'

import { useState } from 'react'

type ScanResult = {
  success: boolean
  message: string
  stats?: {
    total: number
    indexed: number
    updated: number
    errors: number
  }
}

export default function AdminPage() {
  const [scanning, setScanning] = useState(false)
  const [truncating, setTruncating] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  
  async function handleTruncate() {
    if (!confirm('⚠️ ATTENTION : Cela va supprimer TOUS les films de la base de données. Êtes-vous sûr ?')) {
      return
    }
    
    try {
      setTruncating(true)
      setResult(null)
      
      const response = await fetch('/api/truncate', {
        method: 'POST'
      })
      
      const data = await response.json()
      setResult(data)
      
    } catch (error) {
      console.error('Erreur truncate:', error)
      setResult({
        success: false,
        message: 'Erreur lors du vidage de la base'
      })
    } finally {
      setTruncating(false)
    }
  }
  
  async function handleScan() {
    try {
      setScanning(true)
      setResult(null)
      
      const response = await fetch('/api/scan', {
        method: 'POST'
      })
      
      const data = await response.json()
      setResult(data)
      
    } catch (error) {
      console.error('Erreur scan:', error)
      setResult({
        success: false,
        message: 'Erreur lors du scan'
      })
    } finally {
      setScanning(false)
    }
  }
  
  return (
    <div className="container">
      <header className="header">
        <h1 className="logo">LEON - Administration</h1>
      </header>
      
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Lien vers validation manuelle films */}
        <div style={{ 
          marginBottom: 'var(--spacing-2xl)',
          padding: 'var(--spacing-lg)',
          background: 'var(--color-gray-100)',
          borderRadius: '4px',
          border: '1px solid var(--color-gray-200)'
        }}>
          <h3 style={{ 
            fontSize: 'var(--font-size-lg)', 
            marginBottom: 'var(--spacing-sm)',
            fontWeight: 'var(--font-weight-bold)'
          }}>
            Validation manuelle
          </h3>
          <p style={{ 
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-gray-600)',
            lineHeight: '1.6',
            fontSize: 'var(--font-size-sm)'
          }}>
            Corrigez les titres non identifiés, recherchez sur TMDB et uploadez des jaquettes personnalisées.
          </p>
          <a 
            href="/admin/validate"
            style={{
              display: 'inline-block',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--color-black)',
              color: 'var(--color-white)',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-bold)',
              transition: 'transform var(--transition-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            → Accéder à la validation
          </a>
        </div>
        
        <h2 style={{ 
          fontSize: 'var(--font-size-xl)', 
          marginBottom: 'var(--spacing-lg)',
          fontWeight: 'var(--font-weight-bold)'
        }}>
          Indexation pCloud
        </h2>
        
        <p style={{ 
          marginBottom: 'var(--spacing-lg)',
          color: 'var(--color-gray-500)',
          lineHeight: '1.7'
        }}>
          Cette action va scanner votre dossier pCloud configuré et indexer tous les 
          fichiers MP4 dans la base de données. Les métadonnées seront récupérées 
          automatiquement depuis TMDB.
        </p>
        
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <button 
            onClick={handleTruncate} 
            disabled={truncating || scanning}
            className="secondaryButton"
            style={{ flex: 1 }}
          >
            {truncating ? 'Vidage...' : '🗑️ Vider la base'}
          </button>
          
          <button 
            onClick={handleScan} 
            disabled={scanning || truncating}
            className="primaryButton"
            style={{ flex: 2 }}
          >
            {scanning ? 'Scan en cours...' : '🔄 Lancer le scan'}
          </button>
        </div>
        
        {scanning && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <div className="downloadingState">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
            <p style={{ 
              marginTop: 'var(--spacing-md)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-gray-500)'
            }}>
              Indexation en cours (cela peut prendre plusieurs minutes)...
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="secondaryButton"
              style={{ marginTop: 'var(--spacing-md)' }}
            >
              ⏸️ Arrêter l'attente
            </button>
            <p style={{ 
              marginTop: 'var(--spacing-sm)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-gray-400)'
            }}>
              (Le scan continuera en arrière-plan sur le serveur)
            </p>
          </div>
        )}
        
        {result && (
          <div style={{
            padding: 'var(--spacing-lg)',
            background: result.success ? 'var(--color-gray-100)' : 'var(--color-red)',
            color: result.success ? 'var(--color-black)' : 'var(--color-white)',
            borderRadius: '2px'
          }}>
            <h3 style={{ 
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-bold)',
              marginBottom: 'var(--spacing-sm)'
            }}>
              {result.success ? '✓ Scan terminé' : '✗ Erreur'}
            </h3>
            
            <p style={{ marginBottom: 'var(--spacing-md)' }}>
              {result.message}
            </p>
            
            {result.stats && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 'var(--spacing-sm)',
                fontSize: 'var(--font-size-sm)'
              }}>
                <div>
                  <strong>Total :</strong> {result.stats.total}
                </div>
                <div>
                  <strong>Indexés :</strong> {result.stats.indexed}
                </div>
                <div>
                  <strong>Mis à jour :</strong> {result.stats.updated}
                </div>
                <div>
                  <strong>Erreurs :</strong> {result.stats.errors}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div style={{ 
          marginTop: 'var(--spacing-2xl)',
          padding: 'var(--spacing-lg)',
          background: 'var(--color-gray-100)'
        }}>
          <h3 style={{ 
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--spacing-sm)'
          }}>
            ℹ️ Informations
          </h3>
          <ul style={{ 
            listStyle: 'none',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-gray-600)',
            lineHeight: '1.8'
          }}>
            <li>• Indexation par batch de 100 films</li>
            <li>• Métadonnées récupérées depuis TMDB (français)</li>
            <li>• Détection automatique des sous-titres</li>
            <li>• Parsing intelligent des noms de fichiers</li>
          </ul>
        </div>
      </div>
    </div>
  )
}



