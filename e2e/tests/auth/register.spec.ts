/**
 * Tests E2E : Inscription utilisateur
 */

import { test, expect } from '@playwright/test'

test.describe('Page d\'inscription', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register')
  })

  test('affiche le formulaire d\'inscription', async ({ page }) => {
    await expect(page.getByText('LEON')).toBeVisible()
    await expect(page.getByText('Créer un compte')).toBeVisible()
    await expect(page.getByLabel('Nom affiché')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Confirmer le mot de passe')).toBeVisible()
    await expect(page.getByRole('button', { name: /créer mon compte/i })).toBeVisible()
  })

  test('affiche le lien vers connexion', async ({ page }) => {
    await expect(page.getByText('Déjà un compte ?')).toBeVisible()
    await expect(page.getByRole('link', { name: /se connecter/i })).toBeVisible()
  })

  test('mot de passe trop court affiche une erreur', async ({ page }) => {
    await page.getByLabel('Email').fill('test-register@test.com')
    await page.getByLabel('Mot de passe', { exact: true }).fill('12345')
    await page.getByLabel('Confirmer le mot de passe').fill('12345')
    await page.getByRole('button', { name: /créer mon compte/i }).click()

    await expect(page.getByText(/au moins 6 caractères/i)).toBeVisible()
  })

  test('mots de passe non identiques affiche une erreur', async ({ page }) => {
    await page.getByLabel('Email').fill('test-register@test.com')
    await page.getByLabel('Mot de passe', { exact: true }).fill('motdepasse123')
    await page.getByLabel('Confirmer le mot de passe').fill('autremotdepasse')
    await page.getByRole('button', { name: /créer mon compte/i }).click()

    await expect(page.getByText(/ne correspondent pas/i)).toBeVisible()
  })

  test('lien vers connexion fonctionne', async ({ page }) => {
    await page.getByRole('link', { name: /se connecter/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })
})
