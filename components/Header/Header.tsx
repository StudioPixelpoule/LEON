/**
 * Header - Navigation principale avec recherche intégrée
 * Accès admin discret : Ctrl+Shift+A (Cmd+Shift+A sur Mac)
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import HeaderSearch from './HeaderSearch'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import styles from './Header.module.css'

interface HeaderProps {
  movies?: GroupedMedia[]
  onMovieClick?: (movie: GroupedMedia) => void
  series?: any[]
  onSeriesClick?: (series: any) => void
}

export default function Header({ movies, onMovieClick, series, onSeriesClick }: HeaderProps) {
  const pathname = usePathname()
  
  // Utiliser soit movies soit series selon ce qui est fourni
  const items = movies || series
  const onItemClick = onMovieClick || onSeriesClick
  
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.leftSection}>
          <Link href="/films" className={styles.logo}>
            LEON
          </Link>
          
          {/* Point rouge "recording" toujours visible */}
          <Link href="/admin" className={styles.adminRecordingDot} title="Admin">
            <span className={styles.adminIndicator}>●</span>
          </Link>
          
          {/* Navigation */}
          <nav className={styles.nav}>
            <Link href="/films" className={pathname === '/films' ? styles.navLinkActive : styles.navLink}>
              Films
            </Link>
            <Link href="/series" className={pathname === '/series' ? styles.navLinkActive : styles.navLink}>
              Séries
            </Link>
          </nav>
        </div>
        
        <div className={styles.rightSection}>
          {items && onItemClick && (
            <HeaderSearch 
              movies={items as GroupedMedia[]} 
              onMovieClick={onItemClick as (movie: GroupedMedia) => void}
              isSeries={!!series}
            />
          )}
          
          {/* Point gris discret */}
          <Link href="/admin" className={styles.adminButton} title="Admin">
            ·
          </Link>
        </div>
      </div>
    </header>
  )
}


