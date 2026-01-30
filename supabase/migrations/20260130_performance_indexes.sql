-- Migration: Index composites pour performance
-- Date: 30 janvier 2026
-- Description: Ajoute des index pour optimiser les requêtes fréquentes

-- =====================================================
-- 1. INDEX FAVORIS (requêtes par utilisateur + type)
-- =====================================================
-- Utilisé pour: GET /api/favorites (filtre par user_id, media_type)
CREATE INDEX IF NOT EXISTS idx_favorites_user_media_type 
  ON favorites(user_id, media_id, media_type);

-- Index pour le lookup rapide par utilisateur
CREATE INDEX IF NOT EXISTS idx_favorites_user_id 
  ON favorites(user_id);

-- =====================================================
-- 2. INDEX PLAYBACK POSITIONS (continuer la lecture)
-- =====================================================
-- Utilisé pour: GET /api/media/in-progress, playback-position
-- Optimise les requêtes de "continuer la lecture"
CREATE INDEX IF NOT EXISTS idx_playback_composite 
  ON playback_positions(user_id, media_id, media_type);

-- Index pour tri par date de mise à jour
CREATE INDEX IF NOT EXISTS idx_playback_updated 
  ON playback_positions(user_id, updated_at DESC);

-- =====================================================
-- 3. INDEX WATCH HISTORY (historique de visionnage)
-- =====================================================
-- Utilisé pour: GET /api/stats/history, dashboard stats
CREATE INDEX IF NOT EXISTS idx_watch_history_composite 
  ON watch_history(user_id, media_id, media_type);

-- Index pour tri par date de visionnage
CREATE INDEX IF NOT EXISTS idx_watch_history_date 
  ON watch_history(user_id, created_at DESC);

-- =====================================================
-- 4. INDEX EPISODES (navigation séries)
-- =====================================================
-- Utilisé pour: GET /api/series/[seriesId] (listing épisodes)
-- Optimise le tri par saison et numéro d'épisode
CREATE INDEX IF NOT EXISTS idx_episodes_series_season 
  ON episodes(series_id, season_number, episode_number);

-- Index pour lookup rapide par série
CREATE INDEX IF NOT EXISTS idx_episodes_series_id 
  ON episodes(series_id);

-- =====================================================
-- 5. INDEX MEDIA (recherche et listing)
-- =====================================================
-- Index pour recherche par titre (LIKE optimisé)
CREATE INDEX IF NOT EXISTS idx_media_title_trgm 
  ON media USING gin(title gin_trgm_ops);

-- Index pour tri par date de sortie
CREATE INDEX IF NOT EXISTS idx_media_release_date 
  ON media(release_date DESC NULLS LAST);

-- Index pour filtrage par genre (array contains)
CREATE INDEX IF NOT EXISTS idx_media_genres 
  ON media USING gin(genres);

-- =====================================================
-- 6. INDEX SERIES (recherche et listing)
-- =====================================================
-- Index pour recherche par titre
CREATE INDEX IF NOT EXISTS idx_series_title_trgm 
  ON series USING gin(title gin_trgm_ops);

-- Index pour tri par première diffusion
CREATE INDEX IF NOT EXISTS idx_series_first_air_date 
  ON series(first_air_date DESC NULLS LAST);

-- =====================================================
-- COMMENTAIRES
-- =====================================================
COMMENT ON INDEX idx_favorites_user_media_type IS 
  'Optimise les requêtes de favoris par utilisateur et type';
  
COMMENT ON INDEX idx_playback_composite IS 
  'Optimise les requêtes de positions de lecture pour "Continuer la lecture"';
  
COMMENT ON INDEX idx_episodes_series_season IS 
  'Optimise le listing d''épisodes triés par saison et numéro';

-- Note: L'extension pg_trgm doit être activée pour les index gin_trgm_ops
-- Si non disponible, exécuter: CREATE EXTENSION IF NOT EXISTS pg_trgm;
