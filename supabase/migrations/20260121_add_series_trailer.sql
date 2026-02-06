-- ============================================
-- Migration: Ajout trailer_url pour séries TV
-- Date: 2026-01-21
-- ============================================

-- Ajouter la colonne trailer_url à la table series
ALTER TABLE series 
ADD COLUMN IF NOT EXISTS trailer_url TEXT;

-- Commentaire documentation
COMMENT ON COLUMN series.trailer_url IS 'URL YouTube de la bande-annonce de la série';
