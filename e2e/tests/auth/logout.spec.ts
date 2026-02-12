/**
 * Tests E2E : Deconnexion utilisateur
 * Login frais pour ne pas invalider les tokens partages par les autres tests.
 * Supabase signOut() avec scope 'global' invalide TOUS les tokens de l'utilisateur.
 */

import { test, expect } from '@playwright/test'

const email = process.env.TEST_USER_EMAIL || ''
const password = process.env.TEST_USER_PASSWORD || ''

test.describe('Deconnexion', () => {
  test.beforeEach(async () => {
    if (!email || !password) {
      test.skip(true, 'Credentials de test non configurees')
    }
  })

  test('login, deconnexion, puis acces protege redirige vers login', async ({ page }) => {
    // 1. Login frais via le formulaire
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Mot de passe').fill(password)
    await page.getByRole('button', { name: /se connecter/i }).click()
    await page.waitForURL('**/films', { timeout: 15_000 })

    // 2. Ouvrir le menu utilisateur et se deconnecter
    await page.getByRole('button', { name: 'Menu utilisateur' }).click()
    await page.getByText('Déconnexion').click()

    // 3. Attendre la redirection vers /login
    //    signOut() appelle Supabase puis router.push('/login')
    //    Parfois la navigation est lente — on accepte jusqu'a 20s
    await page.waitForURL('**/login', { timeout: 20_000 })
    await expect(page).toHaveURL(/\/login/)

    // 4. Verifier qu'apres deconnexion, /films redirige vers /login
    await page.goto('/films')
    await page.waitForLoadState('domcontentloaded')

    // Le middleware redirige les non-authentifies vers /login
    const currentUrl = page.url()
    if (!currentUrl.includes('/login')) {
      await page.waitForURL('**/login**', { timeout: 10_000 }).catch(() => {})
    }

    await expect(page).toHaveURL(/\/login/)
  })
})
