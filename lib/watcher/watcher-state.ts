/**
 * Gestion de l'état persisté du watcher (fichiers connus).
 * Sauvegarde/chargement JSON pour survivre aux redémarrages.
 */

import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { WATCHER_STATE_FILE } from './types'
import type { WatcherState } from './types'

/**
 * Charger les fichiers connus depuis le fichier d'état JSON.
 * Retourne un Set vide si le fichier n'existe pas ou est corrompu.
 */
export async function loadKnownFiles(): Promise<Set<string>> {
  try {
    if (!existsSync(WATCHER_STATE_FILE)) return new Set()

    const data = await readFile(WATCHER_STATE_FILE, 'utf-8')
    const state: WatcherState = JSON.parse(data)

    return new Set(state.knownFiles || [])
  } catch (error) {
    console.error('[WATCHER] Erreur chargement état watcher:', error)
    return new Set()
  }
}

/**
 * Sauvegarder les fichiers connus dans le fichier d'état JSON.
 */
export async function saveKnownFiles(knownFiles: Set<string>): Promise<void> {
  try {
    const state: WatcherState = {
      knownFiles: Array.from(knownFiles),
      lastScan: new Date().toISOString()
    }
    await writeFile(WATCHER_STATE_FILE, JSON.stringify(state, null, 2))
  } catch (error) {
    console.error('[WATCHER] Erreur sauvegarde état watcher:', error)
  }
}
