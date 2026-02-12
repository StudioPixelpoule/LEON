/**
 * Tests E2E : Queue de transcodage (admin)
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const ADMIN_STATE = path.resolve(__dirname, '../../.auth/admin.json')

test.describe('Transcodage admin', () => {
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

    // L'onglet Transcodage
    const transcodeTab = page.getByText(/transcodage/i).first()
    await transcodeTab.click()
    await page.waitForTimeout(1_000)
  })

  test('les statistiques de transcodage sont affichees', async ({ page }) => {
    // Des statistiques doivent etre visibles (nombres, pourcentages, etc.)
    const stats = page.locator('[class*="stat"], [class*="Stat"], [class*="count"], [class*="progress"]')
    await expect(stats.first()).toBeVisible({ timeout: 10_000 })
  })

  test('la queue de transcodage est visible', async ({ page }) => {
    // La section queue doit etre presente
    const queueSection = page.getByText(/queue|file d'attente|en cours/i).first()
    await expect(queueSection).toBeVisible({ timeout: 10_000 })
  })

  test('les boutons d\'action sont presents', async ({ page }) => {
    // Boutons de controle (start, pause, scan, etc.)
    const actionButtons = page.locator('button').filter({
      hasText: /démarrer|start|pause|reprendre|resume|scanner|scan|arrêter|stop/i
    })
    const count = await actionButtons.count()
    expect(count).toBeGreaterThan(0)
  })
})
