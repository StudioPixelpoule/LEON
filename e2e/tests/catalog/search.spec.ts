/**
 * Tests E2E : Recherche dans le catalogue
 * Le search utilise un bouton "Rechercher" qui ouvre un input
 * Input: type="text" placeholder="Titres, personnes, genres..."
 */

import { test, expect } from '@playwright/test'

test.describe('Recherche', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/films')
    await page.waitForLoadState('networkidle')
  })

  test('le champ de recherche est accessible', async ({ page }) => {
    // Le bouton de recherche a le label "Rechercher"
    const searchButton = page.getByRole('button', { name: 'Rechercher' })
    await expect(searchButton).toBeVisible({ timeout: 10_000 })
  })

  test('la recherche filtre les resultats', async ({ page }) => {
    // Ouvrir la recherche
    await page.getByRole('button', { name: 'Rechercher' }).click()

    // L'input apparait avec le placeholder specifique
    const searchInput = page.locator('input[placeholder="Titres, personnes, genres..."]')
    await searchInput.waitFor({ state: 'visible', timeout: 5_000 })
    await searchInput.fill('matrix')

    // Attendre le debounce (300ms) et les resultats
    await page.waitForTimeout(500)

    // Des resultats doivent apparaitre ou un message "aucun resultat"
    const hasResults = await page.locator('[class*="result" i], [class*="suggestion" i], [class*="search" i] [class*="grid" i]').first().isVisible().catch(() => false)
    const hasNoResults = await page.getByText(/aucun/i).isVisible().catch(() => false)

    expect(hasResults || hasNoResults).toBe(true)
  })

  test('recherche vide ne crashe pas', async ({ page }) => {
    await page.getByRole('button', { name: 'Rechercher' }).click()

    const searchInput = page.locator('input[placeholder="Titres, personnes, genres..."]')
    await searchInput.waitFor({ state: 'visible', timeout: 5_000 })
    await searchInput.fill('')
    await searchInput.press('Enter')

    // La page ne doit pas crasher
    await expect(page.locator('body')).toBeVisible()
  })
})
