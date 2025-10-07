/**
 * Nettoyage complet des séries TV
 * Supprime toutes les entrées TV et les colonnes associées
 */

-- 1. Supprimer la vue qui dépend des colonnes TV
DROP VIEW IF EXISTS tv_series_grouped CASCADE;

-- 2. Supprimer la fonction de groupement TV
DROP FUNCTION IF EXISTS get_grouped_tv_series(TEXT, BOOLEAN, INTEGER);

-- 3. Supprimer toutes les entrées TV
DELETE FROM media WHERE media_type = 'tv';

-- 4. Supprimer les index liés aux séries
DROP INDEX IF EXISTS idx_media_series_name;
DROP INDEX IF EXISTS idx_media_season_episode;
DROP INDEX IF EXISTS idx_media_media_type;

-- 5. Supprimer les colonnes TV avec CASCADE
ALTER TABLE media DROP COLUMN IF EXISTS media_type CASCADE;
ALTER TABLE media DROP COLUMN IF EXISTS series_name CASCADE;
ALTER TABLE media DROP COLUMN IF EXISTS season_number CASCADE;
ALTER TABLE media DROP COLUMN IF EXISTS episode_number CASCADE;

-- Vérification
SELECT COUNT(*) as "Nombre de films restants" FROM media;

