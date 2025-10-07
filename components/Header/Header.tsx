/**
 * Header - Navigation principale
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Header.module.css'

export default function Header() {
  const pathname = usePathname()
  
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/films" className={styles.logo}>
          LEON
        </Link>
      </div>
    </header>
  )
}


