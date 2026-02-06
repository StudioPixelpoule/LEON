-- ============================================
-- Migration: Filtrer is_transcoded dans la vue favorites_with_media
-- Date: 2026-01-21
-- ============================================

-- Mettre à jour la vue favorites_with_media pour exclure les médias non transcodés
CREATE OR REPLACE VIEW favorites_with_media AS
SELECT 
  f.id as favorite_id,
  f.user_id,
  f.media_type,
  f.created_at as favorited_at,
  m.id,
  m.title,
  m.original_title,
  m.year,
  m.poster_url,
  m.backdrop_url,
  m.overview,
  m.rating,
  m.genres,
  m.formatted_runtime,
  m.tmdb_id,
  m.pcloud_fileid,
  m.duration,
  m.file_size,
  m.quality,
  m.trailer_url,
  m.tagline,
  m.vote_count,
  m.release_date
FROM favorites f
INNER JOIN media m ON f.media_id = m.id::TEXT
WHERE f.media_type = 'movie'
  AND (m.is_transcoded = true OR m.is_transcoded IS NULL)
ORDER BY f.created_at DESC;

-- Commentaire documentation
COMMENT ON VIEW favorites_with_media IS 'Vue des favoris avec médias transcodés uniquement';
