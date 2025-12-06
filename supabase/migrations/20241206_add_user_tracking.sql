-- Migration: Suivi multi-utilisateurs
-- Ajoute le tracking par utilisateur pour les positions de lecture et l'historique

-- ============================================
-- 1. Ajouter user_id à playback_positions
-- ============================================

-- Ajouter la colonne user_id si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'playback_positions' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE playback_positions 
    ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Supprimer l'ancienne contrainte unique (si existe)
ALTER TABLE playback_positions DROP CONSTRAINT IF EXISTS playback_positions_media_id_key;

-- Créer une nouvelle contrainte unique sur (media_id, user_id)
-- Note: COALESCE permet de gérer les NULL pour user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'playback_positions_media_user_unique'
  ) THEN
    -- Créer un index unique partiel au lieu d'une contrainte
    CREATE UNIQUE INDEX IF NOT EXISTS idx_playback_positions_media_user 
    ON playback_positions(media_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
  END IF;
END $$;

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_playback_positions_user_id ON playback_positions(user_id);

-- ============================================
-- 2. Créer la table watch_history
-- ============================================

CREATE TABLE IF NOT EXISTS watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL, -- TEXT pour compatibilité avec playback_positions
  media_type TEXT NOT NULL DEFAULT 'movie',
  watched_at TIMESTAMPTZ DEFAULT NOW(),
  watch_duration INTEGER, -- Durée regardée en secondes
  completed BOOLEAN DEFAULT false, -- A regardé > 90%
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_watch_history_user_id ON watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_media_id ON watch_history(media_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_watched_at ON watch_history(watched_at DESC);

-- ============================================
-- 3. RLS Policies pour watch_history
-- ============================================

-- Activer RLS sur watch_history
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies existantes si elles existent
DROP POLICY IF EXISTS "Users can view own watch history" ON watch_history;
DROP POLICY IF EXISTS "Users can insert own watch history" ON watch_history;
DROP POLICY IF EXISTS "Allow all for service role" ON watch_history;

-- Policy: Les utilisateurs peuvent voir leur propre historique
CREATE POLICY "Users can view own watch history" ON watch_history
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Les utilisateurs peuvent insérer leur propre historique
CREATE POLICY "Users can insert own watch history" ON watch_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Service role peut tout faire
CREATE POLICY "Service role full access" ON watch_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Mettre à jour les policies pour playback_positions
DROP POLICY IF EXISTS "Allow all operations for now" ON playback_positions;
DROP POLICY IF EXISTS "Users can manage own playback positions" ON playback_positions;

CREATE POLICY "Users can manage own playback positions" ON playback_positions
  FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ============================================
-- 4. Fonction pour enregistrer un visionnage terminé
-- ============================================

CREATE OR REPLACE FUNCTION record_watch_completion(
  p_user_id UUID,
  p_media_id TEXT,
  p_media_type TEXT DEFAULT 'movie',
  p_watch_duration INTEGER DEFAULT NULL,
  p_completed BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO watch_history (user_id, media_id, media_type, watch_duration, completed)
  VALUES (p_user_id, p_media_id, p_media_type, p_watch_duration, p_completed)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Commentaires
-- ============================================

COMMENT ON TABLE watch_history IS 'Historique des visionnages par utilisateur';
COMMENT ON COLUMN watch_history.completed IS 'True si l''utilisateur a regardé > 90% du film';
COMMENT ON COLUMN watch_history.watch_duration IS 'Durée regardée en secondes';
COMMENT ON COLUMN playback_positions.user_id IS 'ID utilisateur pour tracking multi-utilisateurs';
