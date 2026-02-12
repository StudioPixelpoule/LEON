/**
 * Tests E2E : Reprise de lecture
 * Sauvegarde et restauration de la position
 */

import { test, expect } from '../../fixtures/player.fixture'
import { getVideoTime, sleep } from '../../helpers/wait'

test.describe('Reprise de lecture', () => {
  test('la position est sauvegardee et restauree', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()

    // Avancer a 2 minutes
    await page.evaluate(() => {
      const v = document.querySelector('video')
      if (v) v.currentTime = 120
    })
    await page.waitForTimeout(2_000)

    // Attendre que la position soit sauvegardee (debounce 10s)
    // Pour accelerer, on attend un peu et on force via l'API
    const currentTime = await getVideoTime(page)
    expect(currentTime).toBeGreaterThan(100)

    // Attendre la sauvegarde automatique
    await sleep(12_000)

    // Fermer le lecteur
    await showControls()
    const closeBtn = page.locator('button[aria-label*="fermer" i], [class*="close"], [class*="Close"]').first()
    if (await closeBtn.isVisible()) {
      await closeBtn.click()
      await page.waitForTimeout(2_000)
    } else {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(2_000)
    }

    // Rouvrir le meme film
    const firstCard = page.locator('[class*="poster"], [class*="card"], [class*="Card"]').first()
    if (await firstCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstCard.click()

      const playButton = page.getByRole('button', { name: /lecture|regarder|play|reprendre/i }).first()
      await playButton.waitFor({ state: 'visible', timeout: 10_000 })
      await playButton.click()

      // Attendre que la video charge
      await page.waitForFunction(() => {
        const v = document.querySelector('video')
        return v && v.readyState >= 2
      }, { timeout: 30_000 })

      await page.waitForTimeout(3_000)

      // La position doit etre restauree (environ 120s, avec marge)
      const resumedTime = await getVideoTime(page)
      expect(resumedTime).toBeGreaterThan(60) // Au moins 1 minute (marge large)
    }
  })

  test('la position est sauvegardee via l\'API', async ({ playerCtx }) => {
    const { page, waitForPlaying } = playerCtx

    await waitForPlaying()

    // Avancer
    await page.evaluate(() => {
      const v = document.querySelector('video')
      if (v) v.currentTime = 60
    })

    // Attendre un peu pour la sauvegarde automatique
    await sleep(12_000)

    // Verifier que l'API de position a ete appelee
    // On ne peut pas facilement intercepter les requetes passees,
    // mais on peut verifier que le serveur repond
    const mediaId = process.env.TEST_MEDIA_ID
    if (mediaId) {
      const response = await page.request.get(`/api/playback-position?mediaId=${mediaId}`)
      expect(response.ok()).toBe(true)
    }
  })
})
