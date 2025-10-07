/**
 * Client Supabase pour authentification et base de données
 * Utilise les variables d'environnement Next.js
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Client Supabase (sera créé uniquement si les variables sont définies)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
)

// Types TypeScript pour la base de données
export type MediaType = 'movie' | 'tv'

export type Media = {
  id: string
  pcloud_fileid: string
  media_type: MediaType // 'movie' ou 'tv'
  title: string
  original_title: string | null
  year: number | null
  duration: number | null // en minutes
  file_size: string | null // Taille formatée "2.5 GB"
  quality: string | null // '1080p', '720p', '4K'
  tmdb_id: number | null
  poster_url: string | null
  backdrop_url: string | null
  overview: string | null
  genres: string[] | null
  movie_cast: Record<string, any> | null
  director: Record<string, any> | null
  rating: number | null
  vote_count: number | null
  tagline: string | null
  trailer_url: string | null
  watch_providers: Record<string, any> | null
  release_date: string | null
  formatted_runtime: string | null
  subtitles: Record<string, any> | null
  // Champs spécifiques aux séries TV
  season_number: number | null
  episode_number: number | null
  show_name: string | null
  number_of_seasons: number | null
  number_of_episodes: number | null
  created_at: string
  updated_at: string
}

export type Profile = {
  id: string
  username: string | null
  display_name: string | null
  created_at: string
}

export type Download = {
  id: string
  user_id: string
  media_id: string
  downloaded_at: string
  file_size: bigint | null
}

