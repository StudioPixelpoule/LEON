-- Migration: Table media_requests
-- Permet aux utilisateurs de demander des films/séries à ajouter à la bibliothèque

CREATE TABLE IF NOT EXISTS media_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tmdb_id INTEGER,
  media_type TEXT CHECK (media_type IN ('movie', 'tv')),
  title TEXT NOT NULL,
  year INTEGER,
  poster_url TEXT,
  comment TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'added', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS : les utilisateurs insèrent et voient leurs propres demandes
-- La gestion admin (SELECT all, UPDATE, DELETE) se fait côté API avec requireAdmin() + createSupabaseAdmin()
ALTER TABLE media_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own requests"
  ON media_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own requests"
  ON media_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_media_requests_user_id ON media_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_media_requests_status ON media_requests(status);
CREATE INDEX IF NOT EXISTS idx_media_requests_created_at ON media_requests(created_at DESC);
