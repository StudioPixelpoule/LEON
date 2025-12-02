import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes publiques (accessibles sans authentification)
const publicRoutes = ['/login', '/register']

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
  
  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - API routes
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api|placeholder).*)',
  ],
}

