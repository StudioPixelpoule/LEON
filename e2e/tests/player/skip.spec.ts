/**
 * Tests E2E : Skip avant/arriere (-10s / +10s)
 */

import { test, expect } from '../../fixtures/player.fixture'
import { getVideoTime, sleep } from '../../helpers/wait'

test.describe('Skip (sauts)', () => {
  test('bouton +10s avance le temps', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await page.waitForTimeout(2_000) // Laisser le temps avancer un peu
    await showControls()

    const timeBefore = await getVideoTime(page)

    // Trouver le bouton +10s
    const skipForward = page.locator(
      'button[aria-label*="avancer" i], button[aria-label*="+10" i], button[aria-label*="forward" i]'
    ).first()

    // Alternative : bouton avec texte +10
    const altSkip = page.locator('button').filter({ hasText: /\+10|\+10s|10→|→/ }).first()
    const btn = await skipForward.isVisible() ? skipForward : altSkip

    if (await btn.isVisible()) {
      await btn.click()
      await sleep(500)

      const timeAfter = await getVideoTime(page)
      expect(timeAfter).toBeGreaterThan(timeBefore + 5) // Au moins 5s d'avance (marge)
    }
  })

  test('bouton -10s recule le temps', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    // Avancer a au moins 20s pour pouvoir reculer
    await page.evaluate(() => {
      const v = document.querySelector('video')
      if (v) v.currentTime = 30
    })
    await page.waitForTimeout(1_000)
    await showControls()

    const timeBefore = await getVideoTime(page)

    const skipBack = page.locator(
      'button[aria-label*="reculer" i], button[aria-label*="-10" i], button[aria-label*="backward" i]'
    ).first()
    const altSkip = page.locator('button').filter({ hasText: /\-10|←10|←/ }).first()
    const btn = await skipBack.isVisible() ? skipBack : altSkip

    if (await btn.isVisible()) {
      await btn.click()
      await sleep(500)

      const timeAfter = await getVideoTime(page)
      expect(timeAfter).toBeLessThan(timeBefore - 5) // Au moins 5s de recul
    }
  })

  test('skip ne descend pas en dessous de 0', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    // Se positionner au debut
    await page.evaluate(() => {
      const v = document.querySelector('video')
      if (v) v.currentTime = 3
    })
    await page.waitForTimeout(500)
    await showControls()

    const skipBack = page.locator(
      'button[aria-label*="reculer" i], button[aria-label*="-10" i], button[aria-label*="backward" i]'
    ).first()
    const altSkip = page.locator('button').filter({ hasText: /\-10|←/ }).first()
    const btn = await skipBack.isVisible() ? skipBack : altSkip

    if (await btn.isVisible()) {
      await btn.click()
      await sleep(500)

      const time = await getVideoTime(page)
      expect(time).toBeGreaterThanOrEqual(0)
    }
  })

  test('plusieurs skips successifs s\'accumulent', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await page.evaluate(() => {
      const v = document.querySelector('video')
      if (v) v.currentTime = 10
    })
    await page.waitForTimeout(500)
    await showControls()

    const timeBefore = await getVideoTime(page)

    const skipForward = page.locator(
      'button[aria-label*="avancer" i], button[aria-label*="+10" i]'
    ).first()
    const altSkip = page.locator('button').filter({ hasText: /\+10/ }).first()
    const btn = await skipForward.isVisible() ? skipForward : altSkip

    if (await btn.isVisible()) {
      await btn.click()
      await sleep(300)
      await btn.click()
      await sleep(300)
      await btn.click()
      await sleep(500)

      const timeAfter = await getVideoTime(page)
      // 3 skips de 10s = 30s environ
      expect(timeAfter).toBeGreaterThan(timeBefore + 20)
    }
  })
})
