/**
 * Utilitaires d'authentification Supabase
 */

import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Client pour les composants (côté client)
export const createBrowserClient = () => {
  return createClientComponentClient()
}

// Client pour les Server Components et API Routes
export const createServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
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






