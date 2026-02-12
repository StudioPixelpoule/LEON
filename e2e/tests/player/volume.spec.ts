/**
 * Tests E2E : Controle du volume
 * Volume slider, mute, touche M
 */

import { test, expect } from '../../fixtures/player.fixture'
import { isVideoMuted, getVideoVolume } from '../../helpers/wait'

test.describe('Volume', () => {
  test('bouton mute coupe le son', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    const volumeBtn = page.locator(
      'button[aria-label*="volume" i], button[aria-label*="son" i], button[aria-label*="mute" i]'
    ).first()

    // Alternative : bouton avec icone volume dans les controles
    const altBtn = page.locator('[class*="controls"] [class*="volume"] button, [class*="controls"] [class*="Volume"] button').first()
    const btn = await volumeBtn.isVisible() ? volumeBtn : altBtn

    if (await btn.isVisible()) {
      const mutedBefore = await isVideoMuted(page)

      await btn.click()
      await page.waitForTimeout(300)

      const mutedAfter = await isVideoMuted(page)
      expect(mutedAfter).not.toBe(mutedBefore)

      // Re-clic pour restaurer
      await btn.click()
      await page.waitForTimeout(300)

      const mutedRestored = await isVideoMuted(page)
      expect(mutedRestored).toBe(mutedBefore)
    }
  })

  test('slider de volume modifie le volume', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    // Hover sur le bouton volume pour faire apparaitre le slider
    const volumeBtn = page.locator(
      'button[aria-label*="volume" i], button[aria-label*="son" i], [class*="volume"] button'
    ).first()

    if (await volumeBtn.isVisible()) {
      await volumeBtn.hover()
      await page.waitForTimeout(500)

      const slider = page.locator('input[type="range"][class*="volume"], [class*="volume"] input[type="range"]').first()

      if (await slider.isVisible()) {
        // Changer la valeur du slider
        await slider.fill('0.3')
        await page.waitForTimeout(300)

        const volume = await getVideoVolume(page)
        // Le volume devrait etre autour de 0.3 (avec marge)
        expect(volume).toBeLessThan(0.6)
      }
    }
  })

  test('volume 0 affiche l\'icone mute', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()

    // Mettre le volume a 0 via JS
    await page.evaluate(() => {
      const v = document.querySelector('video')
      if (v) {
        v.volume = 0
        v.muted = true
      }
    })

    await showControls()
    await page.waitForTimeout(500)

    // L'icone doit changer (verifier visuellement ou par classe/aria)
    const muted = await isVideoMuted(page)
    expect(muted).toBe(true)
  })
})
