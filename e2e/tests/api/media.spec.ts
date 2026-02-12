/**
 * Tests E2E : API Medias
 * /api/media/grouped retourne { success, count, media: [...] }
 * /api/stats retourne { total, withPosters, ... }
 * Ces routes n'exigent pas d'auth, mais on utilise page.request par coherence
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

test.describe('API Media', () => {
  test('GET /api/media/list retourne des medias', async ({ page }) => {
    await page.goto('/films')

    const response = await page.request.get(`${BASE_URL}/api/media/list`)
    expect(response.ok()).toBe(true)

    const body = await response.json()
    expect(Array.isArray(body) || (body && typeof body === 'object')).toBe(true)
  })

  test('GET /api/media/grouped retourne des categories', async ({ page }) => {
    await page.goto('/films')

    const response = await page.request.get(`${BASE_URL}/api/media/grouped`)
    expect(response.ok()).toBe(true)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(typeof body.count).toBe('number')
    expect(Array.isArray(body.media)).toBe(true)
    if (body.media.length > 0) {
      expect(body.media[0]).toHaveProperty('id')
      expect(body.media[0]).toHaveProperty('title')
    }
  })

  test('GET /api/series/list retourne des series', async ({ page }) => {
    await page.goto('/films')

    const response = await page.request.get(`${BASE_URL}/api/series/list`)
    expect(response.ok()).toBe(true)

    const body = await response.json()
    expect(Array.isArray(body) || (body && typeof body === 'object')).toBe(true)
  })

  test('GET /api/stats retourne des statistiques', async ({ page }) => {
    await page.goto('/films')

    const response = await page.request.get(`${BASE_URL}/api/stats`)
    expect(response.ok()).toBe(true)

    const body = await response.json()
    expect(body).toHaveProperty('total')
    expect(typeof body.total).toBe('number')
  })
})
