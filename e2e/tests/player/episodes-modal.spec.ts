/**
 * Tests E2E : Modale des episodes (dans le lecteur)
 * Liste des episodes, selection de saison, changement d'episode
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const USER_STATE = path.resolve(__dirname, '../../.auth/user.json')

test.describe('Modale des episodes (lecteur)', () => {
  test.use({ storageState: USER_STATE })

  test('bouton episodes ouvre la modale', async ({ page }) => {
    const seriesId = process.env.TEST_SERIES_ID
    if (!seriesId) {
      test.skip(true, 'TEST_SERIES_ID non configure')
      return
    }

    page.setDefaultTimeout(60_000)

    // Lancer un episode de serie
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
        return v && v.readyState >= 2
      }, { timeout: 30_000 })

      // Afficher les controles
      const player = page.locator('[class*="playerContainer"], [class*="videoPlayer"]').first()
      const box = await player.boundingBox()
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      }

      // Chercher le bouton episodes
      const episodesBtn = page.locator(
        'button[aria-label*="épisode" i], button[aria-label*="episode" i]'
      ).first()

      if (await episodesBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await episodesBtn.click()
        await page.waitForTimeout(500)

        // La modale des episodes doit s'ouvrir
        const episodesModal = page.locator('[class*="episodesModal"], [class*="EpisodesModal"]').first()
        await expect(episodesModal).toBeVisible({ timeout: 5_000 })

        // Des episodes doivent etre listes
        const episodeItems = episodesModal.locator('[class*="episode"], [class*="Episode"], [class*="item"]')
        const count = await episodeItems.count()
        expect(count).toBeGreaterThan(0)
      }
    }
  })

  test('selecteur de saison dans la modale', async ({ page }) => {
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
        return v && v.readyState >= 2
      }, { timeout: 30_000 })

      const player = page.locator('[class*="playerContainer"], [class*="videoPlayer"]').first()
      const box = await player.boundingBox()
      if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

      const episodesBtn = page.locator(
        'button[aria-label*="épisode" i], button[aria-label*="episode" i]'
      ).first()

      if (await episodesBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await episodesBtn.click()
        await page.waitForTimeout(500)

        // Chercher les boutons de saisons
        const seasonBtns = page.locator('select, button').filter({ hasText: /saison|season/i })
        const count = await seasonBtns.count()

        if (count > 0) {
          // Cliquer sur un selecteur de saison
          await seasonBtns.first().click()
          await page.waitForTimeout(500)
        }
      }
    }
  })
})
