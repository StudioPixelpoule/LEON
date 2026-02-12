/**
 * Fixture lecteur video pour les tests E2E
 * Ouvre un film de test et attend que le lecteur soit pret
 * Les cartes film sont des div[role="button"][aria-label="Lire <titre>"]
 */

import { test as base, expect, type Page, type Locator } from '@playwright/test'
import path from 'path'

const USER_STATE = path.resolve(__dirname, '..', '.auth/user.json')

interface PlayerContext {
  /** La page du navigateur */
  page: Page
  /** L'element <video> */
  video: Locator
  /** Le container du lecteur */
  player: Locator
  /** Attend que la video soit en lecture */
  waitForPlaying: () => Promise<void>
  /** Attend que les controles soient visibles */
  waitForControls: () => Promise<void>
  /** Recupere l'etat actuel de la video */
  getVideoState: () => Promise<{
    currentTime: number
    duration: number
    paused: boolean
    volume: number
    muted: boolean
  }>
  /** Deplace la souris pour afficher les controles */
  showControls: () => Promise<void>
}

export const test = base.extend<{ playerCtx: PlayerContext }>({
  playerCtx: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: USER_STATE })
    const page = await context.newPage()

    const mediaId = process.env.TEST_MEDIA_ID
    if (!mediaId) {
      throw new Error('TEST_MEDIA_ID requis dans .env.test')
    }

    // Naviguer vers la page films
    await page.goto('/films')
    await page.waitForLoadState('networkidle')

    // Cliquer sur le premier film (role="button" avec aria-label="Lire <titre>")
    const firstFilm = page.locator('[role="button"][aria-label^="Lire"]').first()
    await firstFilm.waitFor({ state: 'visible', timeout: 15_000 })
    await firstFilm.click()

    // Attendre le modal et cliquer sur le bouton "Lire" (dans le modal, pas la carte)
    const playButton = page.locator('[class*="modal" i] button, [class*="Modal" i] button').filter({ hasText: /^Lire$/ }).first()
    await playButton.waitFor({ state: 'visible', timeout: 10_000 })
    await playButton.click()

    // Attendre que le lecteur video apparaisse
    const video = page.locator('video').first()
    await video.waitFor({ state: 'attached', timeout: 30_000 })

    const player = page.locator('[class*="player" i]').first()

    // Helpers
    const waitForPlaying = async () => {
      await page.waitForFunction(() => {
        const v = document.querySelector('video')
        return v && !v.paused && v.currentTime > 0
      }, { timeout: 30_000 })
    }

    const waitForControls = async () => {
      await page.locator('[class*="controls"]').first().waitFor({ state: 'visible', timeout: 5_000 })
    }

    const getVideoState = async () => {
      return page.evaluate(() => {
        const v = document.querySelector('video')
        if (!v) throw new Error('Element video introuvable')
        return {
          currentTime: v.currentTime,
          duration: v.duration,
          paused: v.paused,
          volume: v.volume,
          muted: v.muted,
        }
      })
    }

    const showControls = async () => {
      const box = await player.boundingBox()
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      }
    }

    // Diagnostics si la video ne charge pas
    const videoInfo = await page.evaluate(() => {
      const v = document.querySelector('video')
      if (!v) return { found: false }
      return {
        found: true,
        src: v.src || '(vide)',
        currentSrc: v.currentSrc || '(vide)',
        readyState: v.readyState,
        networkState: v.networkState,
        error: v.error ? { code: v.error.code, message: v.error.message } : null,
        sourceElements: Array.from(v.querySelectorAll('source')).map(s => s.src),
      }
    })

    if (!videoInfo.found) {
      throw new Error('Element <video> non trouve dans le DOM apres le clic Lire')
    }

    if (videoInfo.error) {
      throw new Error(`Erreur video: code=${videoInfo.error.code} message="${videoInfo.error.message}" src="${videoInfo.src}"`)
    }

    // Attendre le chargement initial (readyState >= 2 = HAVE_CURRENT_DATA)
    // Timeout 90s pour laisser le transcodage HLS demarrer
    try {
      await page.waitForFunction(() => {
        const v = document.querySelector('video')
        return v && v.readyState >= 2
      }, { timeout: 90_000 })
    } catch {
      // Diagnostics detailles en cas d'echec
      const state = await page.evaluate(() => {
        const v = document.querySelector('video')
        if (!v) return 'video element absent'
        return JSON.stringify({
          readyState: v.readyState,
          networkState: v.networkState,
          paused: v.paused,
          src: v.src,
          currentSrc: v.currentSrc,
          error: v.error ? { code: v.error.code, message: v.error.message } : null,
          buffered: v.buffered.length > 0 ? { start: v.buffered.start(0), end: v.buffered.end(0) } : null,
        })
      })
      throw new Error(`Video non prete apres 90s. Etat: ${state}`)
    }

    await use({ page, video, player, waitForPlaying, waitForControls, getVideoState, showControls })
    await context.close()
  },
})

export { expect }
