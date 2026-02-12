/**
 * Tests E2E : API Favoris
 * Utilise fetch() dans le navigateur pour transmettre les cookies Supabase
 * IMPORTANT : credentials: 'include' sur TOUS les fetch pour envoyer les cookies
 */

import { test, expect } from '@playwright/test'

test.describe('API Favoris', () => {
  const testMediaId = process.env.TEST_MEDIA_ID || 'test-media-id'

  test.beforeEach(async ({ page }) => {
    // Charger la page pour initialiser les cookies Supabase
    await page.goto('/films')
    await page.waitForLoadState('networkidle')
  })

  test('cycle complet : ajout, verification, suppression', async ({ page }) => {
    // Ajouter aux favoris
    const addResult = await page.evaluate(async (mediaId) => {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mediaId, mediaType: 'movie' }),
      })
      return { status: res.status, body: await res.json() }
    }, testMediaId)

    // Diagnostic si 401
    if (addResult.status === 401) {
      const cookies = await page.evaluate(() => document.cookie)
      throw new Error(
        `API retourne 401. Body: ${JSON.stringify(addResult.body)}. ` +
        `Cookies navigateur: ${cookies.substring(0, 200)}...`
      )
    }
    expect(addResult.status).toBeLessThan(300)
    expect(addResult.body.success).toBe(true)

    // Verifier via /check
    const checkResult = await page.evaluate(async (mediaId) => {
      const res = await fetch(`/api/favorites/check?mediaId=${mediaId}&mediaType=movie`, {
        credentials: 'include',
      })
      return { status: res.status, body: await res.json() }
    }, testMediaId)

    expect(checkResult.status).toBe(200)
    expect(checkResult.body.isFavorite).toBe(true)

    // Supprimer
    const deleteResult = await page.evaluate(async (mediaId) => {
      const res = await fetch(`/api/favorites?mediaId=${mediaId}&mediaType=movie`, {
        method: 'DELETE',
        credentials: 'include',
      })
      return { status: res.status, body: await res.json() }
    }, testMediaId)

    expect(deleteResult.status).toBeLessThan(300)
    expect(deleteResult.body.success).toBe(true)

    // Verifier la suppression
    const recheckResult = await page.evaluate(async (mediaId) => {
      const res = await fetch(`/api/favorites/check?mediaId=${mediaId}&mediaType=movie`, {
        credentials: 'include',
      })
      return { status: res.status, body: await res.json() }
    }, testMediaId)

    expect(recheckResult.body.isFavorite).toBe(false)
  })

  test('GET /api/favorites retourne les favoris', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/favorites', {
        credentials: 'include',
      })
      return { status: res.status, body: await res.json() }
    })

    expect(result.status).toBe(200)
    expect(result.body.success).toBe(true)
    expect(Array.isArray(result.body.favorites)).toBe(true)
  })
})
