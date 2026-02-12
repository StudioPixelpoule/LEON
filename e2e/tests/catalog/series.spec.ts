/**
 * Tests E2E : Page catalogue des series
 */

import { test, expect } from '@playwright/test'

test.describe('Catalogue Series', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/series')
    await page.waitForLoadState('networkidle')
  })

  test('affiche du contenu series', async ({ page }) => {
    const content = page.locator('[class*="poster"], [class*="card"], [class*="Card"], [class*="grid"], [class*="Grid"]')
    await expect(content.first()).toBeVisible({ timeout: 15_000 })
  })

  test('les posters series sont charges', async ({ page }) => {
    const images = page.locator('img[src*="tmdb"], img[src*="image"], img[src*="poster"]')
    const firstImage = images.first()
    await expect(firstImage).toBeVisible({ timeout: 15_000 })
  })

  test('clic sur une serie ouvre un modal ou une page de detail', async ({ page }) => {
    const firstCard = page.locator('[role="button"][aria-label^="Lire"]').first()
    await expect(firstCard).toBeVisible({ timeout: 15_000 })
    await firstCard.click()

    // Le modal contient un h1 avec le titre
    const modalTitle = page.locator('[class*="modal" i] h1').first()
    await expect(modalTitle).toBeVisible({ timeout: 10_000 })
  })
})
