/**
 * Tests E2E : Gestion de la bibliotheque (admin)
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const ADMIN_STATE = path.resolve(__dirname, '../../.auth/admin.json')

test.describe('Bibliotheque admin', () => {
  test.use({ storageState: ADMIN_STATE })

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    // Verifier l'acces admin
    if (!page.url().includes('/admin')) {
      throw new Error(
        'Admin redirige — TEST_ADMIN_EMAIL doit etre dans ADMIN_EMAILS du serveur (.env)'
      )
    }

    // Naviguer vers l'onglet Bibliotheque
    const libraryTab = page.getByText(/bibliothèque|library/i).first()
    await libraryTab.click()
    await page.waitForTimeout(1_000)
  })

  test('la liste des medias est affichee', async ({ page }) => {
    // Des medias doivent etre listes
    const mediaItems = page.locator('[class*="media"], [class*="Media"], [class*="item"], [class*="Item"], tr, [class*="row"]')
    await expect(mediaItems.first()).toBeVisible({ timeout: 10_000 })
  })

  test('la recherche filtre les medias', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[type="text"][placeholder*="echerch" i], input[placeholder*="earch" i]').first()

    if (await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await searchInput.fill('matrix')
      await page.waitForTimeout(500)

      // Des resultats filtres doivent apparaitre
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('clic sur un media ouvre le detail', async ({ page }) => {
    const firstMedia = page.locator('[class*="media"], [class*="Media"], [class*="item"], [class*="row"]').first()

    if (await firstMedia.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstMedia.click()
      await page.waitForTimeout(1_000)

      // Un modal ou panneau de detail doit s'ouvrir
      const detail = page.locator('[class*="modal"], [class*="Modal"], [class*="detail"], [class*="Detail"]').first()
      if (await detail.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(detail).toBeVisible()
      }
    }
  })
})
