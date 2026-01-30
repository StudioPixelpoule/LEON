export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      downloads: {
        Row: {
          downloaded_at: string | null
          file_size: number | null
          id: string
          media_id: string | null
          user_id: string | null
        }
        Insert: {
          downloaded_at?: string | null
          file_size?: number | null
          id?: string
          media_id?: string | null
          user_id?: string | null
        }
        Update: {
          downloaded_at?: string | null
          file_size?: number | null
          id?: string
          media_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "downloads_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "favorites_with_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downloads_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downloads_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_in_progress"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "downloads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          air_date: string | null
          created_at: string | null
          duration: number | null
          episode_number: number
          filepath: string | null
          id: string
          overview: string | null
          pcloud_fileid: string | null
          rating: number | null
          runtime: number | null
          season_number: number
          series_id: string | null
          still_url: string | null
          title: string
          tmdb_episode_id: number | null
          tmdb_series_id: number | null
          updated_at: string | null
        }
        Insert: {
          air_date?: string | null
          created_at?: string | null
          duration?: number | null
          episode_number: number
          filepath?: string | null
          id?: string
          overview?: string | null
          pcloud_fileid?: string | null
          rating?: number | null
          runtime?: number | null
          season_number: number
          series_id?: string | null
          still_url?: string | null
          title: string
          tmdb_episode_id?: number | null
          tmdb_series_id?: number | null
          updated_at?: string | null
        }
        Update: {
          air_date?: string | null
          created_at?: string | null
          duration?: number | null
          episode_number?: number
          filepath?: string | null
          id?: string
          overview?: string | null
          pcloud_fileid?: string | null
          rating?: number | null
          runtime?: number | null
          season_number?: number
          series_id?: string | null
          still_url?: string | null
          title?: string
          tmdb_episode_id?: number | null
          tmdb_series_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          media_id: string
          media_type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          media_id: string
          media_type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          media_id?: string
          media_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      manual_matches: {
        Row: {
          created_at: string | null
          filename: string
          id: string
          poster_path: string | null
          title: string
          tmdb_id: number
          updated_at: string | null
          user_id: string | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          filename: string
          id?: string
          poster_path?: string | null
          title: string
          tmdb_id: number
          updated_at?: string | null
          user_id?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          filename?: string
          id?: string
          poster_path?: string | null
          title?: string
          tmdb_id?: number
          updated_at?: string | null
          user_id?: string | null
          year?: number | null
        }
        Relationships: []
      }
      media: {
        Row: {
          backdrop_url: string | null
          chapters: Json | null
          created_at: string | null
          credits_start_time: number | null
          credits_timing_source: string | null
          director: Json | null
          duration: number | null
          file_size: string | null
          formatted_runtime: string | null
          genres: string[] | null
          id: string
          media_type: string | null
          movie_cast: Json | null
          number_of_episodes: number | null
          number_of_seasons: number | null
          original_title: string | null
          overview: string | null
          pcloud_fileid: string
          poster_url: string | null
          quality: string | null
          rating: number | null
          release_date: string | null
          show_name: string | null
          subtitles: Json | null
          tagline: string | null
          title: string
          tmdb_id: number | null
          trailer_url: string | null
          updated_at: string | null
          vote_count: number | null
          watch_providers: Json | null
          year: number | null
        }
        Insert: {
          backdrop_url?: string | null
          chapters?: Json | null
          created_at?: string | null
          credits_start_time?: number | null
          credits_timing_source?: string | null
          director?: Json | null
          duration?: number | null
          file_size?: string | null
          formatted_runtime?: string | null
          genres?: string[] | null
          id?: string
          media_type?: string | null
          movie_cast?: Json | null
          number_of_episodes?: number | null
          number_of_seasons?: number | null
          original_title?: string | null
          overview?: string | null
          pcloud_fileid: string
          poster_url?: string | null
          quality?: string | null
          rating?: number | null
          release_date?: string | null
          show_name?: string | null
          subtitles?: Json | null
          tagline?: string | null
          title: string
          tmdb_id?: number | null
          trailer_url?: string | null
          updated_at?: string | null
          vote_count?: number | null
          watch_providers?: Json | null
          year?: number | null
        }
        Update: {
          backdrop_url?: string | null
          chapters?: Json | null
          created_at?: string | null
          credits_start_time?: number | null
          credits_timing_source?: string | null
          director?: Json | null
          duration?: number | null
          file_size?: string | null
          formatted_runtime?: string | null
          genres?: string[] | null
          id?: string
          media_type?: string | null
          movie_cast?: Json | null
          number_of_episodes?: number | null
          number_of_seasons?: number | null
          original_title?: string | null
          overview?: string | null
          pcloud_fileid?: string
          poster_url?: string | null
          quality?: string | null
          rating?: number | null
          release_date?: string | null
          show_name?: string | null
          subtitles?: Json | null
          tagline?: string | null
          title?: string
          tmdb_id?: number | null
          trailer_url?: string | null
          updated_at?: string | null
          vote_count?: number | null
          watch_providers?: Json | null
          year?: number | null
        }
        Relationships: []
      }
      media_corrections: {
        Row: {
          confidence_before: number | null
          corrected_at: string | null
          corrected_by: string | null
          correction_reason: string | null
          id: string
          media_id: string | null
          new_poster_url: string | null
          new_title: string | null
          new_tmdb_id: number | null
          old_poster_url: string | null
          old_title: string | null
          old_tmdb_id: number | null
          source: string | null
        }
        Insert: {
          confidence_before?: number | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_reason?: string | null
          id?: string
          media_id?: string | null
          new_poster_url?: string | null
          new_title?: string | null
          new_tmdb_id?: number | null
          old_poster_url?: string | null
          old_title?: string | null
          old_tmdb_id?: number | null
          source?: string | null
        }
        Update: {
          confidence_before?: number | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_reason?: string | null
          id?: string
          media_id?: string | null
          new_poster_url?: string | null
          new_title?: string | null
          new_tmdb_id?: number | null
          old_poster_url?: string | null
          old_title?: string | null
          old_tmdb_id?: number | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_corrections_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "favorites_with_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_corrections_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_corrections_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_in_progress"
            referencedColumns: ["media_id"]
          },
        ]
      }
      media_optimization: {
        Row: {
          audio_tracks: Json | null
          audio_tracks_count: number | null
          completed_at: string | null
          created_at: string | null
          current_progress_time: string | null
          error_message: string | null
          estimated_time_remaining: string | null
          ffmpeg_log: string | null
          id: string
          media_id: string
          needs_optimization: boolean | null
          optimized_audio_codec: string | null
          optimized_bitrate: number | null
          optimized_codec: string | null
          optimized_filepath: string | null
          optimized_resolution: string | null
          optimized_size_bytes: number | null
          original_audio_codec: string | null
          original_bitrate: number | null
          original_codec: string | null
          original_filepath: string
          original_resolution: string | null
          original_size_bytes: number | null
          progress_percent: number | null
          space_saved_bytes: number | null
          space_saved_percent: number | null
          speed: string | null
          started_at: string | null
          status: string
          subtitle_tracks: Json | null
          subtitle_tracks_count: number | null
          updated_at: string | null
        }
        Insert: {
          audio_tracks?: Json | null
          audio_tracks_count?: number | null
          completed_at?: string | null
          created_at?: string | null
          current_progress_time?: string | null
          error_message?: string | null
          estimated_time_remaining?: string | null
          ffmpeg_log?: string | null
          id?: string
          media_id: string
          needs_optimization?: boolean | null
          optimized_audio_codec?: string | null
          optimized_bitrate?: number | null
          optimized_codec?: string | null
          optimized_filepath?: string | null
          optimized_resolution?: string | null
          optimized_size_bytes?: number | null
          original_audio_codec?: string | null
          original_bitrate?: number | null
          original_codec?: string | null
          original_filepath: string
          original_resolution?: string | null
          original_size_bytes?: number | null
          progress_percent?: number | null
          space_saved_bytes?: number | null
          space_saved_percent?: number | null
          speed?: string | null
          started_at?: string | null
          status?: string
          subtitle_tracks?: Json | null
          subtitle_tracks_count?: number | null
          updated_at?: string | null
        }
        Update: {
          audio_tracks?: Json | null
          audio_tracks_count?: number | null
          completed_at?: string | null
          created_at?: string | null
          current_progress_time?: string | null
          error_message?: string | null
          estimated_time_remaining?: string | null
          ffmpeg_log?: string | null
          id?: string
          media_id?: string
          needs_optimization?: boolean | null
          optimized_audio_codec?: string | null
          optimized_bitrate?: number | null
          optimized_codec?: string | null
          optimized_filepath?: string | null
          optimized_resolution?: string | null
          optimized_size_bytes?: number | null
          original_audio_codec?: string | null
          original_bitrate?: number | null
          original_codec?: string | null
          original_filepath?: string
          original_resolution?: string | null
          original_size_bytes?: number | null
          progress_percent?: number | null
          space_saved_bytes?: number | null
          space_saved_percent?: number | null
          speed?: string | null
          started_at?: string | null
          status?: string
          subtitle_tracks?: Json | null
          subtitle_tracks_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_optimization_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: true
            referencedRelation: "favorites_with_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_optimization_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: true
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_optimization_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: true
            referencedRelation: "media_in_progress"
            referencedColumns: ["media_id"]
          },
        ]
      }
      playback_positions: {
        Row: {
          created_at: string | null
          duration: number
          id: string
          media_id: string
          media_type: string
          position: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration?: number
          id?: string
          media_id: string
          media_type?: string
          position?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration?: number
          id?: string
          media_id?: string
          media_type?: string
          position?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          username: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id: string
          username?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      seasons: {
        Row: {
          air_date: string | null
          created_at: string | null
          custom_poster_url: string | null
          episode_count: number | null
          id: string
          name: string | null
          overview: string | null
          poster_url: string | null
          season_number: number
          series_id: string
          tmdb_season_id: number | null
          updated_at: string | null
        }
        Insert: {
          air_date?: string | null
          created_at?: string | null
          custom_poster_url?: string | null
          episode_count?: number | null
          id?: string
          name?: string | null
          overview?: string | null
          poster_url?: string | null
          season_number: number
          series_id: string
          tmdb_season_id?: number | null
          updated_at?: string | null
        }
        Update: {
          air_date?: string | null
          created_at?: string | null
          custom_poster_url?: string | null
          episode_count?: number | null
          id?: string
          name?: string | null
          overview?: string | null
          poster_url?: string | null
          season_number?: number
          series_id?: string
          tmdb_season_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          backdrop_url: string | null
          created_at: string | null
          created_by: string[] | null
          custom_poster_url: string | null
          first_air_date: string | null
          genres: string[] | null
          id: string
          is_miniseries: boolean | null
          last_air_date: string | null
          local_folder_path: string | null
          networks: string[] | null
          number_of_episodes: number | null
          number_of_seasons: number | null
          original_title: string | null
          overview: string | null
          pcloud_folder_path: string | null
          poster_url: string | null
          rating: number | null
          status: string | null
          title: string
          tmdb_id: number | null
          updated_at: string | null
        }
        Insert: {
          backdrop_url?: string | null
          created_at?: string | null
          created_by?: string[] | null
          custom_poster_url?: string | null
          first_air_date?: string | null
          genres?: string[] | null
          id?: string
          is_miniseries?: boolean | null
          last_air_date?: string | null
          local_folder_path?: string | null
          networks?: string[] | null
          number_of_episodes?: number | null
          number_of_seasons?: number | null
          original_title?: string | null
          overview?: string | null
          pcloud_folder_path?: string | null
          poster_url?: string | null
          rating?: number | null
          status?: string | null
          title: string
          tmdb_id?: number | null
          updated_at?: string | null
        }
        Update: {
          backdrop_url?: string | null
          created_at?: string | null
          created_by?: string[] | null
          custom_poster_url?: string | null
          first_air_date?: string | null
          genres?: string[] | null
          id?: string
          is_miniseries?: boolean | null
          last_air_date?: string | null
          local_folder_path?: string | null
          networks?: string[] | null
          number_of_episodes?: number | null
          number_of_seasons?: number | null
          original_title?: string | null
          overview?: string | null
          pcloud_folder_path?: string | null
          poster_url?: string | null
          rating?: number | null
          status?: string | null
          title?: string
          tmdb_id?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      series_credits_settings: {
        Row: {
          created_at: string | null
          credits_duration: number
          id: string
          season_number: number | null
          show_name: string
          timing_source: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credits_duration?: number
          id?: string
          season_number?: number | null
          show_name: string
          timing_source?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credits_duration?: number
          id?: string
          season_number?: number | null
          show_name?: string
          timing_source?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      watch_history: {
        Row: {
          completed: boolean | null
          created_at: string | null
          id: string
          media_id: string
          media_type: string
          user_id: string | null
          watch_duration: number | null
          watched_at: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          media_id: string
          media_type?: string
          user_id?: string | null
          watch_duration?: number | null
          watched_at?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          media_id?: string
          media_type?: string
          user_id?: string | null
          watch_duration?: number | null
          watched_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      favorites_with_media: {
        Row: {
          backdrop_url: string | null
          created_at: string | null
          director: Json | null
          duration: number | null
          favorite_id: string | null
          favorited_at: string | null
          file_size: string | null
          formatted_runtime: string | null
          genres: string[] | null
          id: string | null
          movie_cast: Json | null
          number_of_episodes: number | null
          number_of_seasons: number | null
          original_title: string | null
          overview: string | null
          pcloud_fileid: string | null
          poster_url: string | null
          quality: string | null
          rating: number | null
          release_date: string | null
          show_name: string | null
          subtitles: Json | null
          tagline: string | null
          title: string | null
          tmdb_id: number | null
          trailer_url: string | null
          updated_at: string | null
          user_id: string | null
          vote_count: number | null
          watch_providers: Json | null
          year: number | null
        }
        Relationships: []
      }
      media_in_progress: {
        Row: {
          backdrop_url: string | null
          last_watched: string | null
          media_duration: number | null
          media_id: string | null
          original_title: string | null
          overview: string | null
          playback_duration: number | null
          playback_position: number | null
          poster_url: string | null
          progress_id: string | null
          rating: number | null
          title: string | null
          watch_percentage: number | null
          year: number | null
        }
        Relationships: []
      }
      media_stats: {
        Row: {
          total_count: number | null
          with_poster: number | null
          without_poster: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_old_optimization_logs: { Args: never; Returns: undefined }
      get_credits_duration: {
        Args: { p_season_number: number; p_show_name: string }
        Returns: number
      }
      get_series_episodes: {
        Args: { p_series_name: string }
        Returns: {
          duration: number
          episode_number: number
          formatted_runtime: string
          id: string
          overview: string
          pcloud_fileid: string
          season_number: number
          title: string
        }[]
      }
      record_watch_completion: {
        Args: {
          p_completed?: boolean
          p_media_id: string
          p_media_type?: string
          p_user_id: string
          p_watch_duration?: number
        }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
