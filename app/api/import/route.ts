/**
 * API Route: Import manuel d'un film
 * Permet d'ajouter un film spécifique par chemin de fichier
 * ou de rechercher sur TMDB et associer à un fichier existant
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

import { supabase } from '@/lib/supabase'
import { getMovieDetails, getTMDBImageUrl, getYearFromDate, searchMovie } from '@/lib/tmdb'
import { sanitizeFilename } from '@/lib/media-recognition/filenameSanitizer'
import { 
  findLocalSubtitles, 
  formatFileSize, 
  detectVideoQuality,
  checkPathAccess
} from '@/lib/localScanner'
import * as fs from 'fs/promises'
import * as path from 'path'

// GET: Recherche TMDB pour prévisualisation
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authErrorResponse(authError, 403)
  
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query')
  const year = searchParams.get('year')

  if (!query) {
    return NextResponse.json({ error: 'Query parameter required' }, { status: 400 })
  }

  try {
    const results = await searchMovie(query, year ? parseInt(year) : undefined)
    
    // Enrichir avec les URLs d'images
    const enrichedResults = (results || []).slice(0, 10).map((movie: any) => ({
      id: movie.id,
      title: movie.title,
      original_title: movie.original_title,
      release_date: movie.release_date,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      poster_url: getTMDBImageUrl(movie.poster_path, 'w185'),
      overview: movie.overview?.slice(0, 200) + (movie.overview?.length > 200 ? '...' : ''),
      vote_average: movie.vote_average
    }))

    return NextResponse.json({ results: enrichedResults })
  } catch (error) {
    console.error('Erreur recherche TMDB:', error)
    return NextResponse.json({ error: 'Erreur lors de la recherche' }, { status: 500 })
  }
}

// POST: Importer un film
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authErrorResponse(authError, 403)
  
  try {
    const body = await request.json()
    const { filepath, tmdbId, mode } = body

    // Mode 1: Import par chemin de fichier (auto-détection TMDB)
    if (mode === 'filepath' && filepath) {
      return await importByFilepath(filepath)
    }

    // Mode 2: Import avec TMDB ID spécifique (forcer une correspondance)
    if (mode === 'tmdb' && filepath && tmdbId) {
      return await importWithTMDB(filepath, tmdbId)
    }

    // Mode 3: Lister les fichiers non importés dans un dossier
    if (mode === 'list-unimported') {
      return await listUnimportedFiles()
    }

    return NextResponse.json(
      { error: 'Mode invalide. Utilisez: filepath, tmdb, ou list-unimported' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Erreur import:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}

// Import par chemin de fichier avec auto-détection
async function importByFilepath(filepath: string) {
  // Valider que le fichier existe
  const filmsPath = process.env.PCLOUD_LOCAL_PATH || '/leon/media/films'
  const fullPath = filepath.startsWith('/') ? filepath : path.join(filmsPath, filepath)
  
  try {
    const stats = await fs.stat(fullPath)
    if (!stats.isFile()) {
      return NextResponse.json({ error: 'Le chemin ne pointe pas vers un fichier' }, { status: 400 })
    }

    // Vérifier si déjà importé
    const { data: existing } = await supabase
      .from('media')
      .select('id, title')
      .eq('pcloud_fileid', fullPath)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: false,
        error: `Ce film est déjà importé: ${existing.title}`,
        existingId: existing.id
      }, { status: 409 })
    }

    // Extraire le nom du fichier
    const filename = path.basename(fullPath)
    const { cleanName, year } = sanitizeFilename(filename)
    
    console.log(`[IMPORT] Import: ${filename}`)
    console.log(`[IMPORT] Nom nettoyé: "${cleanName}"${year ? ` (${year})` : ''}`)

    // Rechercher sur TMDB
    const movieResults = await searchMovie(cleanName, year ?? undefined)
    
    if (!movieResults || movieResults.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Aucun film trouvé sur TMDB',
        searchQuery: cleanName,
        searchYear: year,
        suggestion: 'Utilisez le mode "tmdb" pour forcer une correspondance manuelle'
      }, { status: 404 })
    }

    // Utiliser le meilleur match
    const bestMatch = movieResults[0]
    return await importWithTMDB(fullPath, bestMatch.id, stats.size)

  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: `Fichier non trouvé: ${fullPath}` }, { status: 404 })
    }
    throw error
  }
}

// Import avec TMDB ID spécifique
async function importWithTMDB(filepath: string, tmdbId: number, fileSize?: number) {
  const filmsPath = process.env.PCLOUD_LOCAL_PATH || '/leon/media/films'
  const fullPath = filepath.startsWith('/') ? filepath : path.join(filmsPath, filepath)
  
  // Récupérer les stats du fichier si pas fournies
  let size = fileSize
  if (!size) {
    try {
      const stats = await fs.stat(fullPath)
      size = stats.size
    } catch {
      return NextResponse.json({ error: `Fichier non trouvé: ${fullPath}` }, { status: 404 })
    }
  }

  const filename = path.basename(fullPath)
  const quality = detectVideoQuality(filename, size)

  console.log(`[IMPORT] Récupération détails TMDB ID: ${tmdbId}`)
  const mediaDetails = await getMovieDetails(tmdbId)
  
  if (!mediaDetails) {
    return NextResponse.json({ error: `Film TMDB ID ${tmdbId} non trouvé` }, { status: 404 })
  }

  // Rechercher les sous-titres
  const localSubtitles = await findLocalSubtitles(fullPath)
  const subtitles = localSubtitles.reduce((acc, sub) => {
    const lang = sub.language || 'UNKNOWN'
    acc[lang.toUpperCase()] = {
      filename: sub.filename,
      filepath: sub.filepath,
      isForced: sub.forced || false,
      isSDH: sub.sdh || false
    }
    return acc
  }, {} as Record<string, any>)

  // Préparer les données
  const mediaData = {
    pcloud_fileid: fullPath,
    title: mediaDetails.title,
    original_title: mediaDetails.original_title || null,
    year: mediaDetails.release_date ? getYearFromDate(mediaDetails.release_date) : null,
    duration: mediaDetails.runtime || null,
    formatted_runtime: mediaDetails.runtime 
      ? `${Math.floor(mediaDetails.runtime / 60)}h ${mediaDetails.runtime % 60}min` 
      : null,
    file_size: formatFileSize(size),
    quality,
    tmdb_id: mediaDetails.id,
    poster_url: getTMDBImageUrl(mediaDetails.poster_path, 'w500'),
    backdrop_url: getTMDBImageUrl(mediaDetails.backdrop_path, 'original'),
    overview: mediaDetails.overview || null,
    genres: mediaDetails.genres?.map((g: any) => g.name) || null,
    movie_cast: mediaDetails.credits?.cast || null,
    subtitles: Object.keys(subtitles).length > 0 ? subtitles : null,
    release_date: mediaDetails.release_date || null,
    rating: mediaDetails.vote_average || null,
    vote_count: mediaDetails.vote_count || null,
    tagline: mediaDetails.tagline || null,
    director: mediaDetails.credits?.crew?.find((c: any) => c.job === 'Director') || null,
    trailer_url: mediaDetails.videos?.results?.[0]?.key 
      ? `https://youtube.com/watch?v=${mediaDetails.videos.results[0].key}` 
      : null,
  }

  // Insérer en base
  const { data, error } = await supabase
    .from('media')
    .insert(mediaData)
    .select()
    .single()

  if (error) {
    console.error('Erreur insertion:', error)
    return NextResponse.json({ error: `Erreur base de données: ${error.message}` }, { status: 500 })
  }

  console.log(`[IMPORT] Film importé: ${mediaDetails.title}`)

  // Ajouter automatiquement à la queue de transcodage
  let transcodingQueued = false
  try {
    const transcodingResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/transcode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        filepath: fullPath,
        priority: 'high' // Haute priorité pour les imports manuels
      })
    })
    
    if (transcodingResponse.ok) {
      transcodingQueued = true
      console.log(`[IMPORT] Ajouté à la queue de transcodage: ${filename}`)
    }
  } catch (error) {
    console.warn('⚠️ Impossible d\'ajouter à la queue de transcodage:', error)
  }

  return NextResponse.json({
    success: true,
    message: transcodingQueued 
      ? `Film importé et ajouté à la queue de transcodage`
      : `Film importé avec succès`,
    film: {
      id: data.id,
      title: mediaDetails.title,
      year: mediaData.year,
      poster_url: mediaData.poster_url,
      quality: mediaData.quality,
      subtitles: Object.keys(subtitles),
      transcodingQueued
    }
  })
}

// Lister les fichiers non encore importés
async function listUnimportedFiles() {
  const filmsPath = process.env.PCLOUD_LOCAL_PATH || '/leon/media/films'
  
  const isAccessible = await checkPathAccess(filmsPath)
  if (!isAccessible) {
    return NextResponse.json({ error: `Dossier non accessible: ${filmsPath}` }, { status: 500 })
  }

  // Lire tous les fichiers vidéo
  const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.m4v', '.webm']
  const files = await fs.readdir(filmsPath)
  const videoFiles = files.filter(f => 
    videoExtensions.some(ext => f.toLowerCase().endsWith(ext))
  )

  // Récupérer les fichiers déjà importés
  const { data: importedMedia } = await supabase
    .from('media')
    .select('pcloud_fileid')
  
  const importedPaths = new Set((importedMedia || []).map(m => m.pcloud_fileid))

  // Filtrer les non-importés
  const unimported = videoFiles.filter(f => {
    const fullPath = path.join(filmsPath, f)
    return !importedPaths.has(fullPath)
  }).map(f => ({
    filename: f,
    filepath: path.join(filmsPath, f),
    ...sanitizeFilename(f)
  }))

  return NextResponse.json({
    total: videoFiles.length,
    imported: importedPaths.size,
    unimported: unimported.length,
    files: unimported
  })
}
