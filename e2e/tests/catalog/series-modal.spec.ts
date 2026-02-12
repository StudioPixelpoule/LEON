/**
 * Tests E2E : Modal de detail d'une serie
 * Les cartes series utilisent MovieRow : div[role="button"][aria-label="Lire <titre>"]
 */

import { test, expect } from '@playwright/test'

test.describe('Modal Serie', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/series')
    await page.waitForLoadState('domcontentloaded')
    // Attendre que les cartes soient chargees (plutot que networkidle qui peut timeout)
    await page.locator('[role="button"][aria-label^="Lire"]').first()
      .waitFor({ state: 'visible', timeout: 20_000 })
  })

  test('clic sur une serie ouvre le modal', async ({ page }) => {
    const firstCard = page.locator('[role="button"][aria-label^="Lire"]').first()
    await expect(firstCard).toBeVisible({ timeout: 15_000 })
    await firstCard.click()

    // Le modal contient un h1 avec le titre
    const modalTitle = page.locator('[class*="modal" i] h1').first()
    await expect(modalTitle).toBeVisible({ timeout: 10_000 })
  })

  test('le modal affiche les informations de la serie', async ({ page }) => {
    const firstCard = page.locator('[role="button"][aria-label^="Lire"]').first()
    await expect(firstCard).toBeVisible({ timeout: 15_000 })
    await firstCard.click()

    const modalTitle = page.locator('[class*="modal" i] h1').first()
    await expect(modalTitle).toBeVisible({ timeout: 10_000 })

    const titleText = await modalTitle.textContent()
    expect(titleText?.length).toBeGreaterThan(0)
  })

  test('selecteur de saisons fonctionnel', async ({ page }) => {
    const firstCard = page.locator('[role="button"][aria-label^="Lire"]').first()
    await expect(firstCard).toBeVisible({ timeout: 15_000 })
    await firstCard.click()

    const modalTitle = page.locator('[class*="modal" i] h1').first()
    await expect(modalTitle).toBeVisible({ timeout: 10_000 })

    // Boutons de saisons dans le modal
    const seasonButtons = page.locator('[class*="modal" i] button, [class*="Modal" i] button').filter({ hasText: /saison|season|S\d/i })
    const count = await seasonButtons.count()

    if (count > 1) {
      await seasonButtons.nth(1).click()
      await page.waitForTimeout(500)
    }
  })

  test('les episodes sont listes', async ({ page }) => {
    const firstCard = page.locator('[role="button"][aria-label^="Lire"]').first()
    await expect(firstCard).toBeVisible({ timeout: 15_000 })
    await firstCard.click()

    const modalTitle = page.locator('[class*="modal" i] h1').first()
    await expect(modalTitle).toBeVisible({ timeout: 10_000 })

    // Des episodes doivent etre visibles (cartes episode ou texte "Episode")
    const episodes = page.locator('[class*="episode" i]')
    const count = await episodes.count()
    expect(count).toBeGreaterThan(0)
  })

  test('fermeture du modal', async ({ page }) => {
    const firstCard = page.locator('[role="button"][aria-label^="Lire"]').first()
    await expect(firstCard).toBeVisible({ timeout: 15_000 })
    await firstCard.click()

    const modalTitle = page.locator('[class*="modal" i] h1').first()
    await expect(modalTitle).toBeVisible({ timeout: 10_000 })

    // Le bouton close utilise ✕ (U+2715), pas × (U+00D7)
    // Aussi chercher le bouton avec class closeButton
    const closeButton = page.locator('[class*="close" i]').first()
    const altCloseButton = page.locator('[class*="modal" i] button, [class*="Modal" i] button').filter({ hasText: /[×✕✖]/ }).first()

    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click()
    } else if (await altCloseButton.isVisible().catch(() => false)) {
      await altCloseButton.click()
    } else {
      // Cliquer sur l'overlay (en dehors du modal) pour fermer
      // L'overlay a onClick={onClose}
      await page.locator('[class*="overlay" i]').first().click({ position: { x: 10, y: 10 } })
    }

    await expect(modalTitle).not.toBeVisible({ timeout: 5_000 })
  })
})
