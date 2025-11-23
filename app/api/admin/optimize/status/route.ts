/**
 * API: Récupérer l'état de l'optimisation de tous les films
 * GET /api/admin/optimize/status
 * 
 * Retourne les statistiques globales et la liste de tous les films avec leur statut
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Récupérer toutes les optimisations avec les infos des films
    const { data: optimizations, error } = await supabase
      .from('media_optimization')
      .select(`
        *,
        media!inner(
          id,
          title,
          poster_url
        )
      `)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Erreur récupération statuts:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    // Calculer les statistiques
    const stats = {
      total: optimizations?.length || 0,
      needsOptimization: 0,
      alreadyOptimized: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      totalSpaceSaved: 0,
      totalOriginalSize: 0,
      totalOptimizedSize: 0
    }

    const movies = (optimizations || []).map((opt: any) => {
      // Mettre à jour les stats
      if (opt.status === 'processing') stats.processing++
      if (opt.status === 'completed') stats.completed++
      if (opt.status === 'failed') stats.failed++
      if (opt.status === 'pending' && opt.needs_optimization) stats.needsOptimization++
      if (opt.status === 'skipped' || !opt.needs_optimization) stats.alreadyOptimized++
      
      if (opt.space_saved_bytes) stats.totalSpaceSaved += opt.space_saved_bytes
      if (opt.original_size_bytes) stats.totalOriginalSize += opt.original_size_bytes
      if (opt.optimized_size_bytes) stats.totalOptimizedSize += opt.optimized_size_bytes

      return {
        id: opt.id,
        mediaId: opt.media_id,
        title: opt.media.title,
        posterUrl: opt.media.poster_url,
        status: opt.status,
        needsOptimization: opt.needs_optimization,
        progressPercent: opt.progress_percent || 0,
        originalSize: opt.original_size_bytes || 0,
        optimizedSize: opt.optimized_size_bytes,
        spaceSaved: opt.space_saved_bytes,
        spaceSavedPercent: opt.space_saved_percent,
        speed: opt.speed,
        estimatedTimeRemaining: opt.estimated_time_remaining,
        originalCodec: opt.original_codec,
        originalAudioCodec: opt.original_audio_codec,
        originalResolution: opt.original_resolution,
        audioTracks: opt.audio_tracks,
        subtitleTracks: opt.subtitle_tracks,
        audioTracksCount: opt.audio_tracks_count || 0,
        subtitleTracksCount: opt.subtitle_tracks_count || 0,
        errorMessage: opt.error_message,
        startedAt: opt.started_at,
        completedAt: opt.completed_at
      }
    })

    return NextResponse.json({
      stats,
      movies
    })
    
  } catch (error) {
    console.error('Erreur status global:', error)
    return NextResponse.json({ 
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

