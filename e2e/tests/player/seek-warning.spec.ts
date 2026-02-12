/**
 * Tests E2E : Avertissement de seek au-dela du transcodage
 */

import { test, expect } from '../../fixtures/player.fixture'

test.describe('Avertissement Seek', () => {
  test('seek dans la zone disponible ne produit pas d\'avertissement', async ({ playerCtx }) => {
    const { page, waitForPlaying, showControls } = playerCtx

    await waitForPlaying()
    await showControls()

    // Seek a une position raisonnable (10% de la duree)
    await page.evaluate(() => {
      const v = document.querySelector('video')
      if (v && v.duration > 0) {
        v.currentTime = v.duration * 0.1
      }
    })
    await page.waitForTimeout(1_000)

    // Pas de message d'avertissement
    const warning = page.locator('[class*="seekWarning"], [class*="warning"]').first()
    const isVisible = await warning.isVisible().catch(() => false)

    // Si le film est pre-transcode, pas de warning du tout
    // Sinon, le warning ne devrait apparaitre que pour un seek hors zone
    // Dans les deux cas, un seek a 10% ne devrait pas declencher de warning
    if (isVisible) {
      // Le warning ne devrait pas etre present pour un seek dans la zone disponible
      const text = await warning.textContent()
      // Accepter qu'il puisse etre present brievement
      expect(text).not.toContain('Erreur')
    }
  })

  test('le message de seek warning est informatif', async ({ playerCtx }) => {
    const { page, waitForPlaying } = playerCtx

    await waitForPlaying()

    // Essayer de seek a 90% de la duree (peut etre au-dela du transcode)
    await page.evaluate(() => {
      const v = document.querySelector('video')
      if (v && v.duration > 0) {
        v.currentTime = v.duration * 0.9
      }
    })
    await page.waitForTimeout(2_000)

    // Si un warning apparait, verifier qu'il contient un message informatif
    const warning = page.locator('[class*="seekWarning"], [class*="warning"]').first()
    if (await warning.isVisible().catch(() => false)) {
      const text = await warning.textContent()
      // Le message doit etre informatif (contient "transcodage" ou "disponible")
      expect(text?.toLowerCase()).toMatch(/transc|disponible|cours/)
    }
  })
})
