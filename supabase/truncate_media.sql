-- Vider la table media pour relancer un scan complet
-- ⚠️ ATTENTION : Cela supprimera TOUS les films actuellement indexés !

TRUNCATE TABLE media RESTART IDENTITY CASCADE;

-- Vérification
SELECT COUNT(*) as films_restants FROM media;

