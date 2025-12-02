import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import '@/styles/globals.css'
import { AuthProvider } from '@/contexts/AuthContext'

const nunito = Nunito({ 
  weight: ['200', '500', '800'],
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LEON - Médiathèque Personnelle',
  description: 'Webapp minimaliste de médiathèque personnelle - Pixel Poule',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={nunito.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}



