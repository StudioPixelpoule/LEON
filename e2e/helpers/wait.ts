/**
 * Helpers d'attente pour les tests E2E
 */

import { type Page } from '@playwright/test'

/** Attend que la video soit prete (readyState >= 2) */
export async function waitForVideoReady(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(() => {
    const v = document.querySelector('video')
    return v && v.readyState >= 2
  }, { timeout })
}

/** Attend que la video soit en lecture */
export async function waitForVideoPlaying(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(() => {
    const v = document.querySelector('video')
    return v && !v.paused && v.currentTime > 0
  }, { timeout })
}

/** Attend que la video soit en pause */
export async function waitForVideoPaused(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForFunction(() => {
    const v = document.querySelector('video')
    return v && v.paused
  }, { timeout })
}

/** Attend que le currentTime atteigne une valeur minimale */
export async function waitForTime(page: Page, minTime: number, timeout = 30_000): Promise<void> {
  await page.waitForFunction((min) => {
    const v = document.querySelector('video')
    return v && v.currentTime >= min
  }, minTime, { timeout })
}

/** Attend N secondes */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Recupere le currentTime de la video */
export async function getVideoTime(page: Page): Promise<number> {
  return page.evaluate(() => {
    const v = document.querySelector('video')
    return v ? v.currentTime : 0
  })
}

/** Recupere la duree totale de la video */
export async function getVideoDuration(page: Page): Promise<number> {
  return page.evaluate(() => {
    const v = document.querySelector('video')
    return v ? v.duration : 0
  })
}

/** Verifie si la video est muted */
export async function isVideoMuted(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const v = document.querySelector('video')
    return v ? v.muted : false
  })
}

/** Recupere le volume de la video */
export async function getVideoVolume(page: Page): Promise<number> {
  return page.evaluate(() => {
    const v = document.querySelector('video')
    return v ? v.volume : 0
  })
}
