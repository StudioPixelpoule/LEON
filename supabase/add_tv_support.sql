-- Migration: Ajout du support des séries TV
-- Date: 2024-10-07
-- Description: Ajoute les colonnes nécessaires pour gérer films ET séries TV

-- 1. Ajouter la colonne media_type
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'movie' CHECK (media_type IN ('movie', 'tv'));

-- 2. Ajouter les colonnes spécifiques aux séries TV
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS season_number INTEGER,
ADD COLUMN IF NOT EXISTS episode_number INTEGER,
ADD COLUMN IF NOT EXISTS show_name TEXT,
ADD COLUMN IF NOT EXISTS number_of_seasons INTEGER,
ADD COLUMN IF NOT EXISTS number_of_episodes INTEGER;

-- 3. Créer un index sur media_type pour les requêtes filtrées
CREATE INDEX IF NOT EXISTS idx_media_type ON media(media_type);

-- 4. Créer un index composite pour les séries (show_name + season + episode)
CREATE INDEX IF NOT EXISTS idx_tv_episodes ON media(show_name, season_number, episode_number) 
WHERE media_type = 'tv';

-- 5. Mettre à jour les films existants pour s'assurer qu'ils ont media_type = 'movie'
UPDATE media 
SET media_type = 'movie' 
WHERE media_type IS NULL;

-- Commentaires sur les colonnes
COMMENT ON COLUMN media.media_type IS 'Type de média: movie (film) ou tv (série)';
COMMENT ON COLUMN media.season_number IS 'Numéro de saison (séries uniquement)';
COMMENT ON COLUMN media.episode_number IS 'Numéro d''épisode (séries uniquement)';
COMMENT ON COLUMN media.show_name IS 'Nom de la série (séries uniquement)';
COMMENT ON COLUMN media.number_of_seasons IS 'Nombre total de saisons (séries uniquement)';
COMMENT ON COLUMN media.number_of_episodes IS 'Nombre total d''épisodes (séries uniquement)';

