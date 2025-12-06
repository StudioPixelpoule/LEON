/**
 * API: Scanner les séries locales (pCloud Drive)
 * POST /api/scan-series
 * 
 * Structure attendue:
 * /leon/media/series/
 *   ├── Breaking Bad/
 *   │   ├── Season 1/
 *   │   │   ├── Breaking Bad S01E01.mkv
 *   │   │   └── Breaking Bad S01E02.mkv
 *   │   └── Season 2/
 *   │       └── Breaking Bad S02E01.mkv
 *   └── Game of Thrones/
 *       └── Season 1/
 *           └── GOT S01E01.mkv
 */

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import fs from 'fs/promises'
import path from 'path'

interface Episode {
  filename: string
  filepath: string
  season: number
  episode: number
  seriesName: string
}

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.m4v']

export async function POST() {
  try {
    const seriesBasePath = process.env.PCLOUD_SERIES_PATH || '/Users/lionelvernay/pCloud Drive/Series'
    
    console.log('🎬 Démarrage du scan des séries...')
    console.log(`📁 Dossier: ${seriesBasePath}`)

    // Vérifier que le dossier existe
    try {
      await fs.access(seriesBasePath)
    } catch {
      return NextResponse.json(
        { error: `Dossier introuvable: ${seriesBasePath}. Vérifiez que pCloud Drive est monté.` },
        { status: 404 }
      )
    }

    // 1. Lister tous les dossiers de séries
    const seriesFolders = await fs.readdir(seriesBasePath, { withFileTypes: true })
    const seriesNames = seriesFolders
      .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
      .map(dirent => dirent.name)

    console.log(`📁 ${seriesNames.length} séries trouvées`)

    const stats = {
      totalSeries: 0,
      totalEpisodes: 0,
      newSeries: 0,
      updatedSeries: 0,
      newEpisodes: 0
    }

    // 2. Scanner chaque série
    for (const seriesName of seriesNames) {
      console.log(`\n📺 Analyse: ${seriesName}`)
      
      const seriesPath = path.join(seriesBasePath, seriesName)
      console.log(`   Chemin: ${seriesPath}`)
      
      // Extraire tous les épisodes
      const episodes = await scanSeriesFolder(seriesPath, seriesName)
      
      console.log(`   ${episodes.length} épisodes détectés`)
      
      if (episodes.length === 0) {
        console.log(`⚠️  Aucun épisode trouvé pour ${seriesName}`)
        continue
      }
      
      // Afficher les 3 premiers épisodes pour debug
      episodes.slice(0, 3).forEach(ep => {
        console.log(`      → S${ep.season}E${ep.episode}: ${ep.filename}`)
      })

      // 3. Rechercher la série sur TMDB
      console.log(`   🔍 Recherche TMDB pour: "${seriesName}"`)
      const tmdbData = await searchSeriesOnTMDB(seriesName)

      if (!tmdbData) {
        console.log(`   ❌ Non trouvé sur TMDB, création sans métadonnées...`)
        
        // Créer quand même une entrée sans métadonnées
        const { data: existingSeries, error: checkError } = await supabase
          .from('series')
          .select('id')
          .eq('title', seriesName)
          .single()
        
        let seriesId: string
        
        if (!existingSeries) {
          const { data: newSeries, error: insertError } = await supabase
            .from('series')
            .insert({
              title: seriesName,
              local_folder_path: seriesPath
            })
            .select('id')
            .single()
          
          if (insertError || !newSeries) {
            console.error(`   ❌ Erreur création série ${seriesName}:`, insertError?.message || 'newSeries est null')
            console.error(`   Détails erreur:`, JSON.stringify(insertError, null, 2))
            continue
          }
          
          console.log(`   ✅ Série créée (ID: ${newSeries.id})`)
          seriesId = newSeries.id
        } else {
          seriesId = existingSeries.id
        }
        
        // Sauvegarder les épisodes
        console.log(`   💾 Sauvegarde de ${episodes.length} épisodes...`)
        for (const ep of episodes) {
          const { data: existingEp } = await supabase
            .from('episodes')
            .select('id')
            .eq('series_id', seriesId)
            .eq('season_number', ep.season)
            .eq('episode_number', ep.episode)
            .single()

          if (!existingEp) {
            const { error: epError } = await supabase.from('episodes').insert({
              series_id: seriesId,
              season_number: ep.season,
              episode_number: ep.episode,
              title: ep.filename,
              filepath: ep.filepath
            })
            
            if (epError) {
              console.error(`   ❌ Erreur épisode S${ep.season}E${ep.episode}:`, epError.message)
            } else {
              stats.newEpisodes++
            }
          }
        }
        
        console.log(`   ✅ ${stats.newEpisodes} nouveaux épisodes sauvegardés`)
        stats.totalSeries++
        stats.totalEpisodes += episodes.length
        continue
      }

      console.log(`   ✅ Trouvé sur TMDB (ID: ${tmdbData.id}) - ${tmdbData.name}`)

      // 4. Sauvegarder la série
      console.log(`   💾 Sauvegarde dans la base...`)
      const { data: existingSeries, error: checkError } = await supabase
        .from('series')
        .select('id')
        .eq('tmdb_id', tmdbData.id)
        .single()

      let seriesId: string

      if (existingSeries) {
        // Mettre à jour
        const { error: updateError } = await supabase
          .from('series')
          .update({
            title: tmdbData.name,
            original_title: tmdbData.original_name,
            overview: tmdbData.overview,
            poster_url: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : null,
            backdrop_url: tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}` : null,
            rating: tmdbData.vote_average,
            first_air_date: tmdbData.first_air_date,
            local_folder_path: seriesPath,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSeries.id)

        if (updateError) {
          console.error(`   ❌ Erreur mise à jour série ${seriesName}:`, updateError.message)
          console.error(`   Détails:`, JSON.stringify(updateError, null, 2))
          continue
        }

        console.log(`   ✅ Série mise à jour (ID: ${existingSeries.id})`)
        seriesId = existingSeries.id
        stats.updatedSeries++
      } else {
        // Créer
        const { data: newSeries, error: insertError } = await supabase
          .from('series')
          .insert({
            tmdb_id: tmdbData.id,
            title: tmdbData.name,
            original_title: tmdbData.original_name,
            overview: tmdbData.overview,
            poster_url: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : null,
            backdrop_url: tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}` : null,
            rating: tmdbData.vote_average,
            first_air_date: tmdbData.first_air_date,
            genres: tmdbData.genres?.map((g: any) => g.name) || [],
            local_folder_path: seriesPath
          })
          .select('id')
          .single()

        if (insertError || !newSeries) {
          console.error(`   ❌ Erreur création série ${seriesName}:`, insertError?.message || 'newSeries est null')
          console.error(`   Détails:`, JSON.stringify(insertError, null, 2))
          continue
        }

        console.log(`   ✅ Série créée (ID: ${newSeries.id})`)
        seriesId = newSeries.id
        stats.newSeries++
      }

      // 5. Sauvegarder les épisodes
      console.log(`   💾 Sauvegarde de ${episodes.length} épisodes...`)
      let episodesSaved = 0
      for (const ep of episodes) {
        const { data: existingEp } = await supabase
          .from('episodes')
          .select('id')
          .eq('series_id', seriesId)
          .eq('season_number', ep.season)
          .eq('episode_number', ep.episode)
          .single()

        if (!existingEp) {
          const { error: epError } = await supabase.from('episodes').insert({
            series_id: seriesId,
            tmdb_series_id: tmdbData.id,
            season_number: ep.season,
            episode_number: ep.episode,
            title: ep.filename,
            filepath: ep.filepath
          })
          
          if (epError) {
            console.error(`   ❌ Erreur épisode S${ep.season}E${ep.episode}:`, epError.message)
          } else {
            stats.newEpisodes++
            episodesSaved++
          }
        }
      }
      
      console.log(`   ✅ ${episodesSaved} nouveaux épisodes sauvegardés`)

      stats.totalSeries++
      stats.totalEpisodes += episodes.length
    }

    console.log('\n📊 RÉSUMÉ DU SCAN SÉRIES')
    console.log(`   Total séries: ${stats.totalSeries}`)
    console.log(`   Nouvelles: ${stats.newSeries}`)
    console.log(`   Mises à jour: ${stats.updatedSeries}`)
    console.log(`   Total épisodes: ${stats.totalEpisodes}`)
    console.log(`   Nouveaux épisodes: ${stats.newEpisodes}`)

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('❌ Erreur scan séries:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    const errorStack = error instanceof Error ? error.stack : ''
    console.error('Stack:', errorStack)
    
    return NextResponse.json(
      { 
        error: 'Erreur lors du scan des séries',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * Scanner récursivement un dossier de série pour trouver tous les épisodes
 * Gère 2 cas :
 * 1. Fichiers directement dans le dossier série (ex: Chernobyl/Chernobyl.S01E01.mkv)
 * 2. Fichiers dans des sous-dossiers (ex: Better Call Saul/Better Call Saul S01/episode.mkv)
 */
async function scanSeriesFolder(seriesPath: string, seriesName: string): Promise<Episode[]> {
  const episodes: Episode[] = []

  async function scanDirectory(dirPath: string, depth: number = 0) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        // Ignorer les fichiers cachés
        if (entry.name.startsWith('.')) continue

        const fullPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
          // Scanner les sous-dossiers (limiter à 2 niveaux de profondeur)
          if (depth < 2) {
            await scanDirectory(fullPath, depth + 1)
          }
        } else {
          // C'est un fichier
          const ext = path.extname(entry.name).toLowerCase()
          if (VIDEO_EXTENSIONS.includes(ext)) {
            // Extraire S01E01 du nom de fichier
            const episodeMatch = entry.name.match(/S(\d+)E(\d+)/i)
            if (episodeMatch) {
              episodes.push({
                filename: entry.name,
                filepath: fullPath,
                season: parseInt(episodeMatch[1]),
                episode: parseInt(episodeMatch[2]),
                seriesName
              })
            }
          }
        }
      }
    } catch (error) {
      console.error(`Erreur lecture dossier ${dirPath}:`, error)
    }
  }

  await scanDirectory(seriesPath, 0)
  
  return episodes.sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season
    return a.episode - b.episode
  })
}

/**
 * Rechercher une série sur TMDB
 */
async function searchSeriesOnTMDB(seriesName: string): Promise<any | null> {
  const TMDB_API_KEY = process.env.TMDB_API_KEY
  if (!TMDB_API_KEY) return null

  try {
    const cleanName = seriesName
      .replace(/\(\d{4}\)/g, '') // Enlever l'année
      .replace(/[._-]/g, ' ')
      .trim()

    const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanName)}&language=fr-FR`
    const response = await fetch(searchUrl)
    const data = await response.json()

    if (data.results && data.results.length > 0) {
      return data.results[0]
    }

    return null
  } catch (error) {
    console.error('Erreur recherche TMDB:', error)
    return null
  }
}

