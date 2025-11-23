-- Migration: Sauvegarde des positions de lecture
-- Permet de reprendre un film là où on l'a arrêté

CREATE TABLE IF NOT EXISTS playback_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id TEXT NOT NULL, -- Utiliser TEXT comme la table media
  position FLOAT NOT NULL DEFAULT 0, -- Position en secondes
  duration FLOAT, -- Durée totale (optionnel, pour calculer %)
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Un seul enregistrement par film (upsert automatique)
  UNIQUE(media_id),
  
  -- Foreign key vers media (id est probablement TEXT)
  CONSTRAINT fk_media FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_playback_positions_media_id ON playback_positions(media_id);
CREATE INDEX IF NOT EXISTS idx_playback_positions_updated_at ON playback_positions(updated_at DESC);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_playback_position_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur les updates
DROP TRIGGER IF EXISTS update_playback_positions_timestamp ON playback_positions;
CREATE TRIGGER update_playback_positions_timestamp
  BEFORE UPDATE ON playback_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_playback_position_timestamp();

-- RLS (Row Level Security) - Activer pour futur multi-utilisateurs
ALTER TABLE playback_positions ENABLE ROW LEVEL SECURITY;

-- Policy: Tout le monde peut tout faire (pour l'instant, pas d'auth)
CREATE POLICY "Allow all operations for now" ON playback_positions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Vue pour récupérer les films en cours de visionnage avec infos complètes
CREATE OR REPLACE VIEW media_in_progress AS
SELECT 
  m.*,
  pp.position as current_time,
  pp.duration as saved_duration,
  pp.updated_at as last_watched,
  CASE 
    WHEN pp.duration > 0 THEN (pp.position / pp.duration * 100)::INTEGER
    ELSE 0
  END as progress_percent
FROM media m
INNER JOIN playback_positions pp ON m.id::TEXT = pp.media_id
WHERE pp.position > 30 -- Au moins 30s de visionnage
  AND (pp.duration IS NULL OR pp.position < pp.duration * 0.95) -- Pas fini (< 95%)
ORDER BY pp.updated_at DESC;

-- Commentaires
COMMENT ON TABLE playback_positions IS 'Positions de lecture pour reprendre un film';
COMMENT ON COLUMN playback_positions.position IS 'Position actuelle en secondes';
COMMENT ON COLUMN playback_positions.duration IS 'Durée totale du fichier en secondes';
COMMENT ON VIEW media_in_progress IS 'Vue des films en cours de visionnage (> 30s et < 95%)';
