import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes publiques (accessibles sans authentification)
const publicRoutes = ['/login', '/register']

// Routes admin (nécessitent le rôle admin)
const adminRoutes = ['/admin', '/api/admin']

// Liste des emails admin (depuis variable d'environnement)
// Format: "email1@example.com,email2@example.com"
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  // Vérifier que les variables d'environnement sont définies
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  // Si les variables ne sont pas définies, laisser passer (mode dégradé)
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Variables Supabase non définies, middleware désactivé')
    return res
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value,
            ...options,
          })
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          res.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          })
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          res.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  
  const pathname = req.nextUrl.pathname
  
  // Routes publiques
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    // Si déjà connecté et sur login/register, rediriger vers l'accueil
    if (session && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/films', req.url))
    }
    return res
  }
  
  // Routes protégées - rediriger vers login si pas de session
  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  // Routes admin - vérifier si l'utilisateur est admin
  if (adminRoutes.some(route => pathname.startsWith(route))) {
    const userEmail = session.user?.email?.toLowerCase()
    const isAdmin = userEmail && ADMIN_EMAILS.includes(userEmail)
    
    if (!isAdmin) {
      // Pour les API, retourner 403
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
      // Pour les pages, rediriger vers l'accueil
      return NextResponse.redirect(new URL('/films', req.url))
    }
  }
  
  return res
}

export const config = {
  matcher: [
    /*
     * Match:
     * - Toutes les pages (sauf static)
     * - /api/admin/* (routes admin protégées)
     * Note: /api/* est exclu sauf /api/admin/*
     */
    '/((?!_next/static|_next/image|favicon.ico|public|placeholder|api(?!/admin)).*)',
  ],
}

