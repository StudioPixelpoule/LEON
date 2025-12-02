'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import styles from '../login/login.module.css'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setLoading(true)

    const { error } = await signUp(email, password, displayName)
    
    if (error) {
      setError(error)
    } else {
      setSuccess(true)
    }
    
    setLoading(false)
  }

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <span className={styles.logoText}>LEON</span>
            <span className={styles.logoDot}></span>
          </div>
          
          <h1 className={styles.title}>Compte créé !</h1>
          
          <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 24 }}>
            Vérifiez votre email pour confirmer votre inscription.
          </p>
          
          <Link href="/login" className={styles.button} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoText}>LEON</span>
          <span className={styles.logoDot}></span>
        </div>
        
        <h1 className={styles.title}>Créer un compte</h1>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}
          
          <div className={styles.inputGroup}>
            <label htmlFor="displayName" className={styles.label}>Nom affiché</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={styles.input}
              placeholder="Votre prénom"
              autoComplete="name"
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="votre@email.com"
              required
              autoComplete="email"
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>Confirmer le mot de passe</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={styles.input}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>
          
          <button 
            type="submit" 
            className={styles.button}
            disabled={loading}
          >
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>
        
        <div className={styles.footer}>
          <p>Déjà un compte ?</p>
          <Link href="/login" className={styles.link}>
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  )
}





