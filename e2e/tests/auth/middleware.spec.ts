/**
 * Tests E2E : Middleware d'authentification et protection des routes
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const USER_STATE = path.resolve(__dirname, '../../.auth/user.json')
const ADMIN_STATE = path.resolve(__dirname, '../../.auth/admin.json')

// Detecter si le user de test est aussi admin (meme email)
const userIsAlsoAdmin =
  process.env.TEST_USER_EMAIL?.toLowerCase() === process.env.TEST_ADMIN_EMAIL?.toLowerCase()

test.describe('Protection des routes - sans authentification', () => {
  test('/films redirige vers /login', async ({ page }) => {
    await page.goto('/films')
    await page.waitForURL('**/login**', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('/series redirige vers /login', async ({ page }) => {
    await page.goto('/series')
    await page.waitForURL('**/login**', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('/ma-liste redirige vers /login', async ({ page }) => {
    await page.goto('/ma-liste')
    await page.waitForURL('**/login**', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('/admin redirige vers /login', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForURL('**/login**', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('le redirect conserve la page demandee', async ({ page }) => {
    await page.goto('/ma-liste')
    await page.waitForURL('**/login**', { timeout: 10_000 })
    const url = new URL(page.url())
    expect(url.searchParams.get('redirect')).toBe('/ma-liste')
  })
})

test.describe('Protection des routes - utilisateur standard', () => {
  test.use({ storageState: USER_STATE })

  test('/films est accessible', async ({ page }) => {
    await page.goto('/films')
    await expect(page).toHaveURL(/\/films/)
    await page.waitForLoadState('networkidle')
  })

  test('/admin redirige vers /films pour un non-admin', async ({ page }) => {
    // Ce test ne peut pas fonctionner si le user de test EST aussi admin
    if (userIsAlsoAdmin) {
      test.skip(true, 'Le compte de test est aussi admin — pas de non-admin a tester')
      return
    }

    await page.goto('/admin')
    // Le middleware redirige les non-admin vers /films
    await page.waitForURL('**/films', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/films/)
  })

  test('/login redirige vers /films si deja connecte', async ({ page }) => {
    await page.goto('/login')
    await page.waitForURL('**/films', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/films/)
  })
})

test.describe('Protection des routes - admin', () => {
  test.use({ storageState: ADMIN_STATE })

  test('/admin est accessible pour un admin', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    // L'admin devrait rester sur /admin
    await expect(page).toHaveURL(/\/admin/)
  })
})
