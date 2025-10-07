-- ============================================
-- Correction : Changer file_size de BIGINT à TEXT
-- ============================================

-- 1. Modifier le type de la colonne file_size
ALTER TABLE media 
ALTER COLUMN file_size TYPE TEXT USING file_size::TEXT;

-- Voilà ! C'est tout ce qu'il faut faire.




