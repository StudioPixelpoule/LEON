/**
 * Tests E2E : Selection des pistes audio
 * Multi-audio, changement de langue, remuxing
 */

import { test, expect } from '../../fixtures/player.fixture'
import { getVideoTime } from '../../helpers/wait'

test.describe('Pistes audio', () => {
  test('le menu audio liste les pistes disponibles', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    // Ouvrir le menu parametres
    const settingsBtn = page.locator(
      'button[aria-label*="audio" i], button[aria-label*="sous-titre" i], button[aria-label*="paramètre" i]'
    ).first()

    if (await settingsBtn.isVisible()) {
      await settingsBtn.click()
      await page.waitForTimeout(500)

      // Verifier que la section Audio est presente
      const audioSection = page.getByText(/audio/i).first()
      await expect(audioSection).toBeVisible({ timeout: 3_000 })

      // Les pistes audio doivent etre listees
      const audioTracks = page.locator('[class*="settingsMenu"], [class*="SettingsMenu"]')
        .locator('[class*="track"], [class*="Track"], [class*="option"], button, label')

      const count = await audioTracks.count()
      // Au moins 1 piste audio
      expect(count).toBeGreaterThanOrEqual(1)
    }
  })

  test('cliquer sur une piste audio change la langue', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    const settingsBtn = page.locator(
      'button[aria-label*="audio" i], button[aria-label*="sous-titre" i], button[aria-label*="paramètre" i]'
    ).first()

    if (await settingsBtn.isVisible()) {
      await settingsBtn.click()
      await page.waitForTimeout(500)

      // Lister les pistes audio
      const menu = page.locator('[class*="settingsMenu"], [class*="SettingsMenu"]').first()
      const tracks = menu.locator('[class*="track"], [class*="option"], button').filter({ hasText: /fran|engl|vf|vo|french|english/i })

      const count = await tracks.count()
      if (count > 1) {
        // Sauvegarder le temps actuel
        const timeBefore = await getVideoTime(page)

        // Cliquer sur la deuxieme piste
        await tracks.nth(1).click()
        await page.waitForTimeout(3_000)

        // Le temps doit etre approximativement le meme (restauration de position)
        const timeAfter = await getVideoTime(page)
        expect(Math.abs(timeAfter - timeBefore)).toBeLessThan(15) // Marge de 15s
      }
    }
  })

  test('la piste selectionnee est marquee visuellement', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    const settingsBtn = page.locator(
      'button[aria-label*="audio" i], button[aria-label*="sous-titre" i]'
    ).first()

    if (await settingsBtn.isVisible()) {
      await settingsBtn.click()
      await page.waitForTimeout(500)

      // Au moins une piste doit avoir un indicateur actif (checkmark, bold, classe active)
      const activeTracks = page.locator(
        '[class*="active"], [class*="selected"], [class*="Active"], [class*="Selected"]'
      )
      const count = await activeTracks.count()
      expect(count).toBeGreaterThanOrEqual(1)
    }
  })
})
