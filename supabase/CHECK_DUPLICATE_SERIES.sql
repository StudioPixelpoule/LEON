/**
 * Script pour détecter et analyser les doublons de séries
 */

-- 1. Détecter les doublons par titre
SELECT 
  title,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as ids,
  STRING_AGG(COALESCE(local_folder_path, 'no path'), ' | ') as paths
FROM series
GROUP BY title
HAVING COUNT(*) > 1
ORDER BY count DESC, title;

-- 2. Détecter les doublons par TMDB ID
SELECT 
  tmdb_id,
  COUNT(*) as count,
  STRING_AGG(title, ', ') as titles,
  STRING_AGG(id::text, ', ') as ids
FROM series
WHERE tmdb_id IS NOT NULL
GROUP BY tmdb_id
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 3. Statistiques générales
SELECT 
  'Total séries' as info,
  COUNT(*) as count
FROM series
UNION ALL
SELECT 
  'Séries avec TMDB ID',
  COUNT(*)
FROM series
WHERE tmdb_id IS NOT NULL
UNION ALL
SELECT 
  'Doublons par titre',
  COUNT(*)
FROM (
  SELECT title
  FROM series
  GROUP BY title
  HAVING COUNT(*) > 1
) as duplicates
UNION ALL
SELECT 
  'Doublons par TMDB ID',
  COUNT(*)
FROM (
  SELECT tmdb_id
  FROM series
  WHERE tmdb_id IS NOT NULL
  GROUP BY tmdb_id
  HAVING COUNT(*) > 1
) as duplicates;




