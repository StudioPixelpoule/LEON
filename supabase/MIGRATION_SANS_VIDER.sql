-- ============================================
-- MIGRATION SANS VIDER LA BASE
-- Préserve vos corrections manuelles !
-- ============================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PARTIE 1 : Ajouter les colonnes (si pas déjà fait)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE media ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'movie' CHECK (media_type IN ('movie', 'tv'));
ALTER TABLE media ADD COLUMN IF NOT EXISTS series_name TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS season_number INTEGER;
ALTER TABLE media ADD COLUMN IF NOT EXISTS episode_number INTEGER;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PARTIE 2 : Détecter et marquer les séries EXISTANTES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Mettre à jour UNIQUEMENT les médias qui ont le pattern S01E01
UPDATE media 
SET 
  media_type = 'tv',
  series_name = regexp_replace(title, '\s+S\d+E\d+.*$', '', 'i'),
  season_number = (regexp_match(title, 'S(\d+)E\d+', 'i'))[1]::INTEGER,
  episode_number = (regexp_match(title, 'S\d+E(\d+)', 'i'))[1]::INTEGER
WHERE 
  title ~* 'S\d+E\d+' -- Contient S01E01, S02E03, etc.
  AND media_type = 'movie'; -- Seulement ceux qui n'ont pas encore été marqués

-- Mettre à jour TOUS les autres médias comme "movie" par défaut
UPDATE media
SET media_type = 'movie'
WHERE media_type IS NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PARTIE 3 : Index pour performance
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_media_type ON media(media_type);
CREATE INDEX IF NOT EXISTS idx_media_series_grouping ON media(series_name, season_number, episode_number) WHERE media_type = 'tv';
CREATE INDEX IF NOT EXISTS idx_media_series_name ON media USING GIN(series_name gin_trgm_ops) WHERE media_type = 'tv';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PARTIE 4 : Fonction de groupement
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION get_grouped_tv_series(
  sort_column TEXT DEFAULT 'last_added',
  sort_desc BOOLEAN DEFAULT TRUE,
  limit_count INTEGER DEFAULT NULL
)
RETURNS TABLE(
  series_name TEXT,
  tmdb_id INTEGER,
  poster_url TEXT,
  backdrop_url TEXT,
  overview TEXT,
  rating DECIMAL(3,1),
  release_date TIMESTAMP WITH TIME ZONE,
  year INTEGER,
  genres TEXT[],
  episode_count BIGINT,
  season_count BIGINT,
  last_added TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.series_name,
    MIN(m.tmdb_id) as tmdb_id,
    MIN(m.poster_url) FILTER (WHERE m.poster_url IS NOT NULL) as poster_url,
    MIN(m.backdrop_url) FILTER (WHERE m.backdrop_url IS NOT NULL) as backdrop_url,
    MIN(m.overview) FILTER (WHERE m.overview IS NOT NULL) as overview,
    MAX(m.rating) as rating,
    MIN(m.release_date) as release_date,
    MIN(m.year) as year,
    array_remove(array_agg(DISTINCT unnest(m.genres)), NULL) as genres,
    COUNT(*) as episode_count,
    COUNT(DISTINCT m.season_number) as season_count,
    MAX(m.created_at) as last_added
  FROM media m
  WHERE m.media_type = 'tv'
    AND m.series_name IS NOT NULL
    AND m.poster_url IS NOT NULL
  GROUP BY m.series_name
  ORDER BY
    CASE 
      WHEN sort_column = 'rating' AND sort_desc THEN MAX(m.rating)
      ELSE NULL
    END DESC NULLS LAST,
    CASE 
      WHEN sort_column = 'last_added' AND sort_desc THEN MAX(m.created_at)
      ELSE NULL
    END DESC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PARTIE 5 : Storage pour jaquettes personnalisées
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO storage.buckets (id, name, public)
VALUES ('custom-posters', 'custom-posters', true)
ON CONFLICT (id) DO NOTHING;

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public updates" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;
  
  CREATE POLICY "Allow public uploads"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'custom-posters');
  
  CREATE POLICY "Allow public reads"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'custom-posters');
  
  CREATE POLICY "Allow public updates"
  ON storage.objects FOR UPDATE
  TO public
  USING (bucket_id = 'custom-posters');
  
  CREATE POLICY "Allow public deletes"
  ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'custom-posters');
END $$;

UPDATE storage.buckets
SET 
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE id = 'custom-posters';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ✅ MIGRATION TERMINÉE SANS PERTE DE DONNÉES !
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Statistiques finales :
SELECT 
  COUNT(*) FILTER (WHERE media_type = 'movie') as films,
  COUNT(*) FILTER (WHERE media_type = 'tv') as episodes_series,
  COUNT(DISTINCT series_name) FILTER (WHERE media_type = 'tv') as series_distinctes,
  COUNT(*) FILTER (WHERE tmdb_id IS NOT NULL) as avec_metadata,
  COUNT(*) FILTER (WHERE poster_url IS NOT NULL) as avec_poster
FROM media;

-- Top 5 séries détectées :
SELECT series_name, COUNT(*) as nb_episodes, MAX(season_number) as saisons
FROM media
WHERE media_type = 'tv' AND series_name IS NOT NULL
GROUP BY series_name
ORDER BY nb_episodes DESC
LIMIT 5;


