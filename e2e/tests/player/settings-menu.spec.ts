/**
 * Tests E2E : Menu des parametres (audio et sous-titres)
 */

import { test, expect } from '../../fixtures/player.fixture'

test.describe('Menu Parametres', () => {
  test('le bouton parametres ouvre le menu', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    const settingsBtn = page.locator(
      'button[aria-label*="audio" i], button[aria-label*="sous-titre" i], button[aria-label*="paramètre" i]'
    ).first()

    if (await settingsBtn.isVisible()) {
      await settingsBtn.click()
      await page.waitForTimeout(500)

      const menu = page.locator('[class*="settingsMenu"], [class*="SettingsMenu"]').first()
      await expect(menu).toBeVisible()
    }
  })

  test('clic a l\'exterieur ferme le menu', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls, video } = playerCtx

    await waitForPlaying()
    await showControls()

    const settingsBtn = page.locator(
      'button[aria-label*="audio" i], button[aria-label*="sous-titre" i]'
    ).first()

    if (await settingsBtn.isVisible()) {
      await settingsBtn.click()
      await page.waitForTimeout(500)

      const menu = page.locator('[class*="settingsMenu"], [class*="SettingsMenu"]').first()
      await expect(menu).toBeVisible()

      // Clic en dehors du menu
      await video.click({ position: { x: 10, y: 10 } })
      await page.waitForTimeout(500)

      await expect(menu).not.toBeVisible({ timeout: 3_000 })
    }
  })

  test('Escape ferme le menu', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    const settingsBtn = page.locator(
      'button[aria-label*="audio" i], button[aria-label*="sous-titre" i]'
    ).first()

    if (await settingsBtn.isVisible()) {
      await settingsBtn.click()
      await page.waitForTimeout(500)

      const menu = page.locator('[class*="settingsMenu"], [class*="SettingsMenu"]').first()
      await expect(menu).toBeVisible()

      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)

      await expect(menu).not.toBeVisible({ timeout: 3_000 })
    }
  })

  test('le menu contient les sections audio et sous-titres', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    const settingsBtn = page.locator(
      'button[aria-label*="audio" i], button[aria-label*="sous-titre" i]'
    ).first()

    if (await settingsBtn.isVisible()) {
      await settingsBtn.click()
      await page.waitForTimeout(500)

      await expect(page.getByText(/audio/i).first()).toBeVisible()
      await expect(page.getByText(/sous-titre/i).first()).toBeVisible()
    }
  })
})
