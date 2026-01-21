-- Migration: Ajout du timing des génériques de fin
-- Date: 2025-01-21
-- Description: Permet de stocker le moment exact où le générique commence
--              pour un passage automatique plus précis entre épisodes

-- 1. Ajouter la colonne credits_start_time (en secondes depuis le début)
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS credits_start_time INTEGER;

-- 2. Ajouter une colonne pour stocker les chapitres extraits du fichier
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS chapters JSONB;

-- 3. Ajouter un flag pour indiquer si le timing a été détecté automatiquement ou défini manuellement
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS credits_timing_source TEXT DEFAULT 'auto' 
CHECK (credits_timing_source IN ('auto', 'manual', 'chapters'));

-- Commentaires sur les colonnes
COMMENT ON COLUMN media.credits_start_time IS 'Moment où le générique de fin commence (en secondes). NULL = utiliser heuristique (45s avant la fin)';
COMMENT ON COLUMN media.chapters IS 'Chapitres extraits du fichier vidéo via FFprobe (format JSON)';
COMMENT ON COLUMN media.credits_timing_source IS 'Source du timing: auto (détection), manual (édité par user), chapters (extrait du fichier)';

-- Index pour les requêtes sur les chapitres
CREATE INDEX IF NOT EXISTS idx_media_credits_timing ON media(credits_start_time) WHERE credits_start_time IS NOT NULL;
