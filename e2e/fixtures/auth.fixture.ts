/**
 * Fixture authentification API pour les tests E2E
 * Extrait le token JWT depuis le storageState et cree un
 * contexte de requetes avec le header Authorization: Bearer
 */

import { test as base, type APIRequestContext } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const USER_STATE = path.resolve(__dirname, '..', '.auth/user.json')

interface StorageState {
  cookies: Array<{
    name: string
    value: string
    domain: string
    path: string
  }>
  origins: unknown[]
}

/**
 * Extraire le token JWT depuis le fichier storageState
 * Le cookie Supabase peut etre au format: base64-<base64(JSON)>
 */
function extractTokenFromStorageState(statePath: string): string | null {
  try {
    const stateData = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as StorageState
    const authCookie = stateData.cookies.find(c => c.name.includes('auth-token'))

    if (!authCookie) {
      console.error('[AUTH FIXTURE] Aucun cookie auth-token trouve')
      return null
    }

    let cookieValue = authCookie.value

    // Enlever le prefixe "base64-" si present
    if (cookieValue.startsWith('base64-')) {
      cookieValue = cookieValue.slice(7)
    }

    // Essayer de decoder le base64 puis parser le JSON
    try {
      const decoded = Buffer.from(cookieValue, 'base64').toString('utf-8')
      const parsed = JSON.parse(decoded)
      return parsed.access_token || null
    } catch {
      // Essayer JSON direct
      try {
        const parsed = JSON.parse(cookieValue)
        return parsed.access_token || null
      } catch {
        // C'est peut-etre deja un JWT
        if (cookieValue.startsWith('eyJ')) {
          return cookieValue
        }
        return null
      }
    }
  } catch (error) {
    console.error('[AUTH FIXTURE] Erreur lecture storageState:', error)
    return null
  }
}

export const test = base.extend<{ authRequest: APIRequestContext }>({
  authRequest: async ({ playwright }, use) => {
    const token = extractTokenFromStorageState(USER_STATE)

    if (!token) {
      throw new Error('Impossible d\'extraire le token JWT depuis le storageState')
    }

    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000'

    // Creer un contexte de requetes avec le header Authorization
    const apiContext = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        'Authorization': `Bearer ${token}`,
      },
    })

    await use(apiContext)
    await apiContext.dispose()
  },
})

export { expect } from '@playwright/test'
