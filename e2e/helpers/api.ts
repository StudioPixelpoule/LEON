/**
 * Helpers pour les appels API dans les tests E2E
 */

import { type APIRequestContext } from '@playwright/test'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

/** GET sur une route API */
export async function apiGet(request: APIRequestContext, path: string) {
  return request.get(`${BASE_URL}${path}`)
}

/** POST sur une route API */
export async function apiPost(request: APIRequestContext, path: string, data?: Record<string, unknown>) {
  return request.post(`${BASE_URL}${path}`, { data })
}

/** DELETE sur une route API */
export async function apiDelete(request: APIRequestContext, path: string) {
  return request.delete(`${BASE_URL}${path}`)
}

/** PATCH sur une route API */
export async function apiPatch(request: APIRequestContext, path: string, data?: Record<string, unknown>) {
  return request.patch(`${BASE_URL}${path}`, { data })
}
