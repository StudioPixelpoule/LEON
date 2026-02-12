/**
 * Tests E2E : API Positions de lecture
 * Utilise fetch() dans le navigateur pour transmettre les cookies Supabase
 * IMPORTANT : credentials: 'include' sur TOUS les fetch pour envoyer les cookies
 */

import { test, expect } from '@playwright/test'

test.describe('API Playback Position', () => {
  const testMediaId = process.env.TEST_MEDIA_ID || 'test-media-id'

  test.beforeEach(async ({ page }) => {
    await page.goto('/films')
    await page.waitForLoadState('networkidle')
  })

  test('POST sauvegarde une position de lecture', async ({ page }) => {
    const result = await page.evaluate(async (mediaId) => {
      const res = await fetch('/api/playback-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mediaId,
          currentTime: 120,
          duration: 7200,
          media_type: 'movie',
        }),
      })
      return { status: res.status, body: await res.json() }
    }, testMediaId)

    expect(result.status).toBeLessThan(300)
    expect(result.body.success).toBe(true)
  })

  test('GET recupere la position sauvegardee', async ({ page }) => {
    // Sauvegarder d'abord
    await page.evaluate(async (mediaId) => {
      await fetch('/api/playback-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mediaId,
          currentTime: 120,
          duration: 7200,
          media_type: 'movie',
        }),
      })
    }, testMediaId)

    // Recuperer
    const result = await page.evaluate(async (mediaId) => {
      const res = await fetch(`/api/playback-position?mediaId=${mediaId}`, {
        credentials: 'include',
      })
      return { status: res.status, body: await res.json() }
    }, testMediaId)

    expect(result.status).toBe(200)
    expect(result.body).toHaveProperty('currentTime')
  })

  test('DELETE sans userId retourne 400', async ({ page }) => {
    const result = await page.evaluate(async (mediaId) => {
      const res = await fetch(`/api/playback-position?mediaId=${mediaId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      return { status: res.status, body: await res.json() }
    }, testMediaId)

    expect(result.status).toBe(400)
    expect(result.body.error).toContain('userId')
  })

  test('DELETE avec userId supprime la position', async ({ page }) => {
    // Sauvegarder une position
    await page.evaluate(async (mediaId) => {
      await fetch('/api/playback-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mediaId,
          currentTime: 60,
          duration: 7200,
          media_type: 'movie',
        }),
      })
    }, testMediaId)

    // Recuperer le userId depuis GET
    const getData = await page.evaluate(async (mediaId) => {
      const res = await fetch(`/api/playback-position?mediaId=${mediaId}`, {
        credentials: 'include',
      })
      return res.json()
    }, testMediaId)

    const userId = getData.userId
    if (!userId) {
      test.skip(true, 'userId non disponible dans la reponse GET')
      return
    }

    const result = await page.evaluate(async ({ mediaId, userId }) => {
      const res = await fetch(`/api/playback-position?mediaId=${mediaId}&userId=${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      return { status: res.status, body: await res.json() }
    }, { mediaId: testMediaId, userId })

    expect(result.status).toBeLessThan(300)
    expect(result.body.success).toBe(true)
  })
})
