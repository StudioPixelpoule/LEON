-- ============================================
-- RÉPARATION V2 : Extraction series_name CORRIGÉE
-- ============================================

-- Nettoyer d'abord les extensions et tags
-- Pattern : "Utopia S02e06.Final.vff.webdl.720p.mkv" 
--        → "Utopia" (series_name), 2 (season), 6 (episode)

UPDATE media 
SET 
  -- Extraire le nom AVANT S\d+[Ee]\d+ (sans exiger un espace)
  series_name = TRIM(regexp_replace(title, 'S\d+[Ee]\d+.*$', '', 'i')),
  -- Extraire saison (le chiffre après S)
  season_number = (regexp_match(title, 'S(\d+)[Ee]\d+', 'i'))[1]::INTEGER,
  -- Extraire épisode (le chiffre après E)
  episode_number = (regexp_match(title, 'S\d+[Ee](\d+)', 'i'))[1]::INTEGER
WHERE 
  media_type = 'tv'
  AND title ~* 'S\d+[Ee]\d+';

-- Nettoyer les series_name : enlever points, tirets, underscores
UPDATE media
SET series_name = TRIM(regexp_replace(
  regexp_replace(series_name, '[._-]', ' ', 'g'),
  '\s+', ' ', 'g'
))
WHERE media_type = 'tv' 
  AND series_name IS NOT NULL
  AND series_name != '';

-- Pattern alternatif : 1x01
UPDATE media 
SET 
  series_name = TRIM(regexp_replace(title, '\d+x\d+.*$', '', 'i')),
  season_number = (regexp_match(title, '(\d+)x\d+', 'i'))[1]::INTEGER,
  episode_number = (regexp_match(title, '\d+x(\d+)', 'i'))[1]::INTEGER
WHERE 
  media_type = 'tv'
  AND series_name IS NULL
  AND title ~* '\d+x\d+';

-- ✅ VÉRIFICATION FINALE
SELECT 
  'Résultats' as info,
  COUNT(*) as total_series,
  COUNT(*) FILTER (WHERE series_name IS NOT NULL AND series_name != '') as avec_nom,
  COUNT(*) FILTER (WHERE series_name IS NULL OR series_name = '') as sans_nom
FROM media
WHERE media_type = 'tv';

-- Échantillon de séries détectées
SELECT 
  title as titre_original,
  series_name as nom_serie,
  season_number as saison,
  episode_number as episode
FROM media
WHERE media_type = 'tv' 
  AND series_name IS NOT NULL 
  AND series_name != ''
ORDER BY series_name, season_number, episode_number
LIMIT 15;

-- Compter par série
SELECT 
  series_name,
  COUNT(*) as nb_episodes,
  MIN(season_number) as premiere_saison,
  MAX(season_number) as derniere_saison
FROM media
WHERE media_type = 'tv' 
  AND series_name IS NOT NULL
GROUP BY series_name
ORDER BY nb_episodes DESC
LIMIT 10;


