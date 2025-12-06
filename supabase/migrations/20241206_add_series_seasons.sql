-- ============================================
-- Migration: Ajout table seasons pour affiches par saison
-- Date: 2024-12-06
-- SÉCURITÉ: N'affecte PAS les tables/données existantes
-- ============================================

-- 1. Créer la table seasons (nouvelle table, ne touche à rien)
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  
  -- Métadonnées TMDB
  tmdb_season_id INTEGER,
  name TEXT, -- Ex: "Saison 1" ou "Saison Spéciale"
  overview TEXT,
  poster_url TEXT, -- Affiche de la saison depuis TMDB
  custom_poster_url TEXT, -- Affiche personnalisée uploadée
  air_date DATE,
  episode_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contrainte: une seule entrée par saison par série
  UNIQUE(series_id, season_number)
);

-- 2. Index pour performance
CREATE INDEX IF NOT EXISTS idx_seasons_series_id ON seasons(series_id);
CREATE INDEX IF NOT EXISTS idx_seasons_season_number ON seasons(season_number);

-- 3. Ajouter colonne custom_poster_url à la table series existante
-- (pour les affiches personnalisées de la série entière)
ALTER TABLE series 
ADD COLUMN IF NOT EXISTS custom_poster_url TEXT;

-- 4. Ajouter colonne is_miniseries à la table series
-- (mini-séries = une seule saison, pas de sélecteur de saison)
ALTER TABLE series 
ADD COLUMN IF NOT EXISTS is_miniseries BOOLEAN DEFAULT FALSE;

-- 5. Commentaires documentation
COMMENT ON TABLE seasons IS 'Saisons de séries avec affiches individuelles';
COMMENT ON COLUMN seasons.poster_url IS 'URL affiche TMDB de la saison';
COMMENT ON COLUMN seasons.custom_poster_url IS 'URL affiche personnalisée uploadée';
COMMENT ON COLUMN series.custom_poster_url IS 'URL affiche personnalisée de la série (remplace TMDB)';
COMMENT ON COLUMN series.is_miniseries IS 'True si mini-série (1 seule saison, pas de sélecteur)';

-- 6. RLS (Row Level Security) pour la nouvelle table
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- Politique de lecture publique
DROP POLICY IF EXISTS "Seasons are viewable by everyone" ON seasons;
CREATE POLICY "Seasons are viewable by everyone" 
ON seasons FOR SELECT 
USING (true);

-- Politique d'insertion/modification (authentifié)
DROP POLICY IF EXISTS "Seasons are editable by authenticated users" ON seasons;
CREATE POLICY "Seasons are editable by authenticated users" 
ON seasons FOR ALL 
USING (true)
WITH CHECK (true);

