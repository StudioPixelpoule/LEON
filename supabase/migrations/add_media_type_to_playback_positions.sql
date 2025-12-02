-- Migration: Ajouter ou modifier la colonne media_type dans playback_positions
-- Pour supporter les films ET les séries

-- Ajouter la colonne media_type si elle n'existe pas (avec valeur par défaut)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'playback_positions' 
    AND column_name = 'media_type'
  ) THEN
    ALTER TABLE playback_positions 
    ADD COLUMN media_type TEXT NOT NULL DEFAULT 'movie';
  END IF;
END $$;

-- Si la colonne existe déjà mais n'a pas de valeur par défaut, ajouter une valeur par défaut
ALTER TABLE playback_positions 
ALTER COLUMN media_type SET DEFAULT 'movie';

-- Mettre à jour les lignes existantes qui auraient NULL
UPDATE playback_positions 
SET media_type = 'movie' 
WHERE media_type IS NULL;

-- S'assurer que la contrainte NOT NULL est en place
ALTER TABLE playback_positions 
ALTER COLUMN media_type SET NOT NULL;

-- Commentaire
COMMENT ON COLUMN playback_positions.media_type IS 'Type de média: "movie" pour les films, "episode" pour les épisodes de séries';







