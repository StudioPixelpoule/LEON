/**
 * API Route: Nettoyer les médias dont le fichier n'existe plus
 * POST /api/admin/cleanup-missing
 * 
 * Vérifie que chaque fichier référencé dans la base existe sur le disque
 * et supprime les entrées orphelines
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'

// Forcer le rendu dynamique
export const dynamic = 'force-dynamic'

// Client Supabase avec service role pour contourner RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface CleanupResult {
  checked: number
  missing: number
  deleted: number
  errors: number
  details: {
    title: string
    file_path: string
    status: 'deleted' | 'error'
    error?: string
  }[]
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    // Option pour simuler sans supprimer (dry run)
    const { searchParams } = new URL(request.url)
    const dryRun = searchParams.get('dryRun') === 'true'
    
    console.log(`🧹 Début du nettoyage des médias manquants ${dryRun ? '(simulation)' : ''}`)
    
    // Récupérer tous les médias (films et séries/épisodes)
    const { data: allMedia, error: fetchError } = await supabaseAdmin
      .from('media')
      .select('id, title, file_path, media_type')
      .order('title')
    
    if (fetchError) {
      console.error('❌ Erreur récupération médias:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    
    if (!allMedia || allMedia.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun média dans la base de données',
        result: { checked: 0, missing: 0, deleted: 0, errors: 0, details: [] }
      })
    }
    
    console.log(`📊 ${allMedia.length} médias à vérifier`)
    
    const result: CleanupResult = {
      checked: allMedia.length,
      missing: 0,
      deleted: 0,
      errors: 0,
      details: []
    }
    
    // Vérifier chaque fichier
    for (const media of allMedia) {
      if (!media.file_path) continue
      
      const exists = await fileExists(media.file_path)
      
      if (!exists) {
        result.missing++
        console.log(`❌ Fichier manquant: ${media.title} (${media.file_path})`)
        
        if (!dryRun) {
          // Supprimer de la base de données
          const { error: deleteError } = await supabaseAdmin
            .from('media')
            .delete()
            .eq('id', media.id)
          
          if (deleteError) {
            result.errors++
            result.details.push({
              title: media.title,
              file_path: media.file_path,
              status: 'error',
              error: deleteError.message
            })
            console.error(`❌ Erreur suppression ${media.title}:`, deleteError)
          } else {
            result.deleted++
            result.details.push({
              title: media.title,
              file_path: media.file_path,
              status: 'deleted'
            })
            console.log(`🗑️ Supprimé: ${media.title}`)
          }
        } else {
          // Mode simulation
          result.details.push({
            title: media.title,
            file_path: media.file_path,
            status: 'deleted'
          })
        }
      }
    }
    
    console.log(`✅ Nettoyage terminé: ${result.missing} manquants, ${result.deleted} supprimés`)
    
    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun 
        ? `Simulation: ${result.missing} médias seraient supprimés`
        : `${result.deleted} médias orphelins supprimés`,
      result
    })
    
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}

// GET pour avoir un aperçu sans supprimer
export async function GET() {
  // Rediriger vers POST avec dryRun=true
  const response = await POST(new Request('http://localhost/api/admin/cleanup-missing?dryRun=true'))
  return response
}

