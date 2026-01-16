import type { Metadata, Viewport } from 'next'
import { Nunito } from 'next/font/google'
import '@/styles/globals.css'
import { AuthProvider } from '@/contexts/AuthContext'

const nunito = Nunito({ 
  weight: ['200', '500', '800'],
  subsets: ['latin'],
  display: 'swap',
})

// Viewport séparé pour Next.js 14+
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // Important pour Safari iOS - utilise tout l'écran
}

export const metadata: Metadata = {
  title: 'LEON - Médiathèque Personnelle',
  description: 'Webapp minimaliste de médiathèque personnelle - Pixel Poule',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LEON',
  },
  // Autres meta tags pour mobile
  other: {
    'mobile-web-app-capable': 'yes',
  },
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



