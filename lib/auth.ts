/**
 * Utilitaires d'authentification Supabase
 * Utilise @supabase/ssr (remplace @supabase/auth-helpers-nextjs déprécié)
 */

import { createClient } from '@supabase/supabase-js'
import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr'

// Client pour les composants (côté client)
export const createBrowserClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises')
  }
  
  return createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Client pour les Server Components et API Routes
export const createServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseKey) {
    console.error('[AUTH] SUPABASE_SERVICE_ROLE_KEY manquante')
    throw new Error('SUPABASE_SERVICE_ROLE_KEY non configurée')
  }
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Types pour l'authentification
export type AuthUser = {
  id: string
  email: string
  displayName?: string
}

export type AuthError = {
  message: string
  code?: string
}
















