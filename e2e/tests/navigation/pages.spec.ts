/**
 * Tests E2E : Navigation entre les pages principales
 */

import { test, expect } from '@playwright/test'

test.describe('Pages principales', () => {
  test('page /films affiche le catalogue', async ({ page }) => {
    await page.goto('/films')
    await page.waitForLoadState('networkidle')

    // Le header doit etre present
    await expect(page.getByText('LEON').first()).toBeVisible()

    // Des films doivent etre affiches (au moins un poster ou card)
    const content = page.locator('[class*="movieRow"], [class*="MovieRow"], [class*="hero"], [class*="Hero"], [class*="MediaCard"]')
    await expect(content.first()).toBeVisible({ timeout: 15_000 })
  })

  test('page /series affiche le catalogue series', async ({ page }) => {
    await page.goto('/series')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('LEON').first()).toBeVisible()

    // Du contenu series doit etre affiche
    const content = page.locator('[class*="poster"], [class*="Poster"], [class*="card"], [class*="Card"], [class*="grid"], [class*="Grid"]')
    await expect(content.first()).toBeVisible({ timeout: 15_000 })
  })

  test('page /ma-liste est accessible', async ({ page }) => {
    await page.goto('/ma-liste')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('LEON').first()).toBeVisible()
    // La page doit se charger sans erreur
    await expect(page.locator('body')).not.toContainText('Error')
  })

  test('page 404 pour route inexistante', async ({ page }) => {
    const response = await page.goto('/route-qui-nexiste-pas')
    // Next.js retourne 404
    expect(response?.status()).toBe(404)
  })

  test('la page racine / redirige vers /films', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL('**/films', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/films/)
  })
})
