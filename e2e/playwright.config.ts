import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import dotenv from 'dotenv'

// Charger les variables de test
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') })

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000'

// Detecter un vrai CI (pas Cursor IDE qui set CI=1)
const isRealCI = !!process.env.GITHUB_ACTIONS || !!process.env.GITLAB_CI

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isRealCI,
  retries: isRealCI ? 1 : 0,
  workers: isRealCI ? 1 : undefined,
  reporter: isRealCI ? 'github' : 'list',
  timeout: 30_000,

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Projet de setup : authentification
    {
      name: 'setup',
      testDir: '.',
      testMatch: /global-setup\.ts/,
      teardown: 'cleanup',
    },
    {
      name: 'cleanup',
      testDir: '.',
      testMatch: /global-teardown\.ts/,
    },

    // Tests authentification (SANS logout — le logout invalide tous les tokens Supabase)
    {
      name: 'auth',
      testDir: './tests/auth',
      testIgnore: ['**/logout.spec.ts'],
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },

    // Logout tourne EN DERNIER car signOut() invalide toutes les sessions Supabase
    {
      name: 'auth-logout',
      testDir: './tests/auth',
      testMatch: /logout\.spec\.ts/,
      dependencies: ['setup', 'api', 'user', 'admin'],
      use: { ...devices['Desktop Chrome'] },
    },

    // Tests API (avec navigateur pour les cookies Supabase)
    {
      name: 'api',
      testDir: './tests/api',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.resolve(__dirname, '.auth/user.json'),
      },
    },

    // Tests principaux (avec auth user) — hors player
    {
      name: 'user',
      testDir: './tests',
      testIgnore: ['**/auth/**', '**/admin/**', '**/api/**', '**/player/**'],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.resolve(__dirname, '.auth/user.json'),
      },
    },

    // Tests player (timeout plus long pour le transcodage HLS)
    {
      name: 'player',
      testDir: './tests/player',
      dependencies: ['setup'],
      timeout: 120_000,
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.resolve(__dirname, '.auth/user.json'),
      },
    },

    // Tests admin
    {
      name: 'admin',
      testDir: './tests/admin',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.resolve(__dirname, '.auth/admin.json'),
      },
    },
  ],

  // Demarrage du serveur de dev sur le port 3000
  webServer: {
    command: 'npx next dev --port 3000',
    url: baseURL,
    cwd: path.resolve(__dirname, '..'),
    reuseExistingServer: !isRealCI,
    timeout: 120_000,
  },
})
