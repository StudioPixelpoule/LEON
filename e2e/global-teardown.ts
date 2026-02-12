/**
 * Teardown global : nettoyage apres les tests
 */

import { test as teardown } from '@playwright/test'

teardown('nettoyage', async () => {
  // Rien a nettoyer pour l'instant
  // Peut servir a supprimer les donnees de test
})
