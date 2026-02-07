/**
 * API: Télécharger automatiquement les sous-titres depuis OpenSubtitles
 * POST /api/subtitles/download
 * Body: { filename: string, outputPath: string }
 */

import { NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import OpenSubtitlesApi from 'opensubtitles-api'
import { promises as fs } from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Configuration OpenSubtitles (API gratuite)
const opensubtitles = new OpenSubtitlesApi({
  useragent: 'Leon v1.0',
  ssl: true
})

export async function POST(request: Request) {
  try {
    const { filename, outputPath } = await request.json()
    
    if (!filename || !outputPath) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    console.log(`[SUBTITLES] Recherche sous-titres pour: ${filename}`)

    // Extraire le titre et l'année du nom de fichier
    const cleanName = path.basename(filename, path.extname(filename))
    const yearMatch = cleanName.match(/\((\d{4})\)/)
    const year = yearMatch ? yearMatch[1] : undefined
    const title = cleanName.replace(/\(\d{4}\)/, '').trim()

    console.log(`[SUBTITLES]   Titre: ${title}${year ? ` (${year})` : ''}`)

    // Rechercher les sous-titres (FR en priorité)
    const subtitles = await opensubtitles.search({
      sublanguageid: 'fre,eng',
      query: title,
      season: undefined,
      episode: undefined,
      limit: 5,
      gzip: true
    })

    if (!subtitles || Object.keys(subtitles).length === 0) {
      console.log('[SUBTITLES]   Aucun sous-titre trouvé')
      return NextResponse.json({ 
        success: false, 
        message: 'Aucun sous-titre trouvé',
        downloaded: []
      })
    }

    const downloaded = []
    const outputDir = path.dirname(outputPath)
    const baseFilename = path.basename(outputPath, path.extname(outputPath))

    // Télécharger les sous-titres FR et EN
    for (const lang of ['fr', 'en']) {
      const langSubsRaw = subtitles[lang]
      if (!langSubsRaw) continue
      
      // Normaliser en tableau
      const langSubs = Array.isArray(langSubsRaw) ? langSubsRaw : [langSubsRaw]
      if (langSubs.length === 0) continue

      // Prendre le meilleur sous-titre (premier résultat)
      const bestSub = langSubs[0]
      const subtitleUrl = bestSub.url

      if (!subtitleUrl) continue

      try {
        // Télécharger le fichier SRT
        const response = await fetch(subtitleUrl)
        const srtContent = await response.text()

        // Sauvegarder le fichier SRT
        const srtPath = path.join(outputDir, `${baseFilename}.${lang}.srt`)
        await fs.writeFile(srtPath, srtContent, 'utf-8')

        console.log(`[SUBTITLES]   ST ${lang.toUpperCase()} téléchargé: ${srtPath}`)
        
        downloaded.push({
          language: lang,
          path: srtPath,
          filename: `${baseFilename}.${lang}.srt`
        })
      } catch (err) {
        console.error(`   ❌ Erreur téléchargement ST ${lang}:`, err)
      }
    }

    if (downloaded.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Échec téléchargement',
        downloaded: []
      })
    }

    console.log(`[SUBTITLES]   ${downloaded.length} sous-titres téléchargés`)

    return NextResponse.json({ 
      success: true, 
      message: `${downloaded.length} sous-titres téléchargés`,
      downloaded
    })

  } catch (error) {
    console.error('Erreur téléchargement sous-titres:', error)
    return NextResponse.json({ 
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue',
      downloaded: []
    }, { status: 500 })
  }
}




