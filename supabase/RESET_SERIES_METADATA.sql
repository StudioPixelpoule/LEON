-- ============================================
-- RESET des métadonnées séries pour re-validation
-- Garde les fichiers et series_name, mais vide les métadonnées TMDB
-- ============================================

UPDATE media
SET 
  tmdb_id = NULL,
  poster_url = NULL,
  backdrop_url = NULL,
  overview = NULL,
  genres = NULL,
  rating = NULL,
  vote_count = NULL,
  trailer_url = NULL,
  movie_cast = NULL,
  director = NULL,
  tagline = NULL,
  duration = NULL,
  formatted_runtime = NULL
WHERE media_type = 'tv'
  AND series_name IS NOT NULL;

-- Vérifier le résultat
SELECT 
  series_name,
  COUNT(*) as episodes,
  COUNT(*) FILTER (WHERE tmdb_id IS NOT NULL) as avec_tmdb,
  COUNT(*) FILTER (WHERE poster_url IS NOT NULL) as avec_poster
FROM media
WHERE media_type = 'tv'
GROUP BY series_name
ORDER BY series_name;


