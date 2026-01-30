-- Migration: Corrections de sécurité RLS
-- Date: 30 janvier 2026
-- Description: Active RLS sur les tables manquantes et restreint les policies

-- =====================================================
-- 1. ACTIVER RLS SUR manual_matches
-- =====================================================
ALTER TABLE IF EXISTS public.manual_matches ENABLE ROW LEVEL SECURITY;

-- Politique de lecture pour les utilisateurs authentifiés
DROP POLICY IF EXISTS "manual_matches_authenticated_read" ON public.manual_matches;
CREATE POLICY "manual_matches_authenticated_read" 
  ON public.manual_matches
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Politique d'écriture pour les utilisateurs authentifiés (admin)
DROP POLICY IF EXISTS "manual_matches_authenticated_write" ON public.manual_matches;
CREATE POLICY "manual_matches_authenticated_write" 
  ON public.manual_matches
  FOR ALL 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 2. RESTREINDRE media_optimization
-- =====================================================
-- Supprimer les anciennes policies trop permissives
DROP POLICY IF EXISTS "Lecture publique" ON public.media_optimization;
DROP POLICY IF EXISTS "media_optimization_public_read" ON public.media_optimization;

-- Activer RLS si pas déjà actif
ALTER TABLE IF EXISTS public.media_optimization ENABLE ROW LEVEL SECURITY;

-- Nouvelle politique: lecture pour authentifiés seulement
CREATE POLICY "media_optimization_authenticated_read" 
  ON public.media_optimization
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Écriture pour authentifiés seulement
DROP POLICY IF EXISTS "media_optimization_authenticated_write" ON public.media_optimization;
CREATE POLICY "media_optimization_authenticated_write" 
  ON public.media_optimization
  FOR ALL 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 3. VÉRIFIER series_credits_settings (déjà créé)
-- =====================================================
-- Cette table a été corrigée dans une migration précédente (20250121_fix_rls_series_credits.sql)
-- On vérifie simplement que RLS est bien activé
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'series_credits_settings'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.series_credits_settings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================================================
-- 4. VÉRIFIER downloads TABLE
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'downloads'
  ) THEN
    -- Activer RLS
    ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
    
    -- Politique: chaque utilisateur ne voit que ses propres téléchargements
    DROP POLICY IF EXISTS "downloads_own_only" ON public.downloads;
    CREATE POLICY "downloads_own_only" 
      ON public.downloads
      FOR ALL 
      TO authenticated 
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- =====================================================
-- COMMENTAIRES
-- =====================================================
COMMENT ON POLICY "manual_matches_authenticated_read" ON public.manual_matches IS 
  'Lecture autorisée pour tous les utilisateurs authentifiés';

COMMENT ON POLICY "media_optimization_authenticated_read" ON public.media_optimization IS 
  'Lecture autorisée pour tous les utilisateurs authentifiés uniquement';
