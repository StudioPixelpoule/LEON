/**
 * API: Arrêter l'optimisation en cours
 * POST /api/admin/optimize/stop
 * 
 * Demande l'arrêt du worker d'optimisation
 * Les processus en cours se terminent, mais aucun nouveau ne démarre
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST() {
  try {
    console.log('🛑 Arrêt de l\'optimisation demandé')
    
    // Mettre à jour tous les films "processing" à "pending"
    // (ils seront repris au prochain démarrage)
    const { error } = await supabase
      .from('media_optimization')
      .update({
        status: 'pending',
        progress_percent: 0,
        current_progress_time: null,
        speed: null,
        estimated_time_remaining: null
      })
      .eq('status', 'processing')
    
    if (error) {
      console.error('Erreur mise à jour statuts:', error)
    }
    
    // Tuer tous les processus FFmpeg en cours
    // (brutal mais efficace)
    try {
      await execAsync('pkill -TERM ffmpeg')
      console.log('✅ Processus FFmpeg arrêtés')
    } catch (err) {
      // Ignorer l'erreur si aucun processus FFmpeg
      console.log('Aucun processus FFmpeg à arrêter')
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Optimisation arrêtée' 
    })
    
  } catch (error) {
    console.error('Erreur arrêt optimisation:', error)
    return NextResponse.json({ 
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

