/**
 * Middleware d'authentification pour les routes API
 * Centralise la vérification d'authentification et des rôles admin
 */

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Liste des emails admin (depuis les variables d'environnement)
// Lue dynamiquement pour supporter les changements sans rebuild
function getAdminEmails(): string[] {
  const emails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || []
  return emails
}

// Project ref extrait de l'URL Supabase (pour les noms de cookies)
const SUPABASE_PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1] || ''

export type AuthResult = {
  user: {
    id: string
    email: string
    displayName?: string
  } | null
  error: string | null
}

/**
 * Créer un client Supabase pour les routes API
 * Utilise le service role key pour bypass RLS quand nécessaire
 */
function createAPIClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Variables Supabase manquantes')
  }
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Vérifier que l'utilisateur est authentifié
 * Extrait le token JWT depuis les cookies ou le header Authorization
 */
export async function requireAuth(request?: Request): Promise<AuthResult> {
  try {
    const supabase = createAPIClient()
    
    // Essayer d'obtenir le token depuis le header Authorization
    let token: string | null = null
    
    if (request) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7)
      }
    }
    
    // Si pas de token dans le header, essayer les cookies Supabase
    if (!token) {
      try {
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()
        
        // Debug: lister tous les cookies disponibles
        const cookieNames = allCookies.map(c => c.name)
        console.log(`[AUTH] Cookies disponibles: [${cookieNames.join(', ')}]`)
        console.log(`[AUTH] Project ref: ${SUPABASE_PROJECT_REF}`)
        
        // Format Supabase SSR: sb-<project-ref>-auth-token
        const authCookieName = `sb-${SUPABASE_PROJECT_REF}-auth-token`
        const authCookie = cookieStore.get(authCookieName)?.value
        
        // Essayer aussi sans le préfixe (nouveau format Supabase)
        const altCookieName = `sb-${SUPABASE_PROJECT_REF}-auth-token-code-verifier`
        
        // Chercher n'importe quel cookie Supabase auth
        const sbAuthCookie = allCookies.find(c => 
          c.name.startsWith('sb-') && c.name.includes('-auth-token')
        )
        
        console.log(`[AUTH] Cookie recherché: ${authCookieName}, trouvé: ${!!authCookie}`)
        console.log(`[AUTH] Cookie Supabase trouvé: ${sbAuthCookie?.name || 'aucun'}`)
        
        const cookieValue = authCookie || sbAuthCookie?.value
        
        if (cookieValue) {
          try {
            // Le cookie contient un JSON avec access_token et refresh_token
            const parsed = JSON.parse(cookieValue)
            token = parsed.access_token || parsed[0]?.access_token
            console.log(`[AUTH] Token extrait du JSON: ${token ? 'oui' : 'non'}`)
          } catch {
            // Si ce n'est pas du JSON, c'est peut-être directement le token
            token = cookieValue
            console.log('[AUTH] Cookie utilisé directement comme token')
          }
        }
        
        // Fallback: anciens noms de cookies
        if (!token) {
          const accessToken = cookieStore.get('sb-access-token')?.value
          if (accessToken) {
            token = accessToken
            console.log('[AUTH] Token trouvé dans sb-access-token')
          }
        }
      } catch (cookieError) {
        console.error('[AUTH] Erreur lecture cookies:', cookieError)
      }
    }
    
    if (!token) {
      return { user: null, error: 'Non authentifié - Token manquant' }
    }
    
    // Vérifier le token
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return { user: null, error: error?.message || 'Token invalide' }
    }
    
    return {
      user: {
        id: user.id,
        email: user.email || '',
        displayName: user.user_metadata?.display_name || user.email?.split('@')[0]
      },
      error: null
    }
  } catch (error) {
    console.error('[AUTH] Erreur authentification:', error instanceof Error ? error.message : error)
    return { user: null, error: 'Erreur serveur authentification' }
  }
}

/**
 * Vérifier que l'utilisateur est admin
 * Un admin est un utilisateur authentifié dont l'email est dans ADMIN_EMAILS
 */
export async function requireAdmin(request?: Request): Promise<AuthResult> {
  const authResult = await requireAuth(request)
  
  if (authResult.error) {
    console.log(`[AUTH] Erreur auth: ${authResult.error}`)
    return authResult
  }
  
  if (!authResult.user) {
    console.log('[AUTH] Pas d\'utilisateur authentifié')
    return { user: null, error: 'Non authentifié' }
  }
  
  // Vérifier si l'email est dans la liste des admins
  const adminEmails = getAdminEmails()
  const userEmail = authResult.user.email.toLowerCase()
  const isAdmin = adminEmails.includes(userEmail)
  
  console.log(`[AUTH] User: ${userEmail}, Admin emails: [${adminEmails.join(', ')}], isAdmin: ${isAdmin}`)
  
  if (!isAdmin) {
    console.warn(`[AUTH] Accès admin refusé pour: ${userEmail}`)
    return { user: null, error: 'Accès réservé aux administrateurs' }
  }
  
  return authResult
}

/**
 * Helper pour créer une réponse d'erreur d'authentification
 */
export function authErrorResponse(error: string, status: number = 401): NextResponse {
  return NextResponse.json(
    { error, authenticated: false },
    { status }
  )
}

/**
 * Wrapper pour protéger une route avec authentification
 * Usage: export const GET = withAuth(async (request, user) => { ... })
 */
export function withAuth<T extends Request>(
  handler: (request: T, user: NonNullable<AuthResult['user']>) => Promise<NextResponse>
) {
  return async (request: T): Promise<NextResponse> => {
    const { user, error } = await requireAuth(request)
    
    if (error || !user) {
      return authErrorResponse(error || 'Non authentifié')
    }
    
    return handler(request, user)
  }
}

/**
 * Wrapper pour protéger une route admin
 * Usage: export const POST = withAdmin(async (request, user) => { ... })
 */
export function withAdmin<T extends Request>(
  handler: (request: T, user: NonNullable<AuthResult['user']>) => Promise<NextResponse>
) {
  return async (request: T): Promise<NextResponse> => {
    const { user, error } = await requireAdmin(request)
    
    if (error || !user) {
      return authErrorResponse(error || 'Non autorisé', error?.includes('admin') ? 403 : 401)
    }
    
    return handler(request, user)
  }
}
