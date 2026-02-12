/**
 * Tests E2E : API Health Check
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

test.describe('API Health', () => {
  test('GET /api/health retourne 200', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`)
    expect(response.ok()).toBe(true)

    const body = await response.json()
    expect(body).toHaveProperty('uptime')
    expect(body).toHaveProperty('timestamp')
    expect(body.uptime).toBeGreaterThan(0)
  })
})
