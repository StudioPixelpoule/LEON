-- Nettoyage des séries en doublon et ajout de contrainte d'unicité
-- Contexte : le watcher et le scan peuvent créer des doublons quand local_folder_path n'a pas de contrainte UNIQUE

-- 1. Transférer les épisodes des doublons vers la série principale (celle avec le plus d'épisodes)
DO $$
DECLARE
  dup_path TEXT;
  keep_id UUID;
  remove_id UUID;
  transferred INT;
BEGIN
  -- Pour chaque local_folder_path en doublon
  FOR dup_path IN
    SELECT local_folder_path
    FROM series
    WHERE local_folder_path IS NOT NULL
    GROUP BY local_folder_path
    HAVING COUNT(*) > 1
  LOOP
    -- Garder la série avec le plus d'épisodes (ou TMDB ID renseigné)
    SELECT id INTO keep_id
    FROM series s
    LEFT JOIN (
      SELECT series_id, COUNT(*) as ep_count
      FROM episodes
      GROUP BY series_id
    ) e ON e.series_id = s.id
    WHERE s.local_folder_path = dup_path
    ORDER BY
      (s.tmdb_id IS NOT NULL) DESC,
      COALESCE(e.ep_count, 0) DESC,
      s.created_at ASC
    LIMIT 1;

    -- Supprimer les doublons
    FOR remove_id IN
      SELECT id FROM series
      WHERE local_folder_path = dup_path AND id != keep_id
    LOOP
      -- Transférer les épisodes non-doublons vers la série principale
      UPDATE episodes
      SET series_id = keep_id
      WHERE series_id = remove_id
        AND NOT EXISTS (
          SELECT 1 FROM episodes existing
          WHERE existing.series_id = keep_id
            AND existing.season_number = episodes.season_number
            AND existing.episode_number = episodes.episode_number
        );

      GET DIAGNOSTICS transferred = ROW_COUNT;
      IF transferred > 0 THEN
        RAISE NOTICE 'Transféré % épisode(s) du doublon % vers %', transferred, remove_id, keep_id;
      END IF;

      -- Supprimer les épisodes restants (doublons exacts)
      DELETE FROM episodes WHERE series_id = remove_id;

      -- Supprimer la série doublon
      DELETE FROM series WHERE id = remove_id;
      RAISE NOTICE 'Série doublon supprimée: % (path: %)', remove_id, dup_path;
    END LOOP;
  END LOOP;
END $$;

-- 2. Contrainte d'unicité sur local_folder_path (empêche les futurs doublons)
CREATE UNIQUE INDEX IF NOT EXISTS idx_series_local_folder_path_unique
ON series(local_folder_path) WHERE local_folder_path IS NOT NULL;
