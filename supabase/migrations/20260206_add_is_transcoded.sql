-- Migration: Ajouter is_transcoded pour masquer les médias non transcodés
-- Les médias n'apparaissent dans l'interface qu'une fois transcodés

-- Ajouter la colonne aux films
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS is_transcoded BOOLEAN DEFAULT true;

-- Ajouter la colonne aux épisodes
ALTER TABLE episodes 
ADD COLUMN IF NOT EXISTS is_transcoded BOOLEAN DEFAULT true;

-- Les médias existants sont considérés comme transcodés (default true)
-- Les nouveaux médias seront ajoutés avec is_transcoded = false
-- puis passés à true par le service de transcodage

-- Index pour filtrer rapidement les médias transcodés
CREATE INDEX IF NOT EXISTS idx_media_is_transcoded ON media(is_transcoded) WHERE is_transcoded = true;
CREATE INDEX IF NOT EXISTS idx_episodes_is_transcoded ON episodes(is_transcoded) WHERE is_transcoded = true;

COMMENT ON COLUMN media.is_transcoded IS 'Indique si le média a été transcodé et peut être affiché';
COMMENT ON COLUMN episodes.is_transcoded IS 'Indique si l''épisode a été transcodé et peut être affiché';
