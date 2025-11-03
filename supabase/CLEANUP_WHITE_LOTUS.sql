/**
 * Nettoyage: Supprimer les anciennes entrées de The White Lotus
 * À exécuter avant de rescanner
 */

-- Supprimer les épisodes de The White Lotus
DELETE FROM episodes 
WHERE series_id IN (
  SELECT id FROM series 
  WHERE title ILIKE '%White Lotus%'
);

-- Supprimer les séries The White Lotus
DELETE FROM series 
WHERE title ILIKE '%White Lotus%';

-- Vérification
SELECT 
  'Cleanup OK: The White Lotus supprimé' as status,
  COUNT(*) as remaining_series
FROM series 
WHERE title ILIKE '%White Lotus%';




