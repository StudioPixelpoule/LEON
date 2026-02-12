/**
 * Tests E2E : Raccourcis clavier du lecteur
 * Space, K, fleches, F, M, Escape
 */

import { test, expect } from '../../fixtures/player.fixture'
import { getVideoTime, isVideoMuted } from '../../helpers/wait'

test.describe('Raccourcis clavier', () => {
  test('Space toggle play/pause', async ({ playerCtx }) => {
    const { page, waitForPlaying, getVideoState } = playerCtx

    await waitForPlaying()

    await page.keyboard.press('Space')
    await page.waitForTimeout(500)
    const paused = await getVideoState()
    expect(paused.paused).toBe(true)

    await page.keyboard.press('Space')
    await page.waitForTimeout(500)
    const playing = await getVideoState()
    expect(playing.paused).toBe(false)
  })

  test('K toggle play/pause', async ({ playerCtx }) => {
    const { page, waitForPlaying, getVideoState } = playerCtx

    await waitForPlaying()

    await page.keyboard.press('k')
    await page.waitForTimeout(500)
    const paused = await getVideoState()
    expect(paused.paused).toBe(true)

    await page.keyboard.press('k')
    await page.waitForTimeout(500)
    const playing = await getVideoState()
    expect(playing.paused).toBe(false)
  })

  test('fleche gauche recule de 10s', async ({ playerCtx }) => {
    const { page, waitForPlaying } = playerCtx

    await waitForPlaying()
    // Se positionner a 30s
    await page.evaluate(() => {
      const v = document.querySelector('video')
      if (v) v.currentTime = 30
    })
    await page.waitForTimeout(500)

    const timeBefore = await getVideoTime(page)
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(500)

    const timeAfter = await getVideoTime(page)
    expect(timeAfter).toBeLessThan(timeBefore - 5)
  })

  test('fleche droite avance de 10s', async ({ playerCtx }) => {
    const { page, waitForPlaying } = playerCtx

    await waitForPlaying()

    const timeBefore = await getVideoTime(page)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(500)

    const timeAfter = await getVideoTime(page)
    expect(timeAfter).toBeGreaterThan(timeBefore + 5)
  })

  test('M toggle mute', async ({ playerCtx }) => {
    const { page, waitForPlaying } = playerCtx

    await waitForPlaying()

    const mutedBefore = await isVideoMuted(page)

    await page.keyboard.press('m')
    await page.waitForTimeout(300)

    const mutedAfter = await isVideoMuted(page)
    expect(mutedAfter).not.toBe(mutedBefore)

    // Restaurer
    await page.keyboard.press('m')
    await page.waitForTimeout(300)

    const mutedRestored = await isVideoMuted(page)
    expect(mutedRestored).toBe(mutedBefore)
  })

  test('F toggle fullscreen', async ({ playerCtx }) => {
    const { page, waitForPlaying } = playerCtx

    await waitForPlaying()

    await page.keyboard.press('f')
    await page.waitForTimeout(500)

    const isFs = await page.evaluate(() => !!document.fullscreenElement)
    expect(isFs).toBe(true)

    await page.keyboard.press('f')
    await page.waitForTimeout(500)

    const isNotFs = await page.evaluate(() => !document.fullscreenElement)
    expect(isNotFs).toBe(true)
  })

  test('Escape ferme le menu si ouvert', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    // Ouvrir le menu
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
})
