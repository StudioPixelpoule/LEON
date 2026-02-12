/**
 * Tests E2E : Modal de detail d'un film
 * Les cartes film sont des div[role="button"][aria-label="Lire <titre>"]
 * Le modal s'ouvre au clic, contient un h1 et un bouton "Lire"
 */

import { test, expect } from '@playwright/test'

test.describe('Modal Film', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/films')
    await page.waitForLoadState('networkidle')
  })

  test('clic sur un film ouvre le modal', async ({ page }) => {
    // Les cartes film ont role="button" et aria-label="Lire <titre>"
    const firstCard = page.locator('[role="button"][aria-label^="Lire"]').first()
    await expect(firstCard).toBeVisible({ timeout: 15_000 })
    await firstCard.click()

    // Le modal contient un heading avec le titre du film
    const modalTitle = page.locator('[class*="modal" i] h1, [class*="Modal" i] h1').first()
    await expect(modalTitle).toBeVisible({ timeout: 10_000 })
  })

  test('le modal affiche les informations du film', async ({ page }) => {
    const firstCard = page.locator('[role="button"][aria-label^="Lire"]').first()
    await expect(firstCard).toBeVisible({ timeout: 15_000 })
    await firstCard.click()

    // Titre h1 visible
    const modalTitle = page.locator('[class*="modal" i] h1').first()
    await expect(modalTitle).toBeVisible({ timeout: 10_000 })

    // Le titre doit avoir du contenu
    const titleText = await modalTitle.textContent()
    expect(titleText?.length).toBeGreaterThan(0)
  })

  test('le bouton Lire est present', async ({ page }) => {
    const firstCard = page.locator('[role="button"][aria-label^="Lire"]').first()
    await expect(firstCard).toBeVisible({ timeout: 15_000 })
    await firstCard.click()

    // Attendre que le modal s'ouvre
    await page.locator('[class*="modal" i] h1').first().waitFor({ state: 'visible', timeout: 10_000 })

    // Le bouton "Lire" dans le modal (pas le meme que la carte)
    const playButton = page.locator('[class*="modal" i] button, [class*="Modal" i] button').filter({ hasText: /^Lire$/ }).first()
    await expect(playButton).toBeVisible({ timeout: 5_000 })
  })

  test('fermeture du modal au clic sur le bouton X', async ({ page }) => {
    const firstCard = page.locator('[role="button"][aria-label^="Lire"]').first()
    await expect(firstCard).toBeVisible({ timeout: 15_000 })
    await firstCard.click()

    const modalTitle = page.locator('[class*="modal" i] h1').first()
    await expect(modalTitle).toBeVisible({ timeout: 10_000 })

    // Fermer via le bouton close (× pour MovieModal, ✕ pour SeriesModal)
    const closeButton = page.locator('[class*="close" i]').first()
    const altCloseButton = page.locator('[class*="modal" i] button, [class*="Modal" i] button').filter({ hasText: /[×✕✖]/ }).first()

    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click()
    } else if (await altCloseButton.isVisible().catch(() => false)) {
      await altCloseButton.click()
    } else {
      // Cliquer sur le backdrop/overlay pour fermer
      await page.locator('[class*="backdrop" i], [class*="overlay" i]').first().click({ position: { x: 10, y: 10 } })
    }

    // Le modal doit se fermer
    await expect(modalTitle).not.toBeVisible({ timeout: 5_000 })
  })

  test('le modal affiche un poster/backdrop', async ({ page }) => {
    const firstCard = page.locator('[role="button"][aria-label^="Lire"]').first()
    await expect(firstCard).toBeVisible({ timeout: 15_000 })
    await firstCard.click()

    await page.locator('[class*="modal" i] h1').first().waitFor({ state: 'visible', timeout: 10_000 })

    // Une image doit etre presente dans le modal (poster ou backdrop)
    const image = page.locator('[class*="modal" i] img, [class*="Modal" i] img').first()
    await expect(image).toBeVisible({ timeout: 5_000 })
  })
})
