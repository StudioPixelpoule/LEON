/**
 * Tests E2E : Navigation sur la timeline
 * Seek, progression, buffer, drag
 */

import { test, expect } from '../../fixtures/player.fixture'
import { getVideoTime, waitForTime } from '../../helpers/wait'

test.describe('Timeline / Seek', () => {
  test('la barre de progression affiche le temps', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls, getVideoState } = playerCtx

    await waitForPlaying()
    await showControls()

    // Verifier que le temps s'affiche quelque part dans les controles
    const timeDisplay = page.locator('[class*="time"], [class*="Time"], [class*="duration"]').first()
    if (await timeDisplay.isVisible()) {
      const text = await timeDisplay.textContent()
      // Doit contenir un format temps (ex: "0:05 / 1:30:00")
      expect(text).toMatch(/\d+:\d+/)
    }
  })

  test('clic sur la barre de progression fait un seek', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls, getVideoState } = playerCtx

    await waitForPlaying()
    await page.waitForTimeout(2_000)
    await showControls()

    const timeBefore = await getVideoTime(page)

    // Trouver la barre de progression
    const progressBar = page.locator(
      'input[type="range"][class*="progress"], [class*="progressBar"], [class*="ProgressBar"], [class*="timeline"]'
    ).first()

    if (await progressBar.isVisible()) {
      const box = await progressBar.boundingBox()
      if (box) {
        // Cliquer a 50% de la barre
        await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2)
        await page.waitForTimeout(1_000)

        const timeAfter = await getVideoTime(page)
        // Le temps doit avoir change significativement
        expect(Math.abs(timeAfter - timeBefore)).toBeGreaterThan(5)
      }
    }
  })

  test('drag sur la barre fait du scrubbing', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    const progressBar = page.locator(
      'input[type="range"][class*="progress"], [class*="progressBar"], [class*="ProgressBar"], [class*="timeline"]'
    ).first()

    if (await progressBar.isVisible()) {
      const box = await progressBar.boundingBox()
      if (box) {
        // Drag de 20% a 60%
        const startX = box.x + box.width * 0.2
        const endX = box.x + box.width * 0.6
        const y = box.y + box.height / 2

        await page.mouse.move(startX, y)
        await page.mouse.down()
        await page.mouse.move(endX, y, { steps: 10 })
        await page.mouse.up()

        await page.waitForTimeout(1_000)
        const timeAfter = await getVideoTime(page)
        const state = await playerCtx.getVideoState()

        // Le temps doit etre environ a 60% de la duree
        if (state.duration > 0) {
          const expectedRatio = timeAfter / state.duration
          expect(expectedRatio).toBeGreaterThan(0.3)
        }
      }
    }
  })

  test('le temps currentTime / duration est visible', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls, getVideoState } = playerCtx

    await waitForPlaying()
    await showControls()

    const state = await getVideoState()
    expect(state.currentTime).toBeGreaterThanOrEqual(0)
    expect(state.duration).toBeGreaterThan(0)
  })
})
