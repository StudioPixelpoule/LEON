/**
 * Tests E2E : Acces et protection de l'interface admin
 * Prerequis : TEST_ADMIN_EMAIL dans .env.test doit correspondre a ADMIN_EMAILS dans .env
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const USER_STATE = path.resolve(__dirname, '../../.auth/user.json')
const ADMIN_STATE = path.resolve(__dirname, '../../.auth/admin.json')

// Detecter si le user de test est aussi admin (meme email)
const userIsAlsoAdmin =
  process.env.TEST_USER_EMAIL?.toLowerCase() === process.env.TEST_ADMIN_EMAIL?.toLowerCase()

test.describe('Acces admin - utilisateur standard', () => {
  test.use({ storageState: USER_STATE })

  test('un non-admin est redirige vers /films', async ({ page }) => {
    // Ce test ne peut pas fonctionner si le user de test EST aussi admin
    if (userIsAlsoAdmin) {
      test.skip(true, 'Le compte de test est aussi admin — pas de non-admin a tester')
      return
    }

    await page.goto('/admin')
    await page.waitForURL('**/films', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/films/)
  })
})

test.describe('Acces admin - administrateur', () => {
  test.use({ storageState: ADMIN_STATE })

  test('un admin accede a l\'interface', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    // Verifier que l'admin n'est PAS redirige
    const url = page.url()
    if (url.includes('/films') || url.includes('/login')) {
      throw new Error(
        `L'admin a ete redirige vers ${url}. ` +
        `Verifiez que TEST_ADMIN_EMAIL dans .env.test correspond a ADMIN_EMAILS dans .env`
      )
    }

    await expect(page).toHaveURL(/\/admin/)
  })

  test('les onglets principaux sont visibles', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    if (!page.url().includes('/admin')) {
      throw new Error(
        'Admin redirige — TEST_ADMIN_EMAIL doit etre dans ADMIN_EMAILS du serveur'
      )
    }

    // Onglets du sidebar admin
    const tabs = ['Dashboard', 'Scanner', 'Bibliothèque', 'Transcodage', 'Statistiques']

    for (const tabName of tabs) {
      const tab = page.getByText(tabName, { exact: false }).first()
      await expect(tab).toBeVisible({ timeout: 10_000 })
    }
  })

  test('navigation entre les onglets fonctionne', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    if (!page.url().includes('/admin')) {
      throw new Error(
        'Admin redirige — TEST_ADMIN_EMAIL doit etre dans ADMIN_EMAILS du serveur'
      )
    }

    // Cliquer sur Scanner
    await page.getByText('Scanner').first().click()
    await page.waitForTimeout(500)

    // Cliquer sur Bibliotheque
    await page.getByText('Bibliothèque').first().click()
    await page.waitForTimeout(500)

    // Pas de crash
    await expect(page.locator('body')).toBeVisible()
  })
})
