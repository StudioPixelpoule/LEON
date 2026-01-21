/**
 * Types TypeScript générés depuis le schéma Supabase
 * 
 * INSTRUCTIONS POUR RÉGÉNÉRER :
 * 1. Installer Supabase CLI : npm install -g supabase
 * 2. Définir l'ID du projet : export SUPABASE_PROJECT_ID=votre-id
 * 3. Exécuter : npm run gen:types
 * 
 * Ou directement :
 * npx supabase gen types typescript --project-id VOTRE_PROJECT_ID > lib/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      media: {
        Row: {
          id: string
          pcloud_fileid: string
          media_type: 'movie' | 'tv'
          title: string
          original_title: string | null
          year: number | null
          duration: number | null
          file_size: string | null
          quality: string | null
          tmdb_id: number | null
          poster_url: string | null
          backdrop_url: string | null
          overview: string | null
          genres: string[] | null
          movie_cast: Json | null
          director: Json | null
          rating: number | null
          vote_count: number | null
          tagline: string | null
          trailer_url: string | null
          watch_providers: Json | null
          release_date: string | null
          formatted_runtime: string | null
          subtitles: Json | null
          season_number: number | null
          episode_number: number | null
          show_name: string | null
          number_of_seasons: number | null
          number_of_episodes: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pcloud_fileid: string
          media_type: 'movie' | 'tv'
          title: string
          original_title?: string | null
          year?: number | null
          duration?: number | null
          file_size?: string | null
          quality?: string | null
          tmdb_id?: number | null
          poster_url?: string | null
          backdrop_url?: string | null
          overview?: string | null
          genres?: string[] | null
          movie_cast?: Json | null
          director?: Json | null
          rating?: number | null
          vote_count?: number | null
          tagline?: string | null
          trailer_url?: string | null
          watch_providers?: Json | null
          release_date?: string | null
          formatted_runtime?: string | null
          subtitles?: Json | null
          season_number?: number | null
          episode_number?: number | null
          show_name?: string | null
          number_of_seasons?: number | null
          number_of_episodes?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pcloud_fileid?: string
          media_type?: 'movie' | 'tv'
          title?: string
          original_title?: string | null
          year?: number | null
          duration?: number | null
          file_size?: string | null
          quality?: string | null
          tmdb_id?: number | null
          poster_url?: string | null
          backdrop_url?: string | null
          overview?: string | null
          genres?: string[] | null
          movie_cast?: Json | null
          director?: Json | null
          rating?: number | null
          vote_count?: number | null
          tagline?: string | null
          trailer_url?: string | null
          watch_providers?: Json | null
          release_date?: string | null
          formatted_runtime?: string | null
          subtitles?: Json | null
          season_number?: number | null
          episode_number?: number | null
          show_name?: string | null
          number_of_seasons?: number | null
          number_of_episodes?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          created_at?: string
        }
      }
      playback_positions: {
        Row: {
          id: string
          user_id: string
          media_id: string
          position: number
          duration: number | null
          media_type: 'movie' | 'episode' | null
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          media_id: string
          position: number
          duration?: number | null
          media_type?: 'movie' | 'episode' | null
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          media_id?: string
          position?: number
          duration?: number | null
          media_type?: 'movie' | 'episode' | null
          updated_at?: string
        }
      }
      favorites: {
        Row: {
          id: string
          user_id: string
          media_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          media_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          media_id?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Types utilitaires pour l'utilisation dans l'application
export type Media = Database['public']['Tables']['media']['Row']
export type MediaInsert = Database['public']['Tables']['media']['Insert']
export type MediaUpdate = Database['public']['Tables']['media']['Update']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type PlaybackPosition = Database['public']['Tables']['playback_positions']['Row']
export type Favorite = Database['public']['Tables']['favorites']['Row']
