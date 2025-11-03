/**
 * Script pour supprimer les doublons de séries
 * Garde uniquement la série la plus récente (par created_at) pour chaque doublon
 */

-- BACKUP: Créer une table temporaire pour sauvegarder les IDs supprimés
CREATE TEMP TABLE IF NOT EXISTS deleted_series_backup AS
SELECT * FROM series WHERE 1=0;

-- 1. Supprimer les doublons par TMDB ID (garder le plus récent)
WITH duplicates AS (
  SELECT 
    id,
    tmdb_id,
    title,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY tmdb_id 
      ORDER BY created_at DESC, id
    ) as rn
  FROM series
  WHERE tmdb_id IS NOT NULL
)
DELETE FROM series
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
)
RETURNING *;

-- 2. Supprimer les doublons par titre (garder le plus récent)
WITH duplicates AS (
  SELECT 
    id,
    title,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(title))
      ORDER BY 
        CASE WHEN tmdb_id IS NOT NULL THEN 0 ELSE 1 END, -- Priorité aux séries avec TMDB ID
        created_at DESC,
        id
    ) as rn
  FROM series
)
DELETE FROM series
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
)
RETURNING *;

-- 3. Vérification finale
SELECT 
  'Séries restantes' as status,
  COUNT(*) as count
FROM series;

-- 4. Afficher les séries qui étaient en doublon (pour info)
SELECT 
  title,
  COUNT(*) as remaining_count
FROM series
GROUP BY title
HAVING COUNT(*) > 1;




