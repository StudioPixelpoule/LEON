/**
 * Surveillance du système de fichiers.
 * - fs.watch récursif pour détection temps-réel
 * - Polling de secours pour les montages NAS (NFS/SMB)
 * - Scan de répertoire récursif
 */

import { watch, FSWatcher } from 'fs'
import { readdir, stat } from 'fs/promises'
import path from 'path'
import { VIDEO_EXTENSIONS, MEDIA_DIR, SERIES_DIR } from './types'

/**
 * Scanner récursivement un répertoire pour trouver tous les fichiers vidéo.
 */
export async function scanDirectory(dir: string): Promise<string[]> {
  const files: string[] = []

  const scan = async (currentDir: string) => {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)

        if (entry.isDirectory()) {
          await scan(fullPath)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (VIDEO_EXTENSIONS.includes(ext)) {
            files.push(fullPath)
          }
        }
      }
    } catch {
      // Ignorer les erreurs de permission sur certains dossiers
    }
  }

  await scan(dir)
  return files
}

/**
 * Surveiller récursivement un répertoire et ses sous-répertoires.
 * Ajoute les watchers au tableau partagé pour nettoyage ultérieur.
 */
export async function watchDirectoryRecursive(
  dir: string,
  watchedDirs: Set<string>,
  watchers: FSWatcher[],
  onFileEvent: (eventType: string, filepath: string) => void
): Promise<void> {
  if (watchedDirs.has(dir)) return

  try {
    const watcher = watch(dir, { persistent: true }, (eventType, filename) => {
      if (filename) {
        onFileEvent(eventType, path.join(dir, filename))
      }
    })

    watcher.on('error', (error) => {
      console.error(`[WATCHER] Erreur watcher ${dir}:`, error)
    })

    watchers.push(watcher)
    watchedDirs.add(dir)

    // Surveiller les sous-répertoires
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await watchDirectoryRecursive(
          path.join(dir, entry.name),
          watchedDirs,
          watchers,
          onFileEvent
        )
      }
    }
  } catch (error) {
    console.error(`[WATCHER] Erreur surveillance ${dir}:`, error)
  }
}

/**
 * Vérifier si un événement fichier doit être traité.
 * Filtre les non-vidéo, les temporaires, et les déjà connus.
 */
export function isValidFileEvent(filepath: string, knownFiles: Set<string>): boolean {
  const ext = path.extname(filepath).toLowerCase()

  if (!VIDEO_EXTENSIONS.includes(ext)) return false
  if (filepath.includes('.tmp') || filepath.includes('.part') || filepath.includes('.crdownload')) return false
  if (knownFiles.has(filepath)) return false

  return true
}

/**
 * Scanner les dossiers films et séries pour trouver des fichiers non encore connus.
 * Utilisé par le polling de secours (fs.watch ne fonctionne pas sur tous les montages NAS).
 */
export async function findNewFiles(knownFiles: Set<string>): Promise<string[]> {
  const newFiles: string[] = []

  const scanDir = async (dir: string) => {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          await scanDir(fullPath)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (VIDEO_EXTENSIONS.includes(ext) && !knownFiles.has(fullPath)) {
            if (!fullPath.includes('.tmp') && !fullPath.includes('.part') && !fullPath.includes('.crdownload')) {
              newFiles.push(fullPath)
            }
          }
        }
      }
    } catch {
      // Ignorer les erreurs de permission
    }
  }

  await scanDir(MEDIA_DIR)
  try {
    await stat(SERIES_DIR)
    await scanDir(SERIES_DIR)
  } catch {
    // Dossier séries non accessible
  }

  return newFiles
}
