-- ============================================
-- MIGRATION: Support des séries TV
-- ============================================

-- 1. Ajouter les colonnes pour différencier films et séries
ALTER TABLE media ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'movie' CHECK (media_type IN ('movie', 'tv'));
ALTER TABLE media ADD COLUMN IF NOT EXISTS series_name TEXT; -- Nom de la série (pour grouper les épisodes)
ALTER TABLE media ADD COLUMN IF NOT EXISTS season_number INTEGER; -- Numéro de saison (NULL pour films)
ALTER TABLE media ADD COLUMN IF NOT EXISTS episode_number INTEGER; -- Numéro d'épisode (NULL pour films)

-- 2. Créer un index composite pour grouper efficacement les séries
CREATE INDEX IF NOT EXISTS idx_media_series_grouping ON media(series_name, season_number, episode_number) WHERE media_type = 'tv';
CREATE INDEX IF NOT EXISTS idx_media_type ON media(media_type);

-- 3. Ajouter un index sur series_name pour la recherche
CREATE INDEX IF NOT EXISTS idx_media_series_name ON media USING GIN(series_name gin_trgm_ops) WHERE media_type = 'tv';

-- 4. Mettre à jour les séries existantes (Better Call Saul, etc.)
-- Cette requête détecte automatiquement les séries déjà scannées
UPDATE media 
SET 
  media_type = 'tv',
  series_name = regexp_replace(title, '\s+S\d+E\d+.*$', '', 'i'),
  season_number = (regexp_match(title, 'S(\d+)E\d+', 'i'))[1]::INTEGER,
  episode_number = (regexp_match(title, 'S\d+E(\d+)', 'i'))[1]::INTEGER
WHERE 
  title ~* 'S\d+E\d+' -- Détecte le pattern S01E01
  AND media_type = 'movie'; -- Ne traite que ceux qui sont encore marqués comme films

-- 5. Créer une vue pour faciliter le groupement des séries
CREATE OR REPLACE VIEW tv_series_grouped AS
SELECT 
  series_name,
  media_type,
  MIN(tmdb_id) as tmdb_id, -- Prendre le premier tmdb_id trouvé
  MIN(poster_url) as poster_url,
  MIN(backdrop_url) as backdrop_url,
  MIN(overview) as overview,
  MIN(rating) as rating,
  MIN(release_date) as release_date,
  COUNT(*) as episode_count,
  COUNT(DISTINCT season_number) as season_count,
  MAX(created_at) as last_added,
  array_agg(DISTINCT genres) as all_genres
FROM media
WHERE media_type = 'tv'
GROUP BY series_name, media_type;

-- 6. Créer une fonction pour récupérer les épisodes d'une série
CREATE OR REPLACE FUNCTION get_series_episodes(p_series_name TEXT)
RETURNS TABLE(
  id UUID,
  title TEXT,
  season_number INTEGER,
  episode_number INTEGER,
  pcloud_fileid TEXT,
  duration INTEGER,
  formatted_runtime TEXT,
  overview TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.title,
    m.season_number,
    m.episode_number,
    m.pcloud_fileid,
    m.duration,
    m.formatted_runtime,
    m.overview
  FROM media m
  WHERE m.series_name = p_series_name
    AND m.media_type = 'tv'
  ORDER BY m.season_number, m.episode_number;
END;
$$ LANGUAGE plpgsql;

-- 7. Commentaires pour documentation
COMMENT ON COLUMN media.media_type IS 'Type de média: movie (film) ou tv (série)';
COMMENT ON COLUMN media.series_name IS 'Nom de la série (pour grouper les épisodes). NULL pour les films.';
COMMENT ON COLUMN media.season_number IS 'Numéro de saison (1, 2, 3...). NULL pour les films.';
COMMENT ON COLUMN media.episode_number IS 'Numéro d''épisode dans la saison. NULL pour les films.';


