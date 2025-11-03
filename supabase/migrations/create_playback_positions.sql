-- Table pour sauvegarder les positions de lecture
CREATE TABLE IF NOT EXISTS playback_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'episode')),
  position INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(media_id, media_type)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_playback_positions_media ON playback_positions(media_id, media_type);
CREATE INDEX IF NOT EXISTS idx_playback_positions_updated ON playback_positions(updated_at DESC);

-- RLS (Row Level Security) - Accessible à tous (usage local)
ALTER TABLE playback_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique" ON playback_positions
  FOR SELECT USING (true);

CREATE POLICY "Insertion publique" ON playback_positions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Mise à jour publique" ON playback_positions
  FOR UPDATE USING (true);

CREATE POLICY "Suppression publique" ON playback_positions
  FOR DELETE USING (true);

-- Fonction pour nettoyer les anciennes positions (> 90 jours)
CREATE OR REPLACE FUNCTION cleanup_old_playback_positions()
RETURNS void AS $$
BEGIN
  DELETE FROM playback_positions
  WHERE updated_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

