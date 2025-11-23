-- ============================================
-- Table: media_optimization
-- Gestion de l'optimisation des médias (ré-encodage H.264/AAC)
-- ============================================

CREATE TABLE IF NOT EXISTS media_optimization (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  media_id UUID NOT NULL UNIQUE REFERENCES media(id) ON DELETE CASCADE,
  
  -- Chemins des fichiers
  original_filepath TEXT NOT NULL,
  optimized_filepath TEXT, -- Sera dans films_optimized/
  
  -- Informations techniques du fichier original
  original_codec TEXT,
  original_audio_codec TEXT,
  original_bitrate INTEGER,
  original_size_bytes BIGINT,
  original_resolution TEXT, -- Ex: "1920x1080"
  
  -- Pistes audio et sous-titres
  audio_tracks JSONB, -- Array de pistes audio avec langues
  subtitle_tracks JSONB, -- Array de pistes sous-titres avec langues
  audio_tracks_count INTEGER DEFAULT 0,
  subtitle_tracks_count INTEGER DEFAULT 0,
  
  -- Informations du fichier optimisé
  optimized_codec TEXT DEFAULT 'h264',
  optimized_audio_codec TEXT DEFAULT 'aac',
  optimized_bitrate INTEGER,
  optimized_size_bytes BIGINT,
  optimized_resolution TEXT,
  
  -- Statut de l'optimisation
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  needs_optimization BOOLEAN DEFAULT true, -- false si déjà en H.264/AAC
  
  -- Progression
  progress_percent INTEGER DEFAULT 0,
  current_progress_time TEXT, -- Temps actuel du transcodage (ex: "00:15:32")
  estimated_time_remaining TEXT, -- Temps restant estimé
  speed TEXT, -- Ex: "2.5x" (vitesse d'encodage vs temps réel)
  
  -- Logs et erreurs
  error_message TEXT,
  ffmpeg_log TEXT,
  
  -- Économie d'espace
  space_saved_bytes BIGINT, -- Espace économisé (peut être négatif)
  space_saved_percent INTEGER, -- % d'économie
  
  -- Métadonnées temporelles
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_media_optimization_media_id ON media_optimization(media_id);
CREATE INDEX IF NOT EXISTS idx_media_optimization_status ON media_optimization(status);
CREATE INDEX IF NOT EXISTS idx_media_optimization_needs_optimization ON media_optimization(needs_optimization);
CREATE INDEX IF NOT EXISTS idx_media_optimization_created_at ON media_optimization(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE media_optimization ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Lecture publique" ON media_optimization;
DROP POLICY IF EXISTS "Insertion publique" ON media_optimization;
DROP POLICY IF EXISTS "Mise à jour publique" ON media_optimization;
DROP POLICY IF EXISTS "Suppression publique" ON media_optimization;

-- Créer les nouvelles politiques
CREATE POLICY "Lecture publique" ON media_optimization
  FOR SELECT USING (true);

CREATE POLICY "Insertion publique" ON media_optimization
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Mise à jour publique" ON media_optimization
  FOR UPDATE USING (true);

CREATE POLICY "Suppression publique" ON media_optimization
  FOR DELETE USING (true);

-- Fonction pour nettoyer les logs anciens (> 30 jours)
CREATE OR REPLACE FUNCTION cleanup_old_optimization_logs()
RETURNS void AS $$
BEGIN
  UPDATE media_optimization
  SET ffmpeg_log = NULL
  WHERE completed_at < NOW() - INTERVAL '30 days'
    AND ffmpeg_log IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Commentaires
COMMENT ON TABLE media_optimization IS 'Gestion de l''optimisation des médias pour streaming (ré-encodage H.264/AAC)';
COMMENT ON COLUMN media_optimization.needs_optimization IS 'false si le fichier est déjà en H.264/AAC et ne nécessite pas de ré-encodage';
COMMENT ON COLUMN media_optimization.space_saved_bytes IS 'Espace économisé en bytes (peut être négatif si le fichier optimisé est plus gros)';

