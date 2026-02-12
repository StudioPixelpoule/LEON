/**
 * Tests E2E : Plein ecran
 * Bouton, touche F, double-clic, Escape
 */

import { test, expect } from '../../fixtures/player.fixture'

test.describe('Plein ecran', () => {
  test('bouton fullscreen active le plein ecran', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    const fsBtn = page.locator(
      'button[aria-label*="plein" i], button[aria-label*="fullscreen" i], button[aria-label*="écran" i]'
    ).first()

    if (await fsBtn.isVisible()) {
      await fsBtn.click()
      await page.waitForTimeout(500)

      const isFullscreen = await page.evaluate(() => !!document.fullscreenElement)
      expect(isFullscreen).toBe(true)

      // Sortir du plein ecran
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }
  })

  test('touche F toggle le plein ecran', async ({ playerCtx }) => {
    const { page, waitForPlaying } = playerCtx

    await waitForPlaying()

    await page.keyboard.press('f')
    await page.waitForTimeout(500)

    const isFullscreen = await page.evaluate(() => !!document.fullscreenElement)
    expect(isFullscreen).toBe(true)

    await page.keyboard.press('f')
    await page.waitForTimeout(500)

    const isNotFullscreen = await page.evaluate(() => !document.fullscreenElement)
    expect(isNotFullscreen).toBe(true)
  })

  test('double-clic sur la video toggle le plein ecran', async ({ playerCtx }) => {
    const { page, video, waitForPlaying } = playerCtx

    await waitForPlaying()

    await video.dblclick()
    await page.waitForTimeout(500)

    const isFullscreen = await page.evaluate(() => !!document.fullscreenElement)
    expect(isFullscreen).toBe(true)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  })

  test('Escape sort du plein ecran', async ({ playerCtx }) => {
    const { page, waitForPlaying } = playerCtx

    await waitForPlaying()

    // Entrer en plein ecran
    await page.keyboard.press('f')
    await page.waitForTimeout(500)

    const isFullscreen = await page.evaluate(() => !!document.fullscreenElement)
    expect(isFullscreen).toBe(true)

    // Escape pour sortir
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    const isNotFullscreen = await page.evaluate(() => !document.fullscreenElement)
    expect(isNotFullscreen).toBe(true)
  })
})
