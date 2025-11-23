/**
 * Header - Navigation principale avec recherche intégrée
 * Accès admin discret : Ctrl+Shift+A (Cmd+Shift+A sur Mac)
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { User, Settings, LogOut, Shield } from 'lucide-react'
import HeaderSearch from './HeaderSearch'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import styles from './Header.module.css'

interface HeaderProps {
  movies?: GroupedMedia[]
  onMovieClick?: (movie: GroupedMedia) => void
  series?: any[]
  onSeriesClick?: (series: any) => void
  onSearch?: (query: string) => void
}

export default function Header({ movies, onMovieClick, series, onSeriesClick, onSearch }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
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
    console.log('Paramètres à venir')
  }

  const handleLogout = () => {
    setMenuOpen(false)
    // TODO: implémenter la déconnexion
    console.log('Déconnexion à venir')
  }
  
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
            {/* Séries masquées pour le moment */}
          </nav>
        </div>
        
        <div className={styles.rightSection}>
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
                    <p className={styles.userName}>Utilisateur</p>
                    <p className={styles.userEmail}>user@leon.app</p>
                  </div>
                </div>

                <div className={styles.dropdownDivider} />

                <button className={styles.menuItem} onClick={handleAdminAccess}>
                  <Shield size={18} />
                  <span>Administration</span>
                </button>

                <button className={styles.menuItem} onClick={handleSettings}>
                  <Settings size={18} />
                  <span>Paramètres</span>
                </button>

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
    </header>
  )
}


