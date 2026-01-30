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
        
        // Format Supabase SSR: les cookies peuvent être en chunks
        // sb-<ref>-auth-token ou sb-<ref>-auth-token.0, sb-<ref>-auth-token.1, etc.
        const authCookieBase = `sb-${SUPABASE_PROJECT_REF}-auth-token`
        
        // Collecter tous les chunks du cookie
        const chunks: string[] = []
        const mainCookie = cookieStore.get(authCookieBase)?.value
        if (mainCookie) {
          chunks.push(mainCookie)
        }
        
        // Chercher les chunks numérotés (.0, .1, .2, etc.)
        for (let i = 0; i < 10; i++) {
          const chunkCookie = cookieStore.get(`${authCookieBase}.${i}`)?.value
          if (chunkCookie) {
            chunks[i] = chunkCookie
          }
        }
        
        // Combiner tous les chunks
        const combinedCookie = chunks.filter(Boolean).join('')
        console.log(`[AUTH] Cookie chunks: ${chunks.length}, taille combinée: ${combinedCookie.length}`)
        
        if (combinedCookie) {
          // Le cookie Supabase SSR peut avoir plusieurs formats :
          // 1. "base64-" + base64(JSON) - format Supabase SSR récent
          // 2. JSON direct
          // 3. Base64(JSON)
          
          let cookieData = combinedCookie
          
          // Enlever le préfixe "base64-" si présent
          if (cookieData.startsWith('base64-')) {
            cookieData = cookieData.substring(7) // Enlever "base64-"
            console.log('[AUTH] Préfixe base64- détecté et enlevé')
          }
          
          try {
            // Essai 1: Base64 décodé (format Supabase SSR avec préfixe)
            const decoded = Buffer.from(cookieData, 'base64').toString('utf-8')
            const parsed = JSON.parse(decoded)
            token = parsed.access_token || parsed[0]?.access_token
            console.log(`[AUTH] Token extrait du Base64: ${token ? 'oui' : 'non'}`)
          } catch {
            try {
              // Essai 2: JSON direct
              const parsed = JSON.parse(cookieData)
              token = parsed.access_token || parsed[0]?.access_token
              console.log(`[AUTH] Token extrait du JSON direct: ${token ? 'oui' : 'non'}`)
            } catch {
              try {
                // Essai 3: URL decoded puis JSON
                const decoded = decodeURIComponent(cookieData)
                const parsed = JSON.parse(decoded)
                token = parsed.access_token || parsed[0]?.access_token
                console.log(`[AUTH] Token extrait du URL-decoded: ${token ? 'oui' : 'non'}`)
              } catch {
                // Essai 4: C'est peut-être déjà un JWT (commence par eyJ)
                if (cookieData.startsWith('eyJ')) {
                  token = cookieData
                  console.log('[AUTH] Cookie est déjà un JWT')
                } else {
                  // Log le début du cookie pour debug
                  console.log(`[AUTH] Format cookie inconnu, début: ${cookieData.substring(0, 50)}...`)
                }
              }
            }
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
