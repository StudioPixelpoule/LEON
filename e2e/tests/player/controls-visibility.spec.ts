/**
 * Tests E2E : Visibilite des controles du lecteur
 * Auto-hide apres 3s, reapparition au mouvement souris
 */

import { test, expect } from '../../fixtures/player.fixture'

test.describe('Visibilite des controles', () => {
  test('les controles sont visibles au demarrage', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    const controls = page.locator('[class*="controls"]').first()
    await expect(controls).toBeVisible({ timeout: 5_000 })
  })

  test('les controles disparaissent apres 3s sans mouvement', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls, getVideoState } = playerCtx

    await waitForPlaying()
    await showControls()

    const controls = page.locator('[class*="controls"]').first()
    await expect(controls).toBeVisible({ timeout: 5_000 })

    // Ne pas bouger la souris et attendre le masquage
    // Deplacer la souris hors du player pour accelerer le masquage
    await page.mouse.move(0, 0)
    await page.waitForTimeout(4_000)

    // Les controles devraient etre masques (pendant la lecture)
    const state = await getVideoState()
    if (!state.paused) {
      // Verifier via l'opacite ou la visibilite
      const isHidden = await page.evaluate(() => {
        const controls = document.querySelector('[class*="controls"]')
        if (!controls) return true
        const style = window.getComputedStyle(controls)
        return style.opacity === '0' || style.visibility === 'hidden' || style.display === 'none'
      })
      // Tolerant car le timing peut varier
      expect(isHidden).toBe(true)
    }
  })

  test('mouvement de souris fait reapparaitre les controles', async ({ playerCtx }) => {
    const { page, player, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()

    // Masquer les controles
    await page.mouse.move(0, 0)
    await page.waitForTimeout(4_000)

    // Ramener la souris sur le player
    await showControls()
    await page.waitForTimeout(500)

    const controls = page.locator('[class*="controls"]').first()
    await expect(controls).toBeVisible({ timeout: 3_000 })
  })

  test('en pause, les controles restent visibles', async ({ playerCtx }) => {
    const { page, video, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()

    // Mettre en pause
    await video.click()
    await page.waitForTimeout(500)

    await showControls()

    // Attendre plus longtemps que le delai normal de masquage
    await page.waitForTimeout(5_000)

    const controls = page.locator('[class*="controls"]').first()
    await expect(controls).toBeVisible()
  })
})
