/**
 * API Route: Nettoyer les médias dont le fichier n'existe plus
 * POST /api/admin/cleanup-missing
 * 
 * Vérifie que chaque fichier référencé dans la base existe sur le disque
 * et supprime les entrées orphelines
 * 
 * ⚠️ Route admin - Authentification requise
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'

// Forcer le rendu dynamique
export const dynamic = 'force-dynamic'

// Taille des lots pour parallélisation
const BATCH_SIZE = 50

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
    filepath: string
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

export async function POST(request: NextRequest) {
  // Vérification admin OBLIGATOIRE
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    console.warn('[CLEANUP] Tentative non autorisée')
    return authErrorResponse(authError || 'Accès refusé', 403)
  }
  
  try {
    // Option pour simuler sans supprimer (dry run)
    const { searchParams } = new URL(request.url)
    const dryRun = searchParams.get('dryRun') === 'true'
    
    console.log(`[CLEANUP] 🧹 Démarré par admin: ${user.email} ${dryRun ? '(simulation)' : ''}`)
    
    // Récupérer tous les médias (films)
    // Note: pcloud_fileid contient le chemin du fichier (héritage de l'ancien système pCloud)
    const { data: allMedia, error: fetchError } = await supabaseAdmin
      .from('media')
      .select('id, title, pcloud_fileid')
      .order('title')
    
    if (fetchError) {
      console.error('[CLEANUP] ❌ Erreur récupération médias:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    
    if (!allMedia || allMedia.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun média dans la base de données',
        result: { checked: 0, missing: 0, deleted: 0, errors: 0, details: [] }
      })
    }
    
    console.log(`[CLEANUP] 📊 ${allMedia.length} médias à vérifier`)
    
    const result: CleanupResult = {
      checked: allMedia.length,
      missing: 0,
      deleted: 0,
      errors: 0,
      details: []
    }
    
    // Filtrer les médias avec un chemin de fichier
    const mediaWithPath = allMedia.filter(m => m.pcloud_fileid)
    
    // 🚀 OPTIMISATION: Vérifier les fichiers par lots en parallèle
    const missingMedia: typeof mediaWithPath = []
    
    for (let i = 0; i < mediaWithPath.length; i += BATCH_SIZE) {
      const batch = mediaWithPath.slice(i, i + BATCH_SIZE)
      
      // Vérifier tous les fichiers du lot en parallèle
      const existsResults = await Promise.all(
        batch.map(async (media) => ({
          media,
          exists: await fileExists(media.pcloud_fileid)
        }))
      )
      
      // Collecter les fichiers manquants
      for (const { media, exists } of existsResults) {
        if (!exists) {
          missingMedia.push(media)
        }
      }
      
      // Log de progression
      if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= mediaWithPath.length) {
        console.log(`[CLEANUP] 📊 Vérifié ${Math.min(i + BATCH_SIZE, mediaWithPath.length)}/${mediaWithPath.length} fichiers`)
      }
    }
    
    result.missing = missingMedia.length
    console.log(`[CLEANUP] ❌ ${missingMedia.length} fichiers manquants trouvés`)
    
    // Traiter les fichiers manquants
    if (missingMedia.length > 0) {
      if (dryRun) {
        // Mode simulation : juste lister
        for (const media of missingMedia) {
          result.details.push({
            title: media.title,
            filepath: media.pcloud_fileid,
            status: 'deleted'
          })
        }
      } else {
        // Mode réel : supprimer par lots
        for (let i = 0; i < missingMedia.length; i += BATCH_SIZE) {
          const batch = missingMedia.slice(i, i + BATCH_SIZE)
          const ids = batch.map(m => m.id)
          
          const { error: deleteError } = await supabaseAdmin
            .from('media')
            .delete()
            .in('id', ids)
          
          if (deleteError) {
            result.errors += batch.length
            for (const media of batch) {
              result.details.push({
                title: media.title,
                filepath: media.pcloud_fileid,
                status: 'error',
                error: deleteError.message
              })
            }
            console.error(`[CLEANUP] ❌ Erreur suppression batch:`, deleteError)
          } else {
            result.deleted += batch.length
            for (const media of batch) {
              result.details.push({
                title: media.title,
                filepath: media.pcloud_fileid,
                status: 'deleted'
              })
            }
            console.log(`[CLEANUP] 🗑️ Supprimé ${batch.length} médias`)
          }
        }
      }
    }
    
    console.log(`[CLEANUP] ✅ Terminé: ${result.missing} manquants, ${result.deleted} supprimés`)
    
    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun 
        ? `Simulation: ${result.missing} médias seraient supprimés`
        : `${result.deleted} médias orphelins supprimés`,
      result
    })
    
  } catch (error) {
    console.error('[CLEANUP] ❌ Erreur:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}

// GET pour avoir un aperçu sans supprimer
export async function GET(request: NextRequest) {
  // Créer une nouvelle requête avec dryRun=true
  const url = new URL(request.url)
  url.searchParams.set('dryRun', 'true')
  const dryRunRequest = new NextRequest(url, {
    headers: request.headers
  })
  return POST(dryRunRequest)
}

