-- ============================================
-- Correction : Row-Level Security (RLS)
-- Désactive RLS pour permettre l'insertion depuis l'API
-- ============================================

-- Désactiver RLS sur la table media
ALTER TABLE media DISABLE ROW LEVEL SECURITY;

-- Désactiver RLS sur la table manual_matches
ALTER TABLE manual_matches DISABLE ROW LEVEL SECURITY;

-- Note : Pour une application multi-utilisateurs, il faudrait
-- créer des politiques RLS appropriées au lieu de désactiver RLS.
-- Mais pour une application personnelle locale, c'est suffisant.




