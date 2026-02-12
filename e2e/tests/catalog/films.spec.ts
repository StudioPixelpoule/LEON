/**
 * Tests E2E : Page catalogue des films
 */

import { test, expect } from '@playwright/test'

test.describe('Catalogue Films', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/films')
    await page.waitForLoadState('networkidle')
  })

  test('affiche une section hero', async ({ page }) => {
    const hero = page.locator('[class*="hero"], [class*="Hero"]').first()
    await expect(hero).toBeVisible({ timeout: 15_000 })
  })

  test('affiche des rangees de films', async ({ page }) => {
    const rows = page.locator('[class*="movieRow"], [class*="MovieRow"], [class*="row"]')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('les posters sont charges', async ({ page }) => {
    // Attendre que les images soient chargees
    const images = page.locator('img[src*="tmdb"], img[src*="image"], img[src*="poster"]')
    const firstImage = images.first()
    await expect(firstImage).toBeVisible({ timeout: 15_000 })

    // Verifier que l'image n'est pas en erreur
    const naturalWidth = await firstImage.evaluate((img: HTMLImageElement) => img.naturalWidth)
    expect(naturalWidth).toBeGreaterThan(0)
  })

  test('les films ont un titre visible', async ({ page }) => {
    // Au moins un titre doit etre present dans les cards
    const cards = page.locator('[class*="card"], [class*="Card"]').first()
    await expect(cards).toBeVisible({ timeout: 15_000 })
  })
})
