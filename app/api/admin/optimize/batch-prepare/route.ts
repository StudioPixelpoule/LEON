/**
 * API: Préparer un batch de films en local
 * POST /api/admin/optimize/batch-prepare
 * 
 * Copie N films de pCloud vers /tmp/ pour encodage rapide
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { promises as fs } from 'fs'
import path from 'path'

const BATCH_DIR = '/tmp/leon_batch'

export async function POST(request: Request) {
  try {
    const { mediaIds, batchSize = 10 } = await request.json().catch(() => ({}))
    
    // Créer le dossier batch s'il n'existe pas
    await fs.mkdir(BATCH_DIR, { recursive: true })
    await fs.mkdir(`${BATCH_DIR}/sources`, { recursive: true })
    await fs.mkdir(`${BATCH_DIR}/outputs`, { recursive: true })
    
    let optimizations
    
    if (mediaIds && Array.isArray(mediaIds) && mediaIds.length > 0) {
      // Récupérer les films spécifiques sélectionnés
      console.log(`📦 Préparation de ${mediaIds.length} films sélectionnés...`)
      const { data, error } = await supabase
        .from('media_optimization')
        .select(`
          *,
          media!inner(
            id,
            title,
            pcloud_fileid
          )
        `)
        .in('media_id', mediaIds)
      
      if (error) throw error
      optimizations = data
    } else {
      // Récupérer les N premiers films à optimiser
      console.log(`📦 Préparation d'un batch de ${batchSize} films...`)
      const { data, error } = await supabase
        .from('media_optimization')
        .select(`
          *,
          media!inner(
            id,
            title,
            pcloud_fileid
          )
        `)
        .eq('status', 'pending')
        .eq('needs_optimization', true)
        .order('created_at', { ascending: true })
        .limit(batchSize)
      
      if (error) throw error
      optimizations = data
    }
    
    if (!optimizations || optimizations.length === 0) {
      return NextResponse.json({ 
        error: 'Aucun film à préparer',
        count: 0 
      })
    }
    
    console.log(`🎬 ${optimizations.length} films sélectionnés`)
    
    const results = {
      prepared: 0,
      errors: 0,
      films: [] as any[]
    }
    
    // Copier chaque film en local
    for (const opt of optimizations) {
      const originalPath = opt.original_filepath.normalize('NFD')
      const filename = path.basename(originalPath)
      const localPath = path.join(`${BATCH_DIR}/sources`, filename)
      
      try {
        console.log(`📥 Copie: ${opt.media.title}...`)
        
        // Vérifier si déjà copié
        try {
          await fs.access(localPath)
          console.log(`   ✓ Déjà en local`)
        } catch {
          // Copier
          await fs.copyFile(originalPath, localPath)
          console.log(`   ✅ Copié`)
        }
        
        // Marquer comme "batch_ready"
        await supabase.from('media_optimization').update({
          status: 'batch_ready',
          error_message: null
        }).eq('id', opt.id)
        
        results.prepared++
        results.films.push({
          id: opt.media_id,
          title: opt.media.title,
          localPath: localPath
        })
        
      } catch (err) {
        console.error(`❌ Erreur copie ${opt.media.title}:`, err)
        results.errors++
      }
    }
    
    console.log(`✅ Batch préparé: ${results.prepared} films`)
    
    return NextResponse.json({
      success: true,
      ...results,
      batchDir: BATCH_DIR
    })
    
  } catch (error) {
    console.error('Erreur batch-prepare:', error)
    return NextResponse.json({ 
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

