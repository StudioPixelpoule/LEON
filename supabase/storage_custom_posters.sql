-- ============================================
-- Storage: Bucket pour jaquettes personnalisées
-- ============================================

-- Créer le bucket (si pas déjà existant)
INSERT INTO storage.buckets (id, name, public)
VALUES ('custom-posters', 'custom-posters', true)
ON CONFLICT (id) DO NOTHING;

-- Politique d'upload (tout le monde peut uploader - app locale)
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'custom-posters');

-- Politique de lecture publique
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'custom-posters');

-- Politique de mise à jour
CREATE POLICY "Allow public updates"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'custom-posters');

-- Politique de suppression
CREATE POLICY "Allow public deletes"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'custom-posters');

-- Configuration du bucket (limite 10MB par fichier, images uniquement)
UPDATE storage.buckets
SET 
  file_size_limit = 10485760, -- 10MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE id = 'custom-posters';


