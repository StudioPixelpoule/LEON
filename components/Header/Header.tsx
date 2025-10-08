/**
 * Header - Navigation principale avec recherche intégrée
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import HeaderSearch from './HeaderSearch'
import type { GroupedMedia } from '@/app/api/media/grouped/route'
import styles from './Header.module.css'

interface HeaderProps {
  movies?: GroupedMedia[]
  onMovieClick?: (movie: GroupedMedia) => void
}

export default function Header({ movies, onMovieClick }: HeaderProps) {
  const pathname = usePathname()
  
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/films" className={styles.logo}>
          LEON
        </Link>
        
        {movies && onMovieClick && (
          <HeaderSearch movies={movies} onMovieClick={onMovieClick} />
        )}
      </div>
    </header>
  )
}


