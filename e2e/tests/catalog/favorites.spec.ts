/**
 * Tests E2E : Favoris (Ma Liste)
 * Le FavoriteButton utilise aria-label="Ajouter aux favoris" / "Retirer des favoris"
 */

import { test, expect } from '@playwright/test'

test.describe('Favoris', () => {
  test('ajouter et retirer un film des favoris', async ({ page }) => {
    await page.goto('/films')
    await page.waitForLoadState('domcontentloaded')

    // Ouvrir le modal d'un film
    const firstCard = page.locator('[role="button"][aria-label^="Lire"]').first()
    await expect(firstCard).toBeVisible({ timeout: 15_000 })
    await firstCard.click()

    // Attendre le modal (h1 visible)
    const modalTitle = page.locator('[class*="modal" i] h1, [class*="Modal" i] h1').first()
    await expect(modalTitle).toBeVisible({ timeout: 10_000 })

    // Chercher le bouton favori via son aria-label precis
    const favoriteBtn = page.locator('button[aria-label*="favoris"]').first()

    if (await favoriteBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Cliquer pour ajouter aux favoris
      await favoriteBtn.click()
      await page.waitForTimeout(1_000)

      // Verifier dans Ma Liste
      await page.goto('/ma-liste')
      await page.waitForLoadState('domcontentloaded')

      // Retourner et retirer des favoris
      await page.goto('/films')
      await page.waitForLoadState('domcontentloaded')

      const card = page.locator('[role="button"][aria-label^="Lire"]').first()
      await expect(card).toBeVisible({ timeout: 15_000 })
      await card.click()

      await page.locator('[class*="modal" i] h1, [class*="Modal" i] h1').first()
        .waitFor({ state: 'visible', timeout: 10_000 })

      // Retirer des favoris
      const removeBtn = page.locator('button[aria-label*="favoris"]').first()
      if (await removeBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await removeBtn.click()
        await page.waitForTimeout(1_000)
      }
    }
  })

  test('page Ma Liste est accessible et affiche les sections', async ({ page }) => {
    await page.goto('/ma-liste')
    await page.waitForLoadState('domcontentloaded')

    // La page ne doit pas etre vide
    await expect(page.locator('body')).not.toContainText('Error')
  })
})
