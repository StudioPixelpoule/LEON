-- ============================================
-- CORRECTION SÉCURITÉ RLS - LEON
-- Date: 2024-12-03
-- ============================================

-- ============================================
-- 1. ACTIVER RLS SUR LES TABLES
-- ============================================

-- Table manual_matches : activer RLS (les policies existent déjà)
ALTER TABLE public.manual_matches ENABLE ROW LEVEL SECURITY;

-- Table media : activer RLS (la policy existe déjà)
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. CORRIGER LES VUES SECURITY DEFINER
-- ============================================

-- Recréer media_stats avec SECURITY INVOKER
DROP VIEW IF EXISTS public.media_stats;
CREATE VIEW public.media_stats 
WITH (security_invoker = true)
AS
SELECT 
  COUNT(*) as total_count,
  COUNT(CASE WHEN media_type = 'movie' THEN 1 END) as movie_count,
  COUNT(CASE WHEN media_type = 'tv' THEN 1 END) as tv_count,
  COUNT(CASE WHEN poster_url IS NOT NULL AND poster_url != '' THEN 1 END) as with_poster,
  COUNT(CASE WHEN poster_url IS NULL OR poster_url = '' THEN 1 END) as without_poster
FROM public.media;

-- Recréer favorites_with_media avec SECURITY INVOKER
DROP VIEW IF EXISTS public.favorites_with_media;
CREATE VIEW public.favorites_with_media 
WITH (security_invoker = true)
AS
SELECT 
  f.id as favorite_id,
  f.user_id,
  f.created_at as favorited_at,
  m.*
FROM public.favorites f
JOIN public.media m ON f.media_id = m.id;

-- Recréer media_in_progress avec SECURITY INVOKER
DROP VIEW IF EXISTS public.media_in_progress;
CREATE VIEW public.media_in_progress 
WITH (security_invoker = true)
AS
SELECT 
  p.id as progress_id,
  p.user_id,
  p.position,
  p.duration,
  p.updated_at as last_watched,
  p.episode_id,
  CASE 
    WHEN p.duration > 0 THEN ROUND((p.position::numeric / p.duration::numeric) * 100, 1)
    ELSE 0
  END as watch_percentage,
  m.*
FROM public.watch_progress p
JOIN public.media m ON p.media_id = m.id
WHERE p.position > 60  -- Au moins 1 minute regardée
  AND (p.duration = 0 OR (p.position::numeric / p.duration::numeric) < 0.95);  -- Pas terminé

-- ============================================
-- 3. DONNER LES PERMISSIONS SUR LES VUES
-- ============================================

GRANT SELECT ON public.media_stats TO authenticated, anon;
GRANT SELECT ON public.favorites_with_media TO authenticated;
GRANT SELECT ON public.media_in_progress TO authenticated;

-- ============================================
-- VÉRIFICATION
-- ============================================
-- Après exécution, relancer le linter Supabase pour confirmer
-- que toutes les erreurs sont résolues.



