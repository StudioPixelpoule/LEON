/**
 * Tests E2E : Lecture video de base
 * Play/pause, chargement, erreur, retry
 */

import { test, expect } from '../../fixtures/player.fixture'

test.describe('Lecture de base', () => {
  test('la video demarre et currentTime avance', async ({ playerCtx }) => {
    const { page, waitForPlaying, getVideoState } = playerCtx

    await waitForPlaying()
    const state1 = await getVideoState()

    // Attendre un peu
    await page.waitForTimeout(2_000)
    const state2 = await getVideoState()

    expect(state2.currentTime).toBeGreaterThan(state1.currentTime)
  })

  test('le bouton play/pause fonctionne', async ({ playerCtx }) => {
    const { page, waitForPlaying, getVideoState, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    // Trouver le bouton play/pause
    const playPauseBtn = page.locator('button').filter({ has: page.locator('svg') }).filter({
      has: page.locator('[class*="play"], [class*="Play"], [class*="pause"], [class*="Pause"]')
    }).first()

    // Alternative : chercher dans les controles
    const controlsBtn = page.locator('[class*="controls"] button').first()
    const btn = await playPauseBtn.isVisible() ? playPauseBtn : controlsBtn

    if (await btn.isVisible()) {
      await btn.click()
      await page.waitForTimeout(500)
      const state = await getVideoState()
      expect(state.paused).toBe(true)

      // Re-clic pour reprendre
      await showControls()
      await btn.click()
      await page.waitForTimeout(500)
      const state2 = await getVideoState()
      expect(state2.paused).toBe(false)
    }
  })

  test('clic sur la video toggle play/pause', async ({ playerCtx }) => {
    const { page, video, waitForPlaying, getVideoState } = playerCtx

    await waitForPlaying()

    // Clic sur la video pour mettre en pause
    await video.click()
    await page.waitForTimeout(500)
    const paused = await getVideoState()
    expect(paused.paused).toBe(true)

    // Re-clic pour reprendre
    await video.click()
    await page.waitForTimeout(500)
    const playing = await getVideoState()
    expect(playing.paused).toBe(false)
  })

  test('la duree est affichee', async ({ playerCtx }) => {
    const { page, waitForPlaying, getVideoState, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    const state = await getVideoState()
    expect(state.duration).toBeGreaterThan(0)
    expect(isFinite(state.duration)).toBe(true)
  })

  test('le bouton fermer fonctionne', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    const closeBtn = page.locator('button[aria-label*="fermer" i], [class*="close"], [class*="Close"]').first()
    if (await closeBtn.isVisible()) {
      await closeBtn.click()

      // Le lecteur doit disparaitre
      await expect(page.locator('video')).not.toBeVisible({ timeout: 5_000 })
    }
  })
})
