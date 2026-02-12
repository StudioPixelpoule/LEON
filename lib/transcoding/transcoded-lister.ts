/**
 * Listing des fichiers transcodés avec gestion de cache
 */

import { readdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { TRANSCODED_DIR } from './types'
import type { TranscodedItem } from './types'

const CACHE_TTL = 120000 // 2 minutes

let transcodedCache: TranscodedItem[] | null = null
let transcodedCacheTime = 0

/** Invalider le cache des transcodés */
export function invalidateTranscodedCache(): void {
  transcodedCache = null
}

/**
 * Lister tous les films/séries transcodés (avec cache)
 */
export async function listTranscoded(): Promise<TranscodedItem[]> {
  const now = Date.now()
  if (transcodedCache && (now - transcodedCacheTime) < CACHE_TTL) {
    return transcodedCache
  }

  const transcoded: TranscodedItem[] = []

  try {
    // Collecter tous les dossiers candidats
    const collectCandidates = async (
      baseDir: string,
      prefix: string = ''
    ): Promise<Array<{ folderPath: string; entryName: string; prefix: string }>> => {
      const candidates: Array<{ folderPath: string; entryName: string; prefix: string }> = []

      if (!existsSync(baseDir)) return candidates

      try {
        const entries = await readdir(baseDir, { withFileTypes: true })

        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          if (entry.name.startsWith('.')) continue
          if (entry.name === 'series' && prefix === '') continue

          const folderPath = path.join(baseDir, entry.name)
          const transcodingPath = path.join(folderPath, '.transcoding')
          const donePath = path.join(folderPath, '.done')

          if (existsSync(transcodingPath)) continue
          if (!existsSync(donePath)) continue

          candidates.push({ folderPath, entryName: entry.name, prefix })
        }
      } catch (err) {
        console.error(`[TRANSCODE] Erreur scan ${baseDir}:`, err)
      }

      return candidates
    }

    // Collecter films et séries en parallèle
    const [filmCandidates, seriesCandidates] = await Promise.all([
      collectCandidates(TRANSCODED_DIR),
      collectCandidates(path.join(TRANSCODED_DIR, 'series'), '📺 ')
    ])

    const allCandidates = [...filmCandidates, ...seriesCandidates]
    console.log(`[TRANSCODE] Scan: ${allCandidates.length} dossiers transcodés trouvés`)

    // Traiter par lots de 50
    const BATCH_SIZE = 50

    const processCandidate = async (candidate: {
      folderPath: string
      entryName: string
      prefix: string
    }): Promise<TranscodedItem | null> => {
      const { folderPath, entryName, prefix } = candidate

      try {
        const donePath = path.join(folderPath, '.done')

        const [doneContent, files] = await Promise.all([
          readFile(donePath, 'utf-8'),
          readdir(folderPath)
        ])

        const transcodedAt = doneContent.trim()
        const segmentCount = files.filter(f => f.endsWith('.ts')).length

        let audioCount = 1
        let subtitleCount = 0

        if (files.includes('audio_info.json')) {
          try {
            const audioInfo = JSON.parse(await readFile(path.join(folderPath, 'audio_info.json'), 'utf-8'))
            audioCount = Array.isArray(audioInfo) ? audioInfo.length : 1
          } catch {
            // Fichier corrompu, valeur par défaut
          }
        }

        if (files.includes('subtitles.json')) {
          try {
            const subsInfo = JSON.parse(await readFile(path.join(folderPath, 'subtitles.json'), 'utf-8'))
            subtitleCount = Array.isArray(subsInfo) ? subsInfo.length : 0
          } catch {
            // Fichier corrompu, valeur par défaut
          }
        }

        return {
          name: prefix + entryName.replace(/_/g, ' '),
          folder: prefix ? `series/${entryName}` : entryName,
          transcodedAt,
          segmentCount,
          isComplete: true,
          hasMultiAudio: audioCount > 1,
          hasSubtitles: subtitleCount > 0,
          audioCount,
          subtitleCount
        }
      } catch {
        return null
      }
    }

    for (let i = 0; i < allCandidates.length; i += BATCH_SIZE) {
      const batch = allCandidates.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(batch.map(processCandidate))
      transcoded.push(...results.filter((r): r is TranscodedItem => r !== null))
    }

    // Trier par date (plus récent en premier)
    transcoded.sort((a, b) => {
      const dateA = new Date(a.transcodedAt).getTime()
      const dateB = new Date(b.transcodedAt).getTime()
      return dateB - dateA
    })

    console.log(`[TRANSCODE] ${transcoded.length} films/séries transcodés listés`)

    transcodedCache = transcoded
    transcodedCacheTime = now

    return transcoded
  } catch (error) {
    console.error('[TRANSCODE] Erreur listage transcodés:', error)
    return []
  }
}
