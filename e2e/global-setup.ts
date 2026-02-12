/**
 * Setup global : authentification persistee pour tous les tests
 * Se connecte avec un compte user et un compte admin,
 * sauvegarde les cookies dans .auth/
 */

import { test as setup, expect } from '@playwright/test'
import path from 'path'

const USER_FILE = path.resolve(__dirname, '.auth/user.json')
const ADMIN_FILE = path.resolve(__dirname, '.auth/admin.json')

setup('authentification utilisateur', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL et TEST_USER_PASSWORD requis dans .env.test')
  }

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: /se connecter/i }).click()

  // Attendre la redirection vers /films
  await page.waitForURL('**/films', { timeout: 15_000 })
  await expect(page).toHaveURL(/\/films/)

  await page.context().storageState({ path: USER_FILE })
})

setup('authentification admin', async ({ page }) => {
  const email = process.env.TEST_ADMIN_EMAIL
  const password = process.env.TEST_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('TEST_ADMIN_EMAIL et TEST_ADMIN_PASSWORD requis dans .env.test')
  }

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: /se connecter/i }).click()

  await page.waitForURL('**/films', { timeout: 15_000 })
  await expect(page).toHaveURL(/\/films/)

  await page.context().storageState({ path: ADMIN_FILE })
})
