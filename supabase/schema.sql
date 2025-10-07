-- ============================================
-- LEON - Schéma de base de données Supabase
-- ============================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extension pour recherche full-text (optionnel)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- Table: media
-- Stocke tous les fichiers vidéo indexés
-- ============================================
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pcloud_fileid TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  original_title TEXT,
  year INTEGER,
  duration INTEGER, -- en minutes
  formatted_runtime TEXT, -- Format "2h 15min"
  file_size TEXT, -- Taille formatée "2.5 GB"
  quality TEXT, -- '1080p', '720p', '4K', etc.
  tmdb_id INTEGER,
  poster_url TEXT,
  backdrop_url TEXT,
  overview TEXT,
  genres TEXT[], -- Array de genres
  movie_cast JSONB, -- Casting complet depuis TMDB
  director JSONB, -- Réalisateur avec photo
  rating DECIMAL(3,1), -- Note TMDB sur 10
  vote_count INTEGER, -- Nombre de votes TMDB
  tagline TEXT, -- Phrase d'accroche du film
  trailer_url TEXT, -- Lien YouTube de la bande-annonce
  watch_providers JSONB, -- Plateformes de streaming disponibles
  release_date TIMESTAMP WITH TIME ZONE, -- Date de sortie complète
  subtitles JSONB, -- Fichiers sous-titres disponibles
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_media_title ON media(title);
CREATE INDEX IF NOT EXISTS idx_media_year ON media(year);
CREATE INDEX IF NOT EXISTS idx_media_genres ON media USING GIN(genres);
CREATE INDEX IF NOT EXISTS idx_media_tmdb_id ON media(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_rating ON media(rating DESC);
CREATE INDEX IF NOT EXISTS idx_media_release_date ON media(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_media_director ON media USING GIN((director->>'name') gin_trgm_ops);

-- Index pour recherche full-text (optionnel mais recommandé)
CREATE INDEX IF NOT EXISTS idx_media_title_trgm ON media USING GIN(title gin_trgm_ops);

-- ============================================
-- Table: profiles (Phase 2 - Multi-users)
-- Profils utilisateurs étendant auth.users
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- ============================================
-- Table: downloads (Phase 2)
-- Historique des téléchargements par utilisateur
-- ============================================
CREATE TABLE IF NOT EXISTS downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  file_size BIGINT
);

-- Index
CREATE INDEX IF NOT EXISTS idx_downloads_user_id ON downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_media_id ON downloads(media_id);
CREATE INDEX IF NOT EXISTS idx_downloads_downloaded_at ON downloads(downloaded_at DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Désactiver RLS sur media (application personnelle locale)
-- Permet l'insertion directe depuis l'API sans authentification
ALTER TABLE media DISABLE ROW LEVEL SECURITY;

-- Activer RLS sur les tables utilisateurs (pour Phase 2)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;

-- Politique pour profiles (lecture propre profil uniquement)
CREATE POLICY "Profils lisibles par propriétaire" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Profils modifiables par propriétaire" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Politique pour downloads (propre historique uniquement)
CREATE POLICY "Downloads lisibles par propriétaire" 
  ON downloads FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Downloads créables par propriétaire" 
  ON downloads FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Fonctions utilitaires
-- ============================================

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour media
CREATE TRIGGER update_media_updated_at 
  BEFORE UPDATE ON media
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour créer automatiquement un profil après inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour création automatique du profil
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Vues utiles (optionnel)
-- ============================================

-- Vue avec statistiques par média
CREATE OR REPLACE VIEW media_stats AS
SELECT 
  m.id,
  m.title,
  m.year,
  m.quality,
  COUNT(d.id) AS download_count,
  MAX(d.downloaded_at) AS last_download
FROM media m
LEFT JOIN downloads d ON m.id = d.media_id
GROUP BY m.id, m.title, m.year, m.quality;

-- ============================================
-- Données de test (optionnel - à supprimer en prod)
-- ============================================

-- ============================================
-- Table: manual_matches (Cache d'apprentissage)
-- Sauvegarde les correspondances manuelles validées
-- ============================================
CREATE TABLE IF NOT EXISTS manual_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT UNIQUE NOT NULL,
  tmdb_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  year INTEGER,
  poster_path TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_manual_matches_filename ON manual_matches(filename);
CREATE INDEX IF NOT EXISTS idx_manual_matches_tmdb_id ON manual_matches(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_manual_matches_user_id ON manual_matches(user_id);

-- Trigger pour update_at
CREATE TRIGGER manual_matches_updated_at
  BEFORE UPDATE ON manual_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS pour manual_matches (désactivé pour application personnelle)
ALTER TABLE manual_matches DISABLE ROW LEVEL SECURITY;

-- Exemple d'insertion pour développement
-- INSERT INTO media (
--   pcloud_fileid,
--   title,
--   year,
--   quality,
--   file_size
-- ) VALUES (
--   'test_file_id',
--   'Film de Test',
--   2024,
--   '1080p',
--   5368709120
-- );

