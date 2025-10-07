-- ============================================
-- Fonction PostgreSQL: Groupement optimisé des séries TV
-- ============================================

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
      WHEN sort_column = 'rating' AND NOT sort_desc THEN MAX(m.rating)
      ELSE NULL
    END ASC NULLS LAST,
    CASE 
      WHEN sort_column = 'last_added' AND sort_desc THEN MAX(m.created_at)
      ELSE NULL
    END DESC NULLS LAST,
    CASE 
      WHEN sort_column = 'last_added' AND NOT sort_desc THEN MAX(m.created_at)
      ELSE NULL
    END ASC NULLS LAST,
    CASE 
      WHEN sort_column = 'title' AND sort_desc THEN m.series_name
      ELSE NULL
    END DESC NULLS LAST,
    CASE 
      WHEN sort_column = 'title' AND NOT sort_desc THEN m.series_name
      ELSE NULL
    END ASC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Exemple d'utilisation:
-- SELECT * FROM get_grouped_tv_series('rating', true, 20);


