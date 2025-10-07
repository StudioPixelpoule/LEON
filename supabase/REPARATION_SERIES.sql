-- ============================================
-- RÉPARATION : Remplir series_name pour les séries existantes
-- ============================================

-- Cette requête détecte les patterns dans les titres et remplit series_name

-- Pattern 1 : S01E01 (standard)
UPDATE media 
SET 
  series_name = regexp_replace(title, '\s+S\d+[Ee]\d+.*$', '', 'i'),
  season_number = (regexp_match(title, '[Ss](\d+)[Ee]\d+', 'i'))[1]::INTEGER,
  episode_number = (regexp_match(title, '[Ss]\d+[Ee](\d+)', 'i'))[1]::INTEGER
WHERE 
  media_type = 'tv'
  AND series_name IS NULL
  AND title ~* 'S\d+E\d+';

-- Pattern 2 : S01e01 (minuscule)
UPDATE media 
SET 
  series_name = regexp_replace(title, '\s+[Ss]\d+[Ee]\d+.*$', '', 'i'),
  season_number = (regexp_match(title, '[Ss](\d+)[Ee]\d+', 'i'))[1]::INTEGER,
  episode_number = (regexp_match(title, '[Ss]\d+[Ee](\d+)', 'i'))[1]::INTEGER
WHERE 
  media_type = 'tv'
  AND series_name IS NULL
  AND title ~* '[Ss]\d+[Ee]\d+';

-- Pattern 3 : 1x01 (alternatif)
UPDATE media 
SET 
  series_name = regexp_replace(title, '\s+\d+x\d+.*$', '', 'i'),
  season_number = (regexp_match(title, '(\d+)x\d+', 'i'))[1]::INTEGER,
  episode_number = (regexp_match(title, '\d+x(\d+)', 'i'))[1]::INTEGER
WHERE 
  media_type = 'tv'
  AND series_name IS NULL
  AND title ~* '\d+x\d+';

-- Nettoyer les series_name (enlever les points, tirets, etc.)
UPDATE media
SET series_name = regexp_replace(
  regexp_replace(series_name, '[._-]', ' ', 'g'),
  '\s+', ' ', 'g'
)
WHERE media_type = 'tv' AND series_name IS NOT NULL;

-- Nettoyer les espaces en début/fin
UPDATE media
SET series_name = TRIM(series_name)
WHERE media_type = 'tv' AND series_name IS NOT NULL;

-- ✅ Vérification
SELECT 
  COUNT(*) as total_series,
  COUNT(*) FILTER (WHERE series_name IS NOT NULL) as avec_series_name,
  COUNT(*) FILTER (WHERE series_name IS NULL) as sans_series_name
FROM media
WHERE media_type = 'tv';

-- Afficher quelques exemples
SELECT title, series_name, season_number, episode_number
FROM media
WHERE media_type = 'tv' AND series_name IS NOT NULL
LIMIT 10;


