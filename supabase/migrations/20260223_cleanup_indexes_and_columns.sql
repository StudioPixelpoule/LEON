-- Nettoyage : index redondants et colonnes obsoletes
-- Date : 2026-02-23

-- 1. Index redondants sur episodes
-- idx_episodes_series_id est un doublon exact de idx_episodes_series (meme btree sur series_id)
DROP INDEX IF EXISTS idx_episodes_series_id;

-- idx_episodes_season (series_id, season_number) est un sous-ensemble de
-- idx_episodes_series_season (series_id, season_number, episode_number)
DROP INDEX IF EXISTS idx_episodes_season;

-- 2. Colonnes obsoletes jamais utilisees dans le code
ALTER TABLE series DROP COLUMN IF EXISTS pcloud_folder_path;
ALTER TABLE series DROP COLUMN IF EXISTS custom_poster_url;
ALTER TABLE seasons DROP COLUMN IF EXISTS custom_poster_url;
