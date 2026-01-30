/**
 * Client Supabase pour authentification et base de données
 * Utilise les variables d'environnement Next.js
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Vérification des variables d'environnement requises
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables d\'environnement NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises. ' +
    'Vérifiez votre fichier .env.local'
  )
}

// Client Supabase public (pour le navigateur)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper function pour créer un client Supabase (compatibilité avec les routes API)
export function createSupabaseClient(): SupabaseClient {
  return supabase
}

// Client Supabase admin (pour les API routes - bypass RLS)
let supabaseAdmin: SupabaseClient | null = null

export function createSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin && supabaseUrl && supabaseServiceKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }
  
  // Fallback sur le client normal si pas de service key
  return supabaseAdmin || supabase
}

// Types TypeScript pour la base de données
// Importés depuis les types générés par Supabase CLI
// Pour régénérer : npm run gen:types
import type { Database } from './database.types'
export type { Database }

// Types dérivés des tables Supabase
export type Media = Database['public']['Tables']['media']['Row']
export type MediaInsert = Database['public']['Tables']['media']['Insert']
export type MediaUpdate = Database['public']['Tables']['media']['Update']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type PlaybackPosition = Database['public']['Tables']['playback_positions']['Row']
export type Favorite = Database['public']['Tables']['favorites']['Row']

// Type pour rétrocompatibilité
export type MediaType = 'movie' | 'tv'

// Type Download (non géré par la génération automatique si table absente)
export type Download = {
  id: string
  user_id: string
  media_id: string
  downloaded_at: string
  file_size: bigint | null
}

