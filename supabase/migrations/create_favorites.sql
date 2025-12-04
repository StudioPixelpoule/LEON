-- ============================================
-- Migration: Table des favoris (Ma liste)
-- Permet aux utilisateurs de sauvegarder leurs films préférés
-- ============================================

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL,
  media_type TEXT DEFAULT 'movie', -- 'movie' ou 'series'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Un seul favori par utilisateur par média
  UNIQUE(user_id, media_id, media_type)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_media_id ON favorites(media_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorites(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Policies : chaque utilisateur ne voit que ses propres favoris
CREATE POLICY "Favoris lisibles par propriétaire" 
  ON favorites FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Favoris créables par propriétaire" 
  ON favorites FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Favoris supprimables par propriétaire" 
  ON favorites FOR DELETE 
  USING (auth.uid() = user_id);

-- Policy pour les utilisateurs non authentifiés (mode sans auth)
-- Permet l'accès si user_id est NULL (mode local sans auth)
CREATE POLICY "Favoris accessibles sans auth" 
  ON favorites FOR ALL 
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

-- Vue pour récupérer les favoris avec infos complètes du média
CREATE OR REPLACE VIEW favorites_with_media AS
SELECT 
  f.id as favorite_id,
  f.user_id,
  f.media_type,
  f.created_at as favorited_at,
  m.id,
  m.title,
  m.original_title,
  m.year,
  m.poster_url,
  m.backdrop_url,
  m.overview,
  m.rating,
  m.genres,
  m.formatted_runtime,
  m.tmdb_id,
  m.pcloud_fileid
FROM favorites f
INNER JOIN media m ON f.media_id = m.id::TEXT
WHERE f.media_type = 'movie'
ORDER BY f.created_at DESC;

-- Commentaires
COMMENT ON TABLE favorites IS 'Liste des films/séries favoris par utilisateur';
COMMENT ON COLUMN favorites.media_type IS 'Type de média: movie ou series';










