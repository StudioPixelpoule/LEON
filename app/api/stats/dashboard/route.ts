import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET() {
  try {
    const supabase = createSupabaseClient()
    
    // 1. Statistiques des films
    const { data: movies, error: moviesError } = await supabase
      .from('media')
      .select('id, title, year, vote_average, runtime, file_size, created_at')
      .eq('media_type', 'movie')
    
    if (moviesError) throw moviesError

    // 2. Statistiques de visionnage
    const { data: playbackData, error: playbackError } = await supabase
      .from('playback_positions')
      .select('media_id, position, duration, updated_at')
    
    if (playbackError) throw playbackError

    // 3. Calculs des statistiques
    const totalMovies = movies?.length || 0
    const totalSizeBytes = movies?.reduce((acc, m) => acc + (m.file_size || 0), 0) || 0
    const totalSizeGB = (totalSizeBytes / (1024 ** 3)).toFixed(2)
    const averageRating = movies && movies.length > 0
      ? (movies.reduce((acc, m) => acc + (m.vote_average || 0), 0) / movies.length).toFixed(1)
      : 0
    
    // Films les plus récents
    const recentMovies = movies
      ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map(m => ({
        title: m.title,
        year: m.year,
        addedAt: m.created_at
      })) || []

    // Films les mieux notés
    const topRatedMovies = movies
      ?.filter(m => m.vote_average && m.vote_average > 0)
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
      .slice(0, 5)
      .map(m => ({
        title: m.title,
        year: m.year,
        rating: m.vote_average
      })) || []

    // Films les plus regardés (basé sur les positions de lecture)
    const watchCounts = new Map<string, number>()
    playbackData?.forEach(p => {
      const count = watchCounts.get(p.media_id) || 0
      watchCounts.set(p.media_id, count + 1)
    })
    
    const mostWatched = Array.from(watchCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([mediaId, count]) => {
        const movie = movies?.find(m => m.id === mediaId)
        return movie ? {
          title: movie.title,
          year: movie.year,
          views: count
        } : null
      })
      .filter(Boolean)

    // Distribution par année
    const yearDistribution = new Map<number, number>()
    movies?.forEach(m => {
      if (m.year) {
        const count = yearDistribution.get(m.year) || 0
        yearDistribution.set(m.year, count + 1)
      }
    })
    
    const yearStats = Array.from(yearDistribution.entries())
      .sort((a, b) => b[0] - a[0])
      .slice(0, 10)
      .map(([year, count]) => ({ year, count }))

    // Statistiques du cache
    let cacheStats = {
      sizeGB: 0,
      segments: 0,
      hitRate: 0
    }

    try {
      const cacheDir = path.join(process.cwd(), '.cache', 'hls')
      const files = await fs.readdir(cacheDir)
      const stats = await Promise.all(
        files.map(async (file) => {
          const stat = await fs.stat(path.join(cacheDir, file))
          return stat.size
        })
      )
      
      const totalCacheSize = stats.reduce((acc, size) => acc + size, 0)
      cacheStats = {
        sizeGB: parseFloat((totalCacheSize / (1024 ** 3)).toFixed(2)),
        segments: files.length,
        hitRate: 0 // À calculer basé sur les logs si nécessaire
      }
    } catch (error) {
      // Cache non disponible
    }

    // Activité récente (films ajoutés dans les 7 derniers jours)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentActivity = movies
      ?.filter(m => new Date(m.created_at) > sevenDaysAgo)
      .length || 0

    // Films en cours de visionnage
    const inProgress = playbackData
      ?.filter(p => p.position > 0 && p.duration && p.position < p.duration * 0.95)
      .length || 0

    return NextResponse.json({
      success: true,
      stats: {
        // Vue d'ensemble
        overview: {
          totalMovies,
          totalSizeGB,
          averageRating,
          recentActivity,
          inProgress
        },
        
        // Films récents
        recentMovies,
        
        // Films populaires
        topRatedMovies,
        mostWatched,
        
        // Distribution
        yearStats,
        
        // Cache
        cache: cacheStats,
        
        // Timestamp
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error: any) {
    console.error('[API] Erreur stats dashboard:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    )
  }
}
