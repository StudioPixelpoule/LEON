-- Migration: Paramètres de générique par série/saison
-- Date: 2025-01-21
-- Description: Permet de définir la durée du générique par série avec override par saison

-- Table pour stocker les paramètres de générique
CREATE TABLE IF NOT EXISTS series_credits_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identifiant de la série (show_name de la table media)
  show_name TEXT NOT NULL,
  
  -- Numéro de saison (NULL = valeur par défaut pour toute la série)
  season_number INTEGER,
  
  -- Durée du générique en secondes (depuis la fin de l'épisode)
  -- Ex: 90 = le générique commence 90s avant la fin
  credits_duration INTEGER NOT NULL DEFAULT 45,
  
  -- Source du timing
  timing_source TEXT DEFAULT 'manual' CHECK (timing_source IN ('manual', 'auto', 'chapters')),
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contrainte d'unicité : une seule entrée par série/saison
  UNIQUE(show_name, season_number)
);

-- Index pour les requêtes
CREATE INDEX IF NOT EXISTS idx_series_credits_show_name ON series_credits_settings(show_name);
CREATE INDEX IF NOT EXISTS idx_series_credits_season ON series_credits_settings(show_name, season_number);

-- Trigger pour updated_at
CREATE TRIGGER series_credits_settings_updated_at
  BEFORE UPDATE ON series_credits_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS désactivé (application personnelle)
ALTER TABLE series_credits_settings DISABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE series_credits_settings IS 'Paramètres de durée du générique par série avec possibilité d''override par saison';
COMMENT ON COLUMN series_credits_settings.show_name IS 'Nom de la série (correspond à media.show_name)';
COMMENT ON COLUMN series_credits_settings.season_number IS 'Numéro de saison (NULL = valeur par défaut pour toute la série)';
COMMENT ON COLUMN series_credits_settings.credits_duration IS 'Durée du générique en secondes depuis la fin de l''épisode';

-- Fonction pour obtenir la durée du générique pour un épisode
CREATE OR REPLACE FUNCTION get_credits_duration(p_show_name TEXT, p_season_number INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_duration INTEGER;
BEGIN
  -- Chercher d'abord un override pour cette saison spécifique
  SELECT credits_duration INTO v_duration
  FROM series_credits_settings
  WHERE show_name = p_show_name AND season_number = p_season_number;
  
  IF FOUND THEN
    RETURN v_duration;
  END IF;
  
  -- Sinon, chercher la valeur par défaut de la série (season_number IS NULL)
  SELECT credits_duration INTO v_duration
  FROM series_credits_settings
  WHERE show_name = p_show_name AND season_number IS NULL;
  
  IF FOUND THEN
    RETURN v_duration;
  END IF;
  
  -- Aucun paramètre trouvé, retourner la valeur par défaut (45s)
  RETURN 45;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_credits_duration IS 'Retourne la durée du générique pour une série/saison (avec fallback)';
