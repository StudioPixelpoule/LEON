/**
 * Tests E2E : Header et navigation
 */

import { test, expect } from '@playwright/test'

test.describe('Header', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/films')
    await page.waitForLoadState('networkidle')
  })

  test('affiche le logo LEON', async ({ page }) => {
    const logo = page.locator('a[href="/films"]').filter({ hasText: 'LEON' }).first()
    await expect(logo).toBeVisible()
  })

  test('liens de navigation fonctionnels', async ({ page }) => {
    // Films
    const filmsLink = page.locator('nav a[href="/films"]')
    await expect(filmsLink).toBeVisible()

    // Series
    const seriesLink = page.locator('nav a[href="/series"]')
    await expect(seriesLink).toBeVisible()
    await seriesLink.click()
    await expect(page).toHaveURL(/\/series/)

    // Ma liste
    const maListeLink = page.locator('nav a[href="/ma-liste"]')
    await expect(maListeLink).toBeVisible()
    await maListeLink.click()
    await expect(page).toHaveURL(/\/ma-liste/)

    // Retour films
    await page.locator('nav a[href="/films"]').click()
    await expect(page).toHaveURL(/\/films/)
  })

  test('menu utilisateur s\'ouvre et se ferme', async ({ page }) => {
    // Le bouton est identifie par son label accessible "Menu utilisateur"
    await page.getByRole('button', { name: 'Menu utilisateur' }).click()

    // Le dropdown doit contenir Deconnexion
    await expect(page.getByText('Déconnexion')).toBeVisible()

    // Cliquer en dehors ferme le menu
    await page.locator('body').click({ position: { x: 10, y: 10 } })
    await expect(page.getByText('Déconnexion')).not.toBeVisible({ timeout: 3_000 })
  })

  test('le lien actif est visuellement different', async ({ page }) => {
    // Sur /films, le lien Films doit avoir une classe contenant "active" (insensible a la casse)
    const filmsLink = page.locator('nav a[href="/films"]')
    const className = await filmsLink.getAttribute('class') || ''
    expect(className.toLowerCase()).toContain('active')
  })
})
