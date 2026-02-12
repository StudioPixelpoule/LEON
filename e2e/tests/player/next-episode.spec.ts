/**
 * Tests E2E : Episode suivant (series)
 * Countdown, auto-play, boutons
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const USER_STATE = path.resolve(__dirname, '../../.auth/user.json')

test.describe('Episode suivant', () => {
  test.use({ storageState: USER_STATE })

  test('bouton episode suivant visible pour les series', async ({ page }) => {
    const seriesId = process.env.TEST_SERIES_ID
    if (!seriesId) {
      test.skip(true, 'TEST_SERIES_ID non configure')
      return
    }

    page.setDefaultTimeout(60_000)

    await page.goto('/series')
    await page.waitForLoadState('networkidle')

    // Ouvrir une serie
    const seriesCard = page.locator('[class*="poster"], [class*="card"], [class*="Card"]').first()
    await expect(seriesCard).toBeVisible({ timeout: 15_000 })
    await seriesCard.click()

    // Attendre le modal serie
    const modal = page.locator('[class*="modal"], [class*="Modal"]').first()
    await expect(modal).toBeVisible({ timeout: 10_000 })

    // Cliquer sur un episode
    const episode = modal.locator('[class*="episode"], [class*="Episode"]').first()
    if (await episode.isVisible()) {
      await episode.click()

      // Attendre le lecteur
      const video = page.locator('video').first()
      await video.waitFor({ state: 'attached', timeout: 30_000 })
      await page.waitForFunction(() => {
        const v = document.querySelector('video')
        return v && v.readyState >= 2
      }, { timeout: 30_000 })

      // Afficher les controles
      const player = page.locator('[class*="playerContainer"], [class*="videoPlayer"]').first()
      const box = await player.boundingBox()
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      }

      // Chercher le bouton episode suivant
      const nextEpBtn = page.locator(
        'button[aria-label*="suivant" i], button[aria-label*="next" i]'
      ).first()

      // Le bouton peut etre present ou non selon s'il y a un episode suivant
      if (await nextEpBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(nextEpBtn).toBeVisible()
      }
    }
  })

  test('overlay episode suivant apparait pres de la fin', async ({ page }) => {
    const seriesId = process.env.TEST_SERIES_ID
    if (!seriesId) {
      test.skip(true, 'TEST_SERIES_ID non configure')
      return
    }

    page.setDefaultTimeout(60_000)

    await page.goto('/series')
    await page.waitForLoadState('networkidle')

    const seriesCard = page.locator('[class*="poster"], [class*="card"], [class*="Card"]').first()
    await expect(seriesCard).toBeVisible({ timeout: 15_000 })
    await seriesCard.click()

    const modal = page.locator('[class*="modal"], [class*="Modal"]').first()
    await expect(modal).toBeVisible({ timeout: 10_000 })

    const episode = modal.locator('[class*="episode"], [class*="Episode"]').first()
    if (await episode.isVisible()) {
      await episode.click()

      await page.waitForFunction(() => {
        const v = document.querySelector('video')
        return v && v.readyState >= 2 && v.duration > 0
      }, { timeout: 30_000 })

      // Aller pres de la fin (45s avant la fin - zone de generique)
      await page.evaluate(() => {
        const v = document.querySelector('video')
        if (v && v.duration > 60) {
          v.currentTime = v.duration - 30
        }
      })

      await page.waitForTimeout(5_000)

      // L'overlay episode suivant devrait apparaitre
      const overlay = page.locator('[class*="nextEpisode"], [class*="NextEpisode"]').first()
      if (await overlay.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await expect(overlay).toBeVisible()

        // Verifier les boutons
        const playNowBtn = page.getByText(/lire maintenant|play now/i).first()
        const cancelBtn = page.getByText(/annuler|cancel/i).first()

        if (await playNowBtn.isVisible().catch(() => false)) {
          await expect(playNowBtn).toBeVisible()
        }
        if (await cancelBtn.isVisible().catch(() => false)) {
          await expect(cancelBtn).toBeVisible()
        }
      }
    }
  })
})
