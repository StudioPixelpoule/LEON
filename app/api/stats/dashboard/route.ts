/**
 * API Route: Dashboard Statistiques Complet
 * GET /api/stats/dashboard - Retourne toutes les stats de la bibliothèque
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const MEDIA_DIR = process.env.MEDIA_DIR || '/leon/media/films'
const TRANSCODED_DIR = process.env.TRANSCODED_DIR || '/leon/transcoded'

// Cache pour éviter les requêtes répétées
let storageCache: { files: number; sizeBytes: number; timestamp: number } | null = null
let transcodedCache: { completed: number; folders: string[]; timestamp: number } | null = null
let dashboardCache: { data: DashboardStats; timestamp: number } | null = null
const CACHE_TTL = 60 * 1000 // 1 minute pour le dashboard
const FS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes pour le filesystem

interface DashboardStats {
  library: {
    totalMovies: number
    totalSeries: number
    totalEpisodes: number
    totalDurationMinutes: number
    averageDurationMinutes: number
  }
  posters: {
    withPosters: number
    withoutPosters: number
    validationRate: number
  }
  storage: {
    mediaFiles: number
    mediaSizeGB: number
    transcodedFiles: number
    transcodedSizeGB: number
    cacheFiles: number
    cacheSizeGB: number
  }
  transcoding: {
    completed: number
    pending: number
    inProgress: boolean
  }
  activity: {
    recentlyAdded: Array<{
      id: string
      title: string
      poster_url: string | null
      created_at: string
    }>
    inProgress: Array<{
      id: string
      title: string
      poster_url: string | null
      progress: number
    }>
    mostWatched: Array<{
      id: string
      title: string
      poster_url: string | null
      watchCount: number
    }>
  }
  genres: Array<{
    name: string
    count: number
  }>
  years: Array<{
    year: number
    count: number
  }>
}

async function getDirectorySize(dirPath: string): Promise<{ files: number; sizeBytes: number }> {
  // Utiliser le cache si disponible et valide
  if (storageCache && Date.now() - storageCache.timestamp < FS_CACHE_TTL) {
    return { files: storageCache.files, sizeBytes: storageCache.sizeBytes }
  }

  let totalSize = 0
  let totalFiles = 0

  if (!existsSync(dirPath)) {
    return { files: 0, sizeBytes: 0 }
  }

  // Scan simplifié : juste le premier niveau pour la vitesse
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        try {
          const fullPath = path.join(dirPath, entry.name)
          const stats = await stat(fullPath)
          totalSize += stats.size
          totalFiles++
        } catch {}
      }
    }
  } catch {}

  // Mettre en cache
  storageCache = { files: totalFiles, sizeBytes: totalSize, timestamp: Date.now() }
  return { files: totalFiles, sizeBytes: totalSize }
}

async function getTranscodedStats(): Promise<{ completed: number; folders: string[] }> {
  // Utiliser le cache si disponible et valide
  if (transcodedCache && Date.now() - transcodedCache.timestamp < FS_CACHE_TTL) {
    return { completed: transcodedCache.completed, folders: transcodedCache.folders }
  }

  const folders: string[] = []
  let completed = 0

  if (!existsSync(TRANSCODED_DIR)) {
    return { completed: 0, folders: [] }
  }

  try {
    const entries = await readdir(TRANSCODED_DIR, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const donePath = path.join(TRANSCODED_DIR, entry.name, '.done')
        if (existsSync(donePath)) {
          completed++
          folders.push(entry.name)
        }
      }
    }
  } catch {}

  // Mettre en cache
  transcodedCache = { completed, folders, timestamp: Date.now() }
  return { completed, folders }
}

export async function GET() {
  try {
    // Utiliser le cache si disponible et valide
    if (dashboardCache && Date.now() - dashboardCache.timestamp < CACHE_TTL) {
      return NextResponse.json(dashboardCache.data)
    }

    // Requêtes Supabase en parallèle
    const [
      moviesResult,
      seriesResult,
      playbackResult,
      favoritesResult
    ] = await Promise.all([
      supabase
        .from('media')
        .select('id, title, poster_url, tmdb_id, year, duration, genres, created_at, media_type')
        .or('media_type.eq.movie,media_type.is.null'), // Films = movie ou pas de type défini
      supabase
        .from('series')
        .select('id, title, poster_url, created_at'),
      supabase
        .from('playback_positions')
        .select('media_id, position, duration, updated_at'),
      supabase
        .from('favorites')
        .select('media_id')
    ])

    const movies = moviesResult.data || []
    const series = seriesResult.data || []
    const playbacks = playbackResult.data || []
    const favorites = favoritesResult.data || []

    // Debug log
    console.log(`[DASHBOARD] Films: ${movies.length}, Séries: ${series.length}, Erreur séries: ${seriesResult.error?.message || 'aucune'}`)

    // Stats bibliothèque
    const totalDuration = movies.reduce((acc, m) => acc + (m.duration || 0), 0)
    const moviesWithDuration = movies.filter(m => m.duration && m.duration > 0)
    const avgDuration = moviesWithDuration.length > 0 
      ? Math.round(totalDuration / moviesWithDuration.length)
      : 0

    // Stats posters
    const withPosters = movies.filter(m => 
      m.poster_url && 
      !m.poster_url.includes('placeholder')
    ).length
    const withoutPosters = movies.length - withPosters

    // Stats stockage (en parallèle)
    const [mediaStats, transcodedStats] = await Promise.all([
      getDirectorySize(MEDIA_DIR),
      getTranscodedStats()
    ])

    // Films récemment ajoutés
    const recentlyAdded = [...movies]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(m => ({
        id: m.id,
        title: m.title,
        poster_url: m.poster_url,
        created_at: m.created_at
      }))

    // Films en cours de visionnage
    const inProgressMap = new Map<string, { position: number; duration: number }>()
    playbacks.forEach(p => {
      if (p.duration && p.position && p.position > 60 && p.position < p.duration * 0.95) {
        const existing = inProgressMap.get(p.media_id)
        if (!existing || p.position > existing.position) {
          inProgressMap.set(p.media_id, { position: p.position, duration: p.duration })
        }
      }
    })

    const inProgress: DashboardStats['activity']['inProgress'] = []
    for (const [mediaId, data] of inProgressMap) {
      const movie = movies.find(m => m.id === mediaId)
      if (movie) {
        inProgress.push({
          id: movie.id,
          title: movie.title,
          poster_url: movie.poster_url,
          progress: Math.round((data.position / data.duration) * 100)
        })
      }
    }

    // Comptage des genres
    const genreCount = new Map<string, number>()
    movies.forEach(m => {
      if (m.genres && Array.isArray(m.genres)) {
        m.genres.forEach((g: string) => {
          genreCount.set(g, (genreCount.get(g) || 0) + 1)
        })
      }
    })
    const genres = Array.from(genreCount.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Distribution par années
    const yearCount = new Map<number, number>()
    movies.forEach(m => {
      if (m.year) {
        yearCount.set(m.year, (yearCount.get(m.year) || 0) + 1)
      }
    })
    const years = Array.from(yearCount.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year - a.year)
      .slice(0, 20)

    // Films les plus favoris (approximation)
    const favoriteCount = new Map<string, number>()
    favorites.forEach(f => {
      favoriteCount.set(f.media_id, (favoriteCount.get(f.media_id) || 0) + 1)
    })
    const mostWatched = Array.from(favoriteCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([mediaId, count]) => {
        const movie = movies.find(m => m.id === mediaId)
        return movie ? {
          id: movie.id,
          title: movie.title,
          poster_url: movie.poster_url,
          watchCount: count
        } : null
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)

    const stats: DashboardStats = {
      library: {
        totalMovies: movies.length,
        totalSeries: series.length,
        totalEpisodes: 0, // À implémenter si nécessaire
        totalDurationMinutes: Math.round(totalDuration / 60),
        averageDurationMinutes: Math.round(avgDuration / 60)
      },
      posters: {
        withPosters,
        withoutPosters,
        validationRate: movies.length > 0 ? Math.round((withPosters / movies.length) * 100) : 100
      },
      storage: {
        mediaFiles: mediaStats.files,
        mediaSizeGB: Math.round(mediaStats.sizeBytes / (1024 * 1024 * 1024) * 10) / 10,
        transcodedFiles: transcodedStats.completed,
        transcodedSizeGB: 0, // Calculé dynamiquement si nécessaire
        cacheFiles: 0,
        cacheSizeGB: 0
      },
      transcoding: {
        completed: transcodedStats.completed,
        pending: 0, // Sera mis à jour par le service
        inProgress: false
      },
      activity: {
        recentlyAdded,
        inProgress: inProgress.slice(0, 5),
        mostWatched
      },
      genres,
      years
    }

    // Mettre en cache
    dashboardCache = { data: stats, timestamp: Date.now() }

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Erreur stats dashboard:', error)
    return NextResponse.json(
      { error: 'Erreur récupération statistiques' },
      { status: 500 }
    )
  }
}
