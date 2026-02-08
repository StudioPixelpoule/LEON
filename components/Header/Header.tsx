/**
 * Header - Navigation principale avec recherche intégrée
 * Accès admin discret : Ctrl+Shift+A (Cmd+Shift+A sur Mac)
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { User, Settings, LogOut, Shield, Heart } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import HeaderSearch from './HeaderSearch'
import { MediaRequestModal } from '@/components/MediaRequestModal/MediaRequestModal'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import type { SeriesSummary } from '@/types/media'
import styles from './Header.module.css'

// Liste des emails admin (doit correspondre à middleware.ts)
const ADMIN_EMAILS = ['theboxoflio@gmail.com']

interface HeaderProps {
  movies?: GroupedMedia[]
  onMovieClick?: (movie: GroupedMedia) => void
  series?: SeriesSummary[]
  onSeriesClick?: (series: SeriesSummary) => void
  onSearch?: (query: string) => void
}

export default function Header({ movies, onMovieClick, series, onSeriesClick, onSearch }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Utiliser soit movies soit series selon ce qui est fourni
  const items = movies || series
  const onItemClick = onMovieClick || onSeriesClick

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  const handleAdminAccess = () => {
    setMenuOpen(false)
    router.push('/admin')
  }

  const handleSettings = () => {
    setMenuOpen(false)
    // TODO: implémenter les paramètres
    console.log('[HEADER] Paramètres à venir')
  }

  const handleLogout = async () => {
    setMenuOpen(false)
    await signOut()
  }
  
  // Extraire le nom affiché de l'utilisateur
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Utilisateur'
  const userEmail = user?.email || ''
  const isAdmin = userEmail && ADMIN_EMAILS.includes(userEmail.toLowerCase())
  
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.leftSection}>
          <Link href="/films" className={styles.logo}>
            LEON
          </Link>
          
          {/* Point rouge esthétique */}
          <div className={styles.recordingDot}>
            <span className={styles.recordingIndicator}>●</span>
          </div>
          
          {/* Navigation */}
          <nav className={styles.nav}>
            <Link href="/films" className={pathname === '/films' ? styles.navLinkActive : styles.navLink}>
              Films
            </Link>
            <Link href="/series" className={pathname === '/series' ? styles.navLinkActive : styles.navLink}>
              Séries
            </Link>
            <Link href="/ma-liste" className={pathname === '/ma-liste' ? styles.navLinkActive : styles.navLink}>
              Ma liste
            </Link>
          </nav>
        </div>
        
        <div className={styles.rightSection}>
          {/* Bouton demande de film/série */}
          <button
            className={styles.requestButton}
            onClick={() => setRequestModalOpen(true)}
            aria-label="Demander un film ou une série"
            title="Demander un film ou une série"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <line x1="12" y1="8" x2="12" y2="14" />
              <line x1="9" y1="11" x2="15" y2="11" />
            </svg>
          </button>

          {items && onItemClick && (
            <HeaderSearch 
              movies={items as GroupedMedia[]} 
              onMovieClick={onItemClick as (movie: GroupedMedia) => void}
              isSeries={!!series}
              onSearch={onSearch}
            />
          )}
          
          {/* Avatar utilisateur avec menu */}
          <div className={styles.userMenu} ref={menuRef}>
            <button 
              className={styles.avatar}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu utilisateur"
            >
              <User size={28} />
            </button>

            {menuOpen && (
              <div className={styles.dropdown}>
                <div className={styles.dropdownHeader}>
                  <div className={styles.avatarLarge}>
                    <User size={24} />
                  </div>
                  <div className={styles.userInfo}>
                    <p className={styles.userName}>{displayName}</p>
                    <p className={styles.userEmail}>{userEmail}</p>
                  </div>
                </div>

                <div className={styles.dropdownDivider} />

                <Link href="/ma-liste" className={styles.menuItem} onClick={() => setMenuOpen(false)}>
                  <Heart size={18} />
                  <span>Ma liste</span>
                </Link>

                <button className={styles.menuItem} onClick={handleSettings}>
                  <Settings size={18} />
                  <span>Paramètres</span>
                </button>

                {isAdmin && (
                  <>
                    <div className={styles.dropdownDivider} />
                    <button className={styles.menuItem} onClick={handleAdminAccess}>
                      <Shield size={18} />
                      <span>Administration</span>
                    </button>
                  </>
                )}

                <div className={styles.dropdownDivider} />

                <button className={styles.menuItem} onClick={handleLogout}>
                  <LogOut size={18} />
                  <span>Déconnexion</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal demande de film/série */}
      <MediaRequestModal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
      />
    </header>
  )
}


