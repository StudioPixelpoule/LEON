-- Migration: Activer RLS sur series_credits_settings
-- Date: 2025-01-21
-- Description: Active Row Level Security pour la table series_credits_settings

-- Activer RLS
ALTER TABLE series_credits_settings ENABLE ROW LEVEL SECURITY;

-- Politique de lecture : tous les utilisateurs authentifiés peuvent lire
CREATE POLICY "Authenticated users can read series_credits_settings"
  ON series_credits_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Politique d'insertion : tous les utilisateurs authentifiés peuvent insérer
CREATE POLICY "Authenticated users can insert series_credits_settings"
  ON series_credits_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politique de mise à jour : tous les utilisateurs authentifiés peuvent modifier
CREATE POLICY "Authenticated users can update series_credits_settings"
  ON series_credits_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politique de suppression : tous les utilisateurs authentifiés peuvent supprimer
CREATE POLICY "Authenticated users can delete series_credits_settings"
  ON series_credits_settings
  FOR DELETE
  TO authenticated
  USING (true);
