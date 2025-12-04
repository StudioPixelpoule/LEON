-- Script pour mettre à jour les chemins des films pour le NAS
-- Remplace le chemin Mac par le chemin Docker

-- Vérifier d'abord combien de films sont concernés
SELECT COUNT(*) as films_a_mettre_a_jour 
FROM media 
WHERE file_path LIKE '/Users/lionelvernay/pCloud Drive/films/%';

-- Mettre à jour les chemins
UPDATE media 
SET file_path = REPLACE(file_path, '/Users/lionelvernay/pCloud Drive/films/', '/leon/media/films/')
WHERE file_path LIKE '/Users/lionelvernay/pCloud Drive/films/%';

-- Vérifier le résultat
SELECT id, title, file_path 
FROM media 
LIMIT 5;












