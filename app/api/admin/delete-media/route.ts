/**
 * API Route: Supprimer un média (film ou série)
 * DELETE /api/admin/delete-media?id=xxx&type=movie|series&deleteSource=true
 * 
 * Supprime:
 * - L'entrée dans la table media/series
 * - Les épisodes associés (pour les séries)
 * - Les favoris associés
 * - Les positions de lecture associées
 * - Les fichiers transcodés (optionnel)
 * - Les fichiers sources sur le NAS (optionnel, avec deleteSource=true)
 * 
 * ⚠️ Route admin - Authentification requise
 * ⚠️ La suppression des fichiers sources est IRRÉVERSIBLE
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { rm, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const TRANSCODED_DIR = process.env.TRANSCODED_DIR || '/leon/transcoded'

// Client Supabase avec service role pour contourner RLS
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface DeleteResult {
  success: boolean
  deleted: {
    media: boolean
    episodes?: number
    favorites: number
    playbackPositions: number
    transcodedFiles: boolean
    sourceFiles: number
  }
  errors: string[]
}

export async function DELETE(request: NextRequest) {
  // Vérification admin OBLIGATOIRE
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

  try {
    const { searchParams } = new URL(request.url)
    const mediaId = searchParams.get('id')
    const mediaType = searchParams.get('type') || 'movie' // movie ou series
    const deleteTranscoded = searchParams.get('deleteTranscoded') !== 'false' // true par défaut
    const deleteSource = searchParams.get('deleteSource') === 'true' // false par défaut (DANGER)

    if (!mediaId) {
      return NextResponse.json({ error: 'ID du média requis' }, { status: 400 })
    }

    console.log(`[DELETE-MEDIA] 🗑️ Suppression ${mediaType} ID: ${mediaId} par ${user.email}${deleteSource ? ' (AVEC fichiers sources)' : ''}`)

    const supabase = getSupabaseAdmin()
    const result: DeleteResult = {
      success: false,
      deleted: {
        media: false,
        favorites: 0,
        playbackPositions: 0,
        transcodedFiles: false,
        sourceFiles: 0
      },
      errors: []
    }

    // Récupérer les infos du média pour le transcodage
    let mediaInfo: { title: string; filepath?: string } | null = null
    
    if (mediaType === 'series') {
      // Récupérer la série
      const { data: series } = await supabase
        .from('series')
        .select('id, title')
        .eq('id', mediaId)
        .single()
      
      if (series) {
        mediaInfo = { title: series.title }
        
        // Récupérer les épisodes pour supprimer leurs transcodages et fichiers sources
        const { data: episodes } = await supabase
          .from('episodes')
          .select('id, title, filepath')
          .eq('series_id', mediaId)

        if (episodes && episodes.length > 0) {
          // Supprimer les positions de lecture des épisodes
          const episodeIds = episodes.map(e => e.id)
          const { data: deletedPos } = await supabase
            .from('playback_positions')
            .delete()
            .in('media_id', episodeIds)
            .select()
          result.deleted.playbackPositions = deletedPos?.length || 0

          // Supprimer les favoris des épisodes
          const { data: deletedFav } = await supabase
            .from('favorites')
            .delete()
            .in('media_id', episodeIds)
            .select()
          result.deleted.favorites = deletedFav?.length || 0

          // Supprimer les transcodages et fichiers sources des épisodes
          for (const ep of episodes) {
            if (ep.filepath) {
              // Transcodage
              if (deleteTranscoded) {
                const deleted = await deleteTranscodedFiles(ep.filepath, 'series')
                if (deleted) result.deleted.transcodedFiles = true
              }
              // Fichier source (DANGER)
              if (deleteSource) {
                const deleted = await deleteSourceFile(ep.filepath)
                if (deleted) result.deleted.sourceFiles++
              }
            }
          }

          // Supprimer les épisodes
          const { error: epError } = await supabase
            .from('episodes')
            .delete()
            .eq('series_id', mediaId)
          
          if (epError) {
            result.errors.push(`Erreur suppression épisodes: ${epError.message}`)
          } else {
            result.deleted.episodes = episodes.length
          }
        }

        // Supprimer les favoris de la série elle-même
        const { data: deletedSeriesFav } = await supabase
          .from('favorites')
          .delete()
          .eq('media_id', mediaId)
          .select()
        result.deleted.favorites += deletedSeriesFav?.length || 0

        // Supprimer la série
        const { error: seriesError } = await supabase
          .from('series')
          .delete()
          .eq('id', mediaId)
        
        if (seriesError) {
          result.errors.push(`Erreur suppression série: ${seriesError.message}`)
        } else {
          result.deleted.media = true
        }
      }
    } else {
      // Film
      const { data: media } = await supabase
        .from('media')
        .select('id, title, pcloud_fileid')
        .eq('id', mediaId)
        .single()
      
      if (media) {
        mediaInfo = { title: media.title, filepath: media.pcloud_fileid }

        // Supprimer les positions de lecture
        const { data: deletedMoviePos } = await supabase
          .from('playback_positions')
          .delete()
          .eq('media_id', mediaId)
          .select()
        result.deleted.playbackPositions = deletedMoviePos?.length || 0

        // Supprimer les favoris
        const { data: deletedMovieFav } = await supabase
          .from('favorites')
          .delete()
          .eq('media_id', mediaId)
          .select()
        result.deleted.favorites = deletedMovieFav?.length || 0

        // Supprimer les transcodages
        if (deleteTranscoded && media.pcloud_fileid) {
          const deleted = await deleteTranscodedFiles(media.pcloud_fileid, 'movie')
          result.deleted.transcodedFiles = deleted
        }

        // Supprimer le fichier source (DANGER)
        if (deleteSource && media.pcloud_fileid) {
          const deleted = await deleteSourceFile(media.pcloud_fileid)
          if (deleted) result.deleted.sourceFiles = 1
        }

        // Supprimer le média
        const { error: mediaError } = await supabase
          .from('media')
          .delete()
          .eq('id', mediaId)
        
        if (mediaError) {
          result.errors.push(`Erreur suppression média: ${mediaError.message}`)
        } else {
          result.deleted.media = true
        }
      }
    }

    result.success = result.deleted.media && result.errors.length === 0

    console.log(`[DELETE-MEDIA] ${result.success ? '✅' : '⚠️'} Résultat:`, result)

    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? `"${mediaInfo?.title}" supprimé avec succès${result.deleted.sourceFiles > 0 ? ` (${result.deleted.sourceFiles} fichier(s) source supprimé(s))` : ''}`
        : `Suppression partielle de "${mediaInfo?.title}"`,
      result
    })

  } catch (error) {
    console.error('[DELETE-MEDIA] ❌ Erreur:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}

/**
 * Supprimer les fichiers transcodés d'un média
 */
async function deleteTranscodedFiles(filepath: string, type: 'movie' | 'series'): Promise<boolean> {
  try {
    const filename = path.basename(filepath, path.extname(filepath))
    const safeName = filename.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s\-_.()[\]]/gi, '_')
    
    // Vérifier dans le bon dossier selon le type
    const transcodedDir = type === 'series' 
      ? path.join(TRANSCODED_DIR, 'series', safeName)
      : path.join(TRANSCODED_DIR, safeName)
    
    if (existsSync(transcodedDir)) {
      await rm(transcodedDir, { recursive: true, force: true })
      console.log(`[DELETE-MEDIA] 🗑️ Transcodage supprimé: ${transcodedDir}`)
      return true
    }
    
    return false
  } catch (error) {
    console.error('[DELETE-MEDIA] ⚠️ Erreur suppression transcodage:', error)
    return false
  }
}

/**
 * Supprimer le fichier source sur le NAS
 * ⚠️ DANGER - Opération irréversible
 */
async function deleteSourceFile(filepath: string): Promise<boolean> {
  try {
    if (!filepath || !existsSync(filepath)) {
      console.log(`[DELETE-MEDIA] ⚠️ Fichier source introuvable: ${filepath}`)
      return false
    }
    
    await unlink(filepath)
    console.log(`[DELETE-MEDIA] 🗑️ Fichier source supprimé: ${filepath}`)
    return true
  } catch (error) {
    console.error('[DELETE-MEDIA] ⚠️ Erreur suppression fichier source:', error)
    return false
  }
}

/**
 * GET: Prévisualiser ce qui serait supprimé
 */
export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

  try {
    const { searchParams } = new URL(request.url)
    const mediaId = searchParams.get('id')
    const mediaType = searchParams.get('type') || 'movie'

    if (!mediaId) {
      return NextResponse.json({ error: 'ID du média requis' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const preview: {
      media: any
      episodes?: number
      favorites: number
      playbackPositions: number
      hasTranscoded: boolean
      hasSourceFiles: boolean
      sourceFilesCount: number
      filepath?: string
    } = {
      media: null,
      favorites: 0,
      playbackPositions: 0,
      hasTranscoded: false,
      hasSourceFiles: false,
      sourceFilesCount: 0
    }

    if (mediaType === 'series') {
      const { data: series } = await supabase
        .from('series')
        .select('id, title, poster_url')
        .eq('id', mediaId)
        .single()
      
      preview.media = series

      if (series) {
        // Compter les épisodes et vérifier leurs fichiers
        const { data: episodes } = await supabase
          .from('episodes')
          .select('id, filepath')
          .eq('series_id', mediaId)
        
        preview.episodes = episodes?.length || 0

        if (episodes) {
          const episodeIds = episodes.map(e => e.id)
          
          const { count: posCount } = await supabase
            .from('playback_positions')
            .select('*', { count: 'exact', head: true })
            .in('media_id', [...episodeIds, mediaId])
          preview.playbackPositions = posCount || 0

          const { count: favCount } = await supabase
            .from('favorites')
            .select('*', { count: 'exact', head: true })
            .in('media_id', [...episodeIds, mediaId])
          preview.favorites = favCount || 0

          // Vérifier les fichiers sources des épisodes
          let sourceCount = 0
          for (const ep of episodes) {
            if (ep.filepath && existsSync(ep.filepath)) {
              sourceCount++
            }
          }
          preview.sourceFilesCount = sourceCount
          preview.hasSourceFiles = sourceCount > 0
        }
      }
    } else {
      const { data: media } = await supabase
        .from('media')
        .select('id, title, poster_url, pcloud_fileid')
        .eq('id', mediaId)
        .single()
      
      preview.media = media

      if (media) {
        const { count: posCount } = await supabase
          .from('playback_positions')
          .select('*', { count: 'exact', head: true })
          .eq('media_id', mediaId)
        preview.playbackPositions = posCount || 0

        const { count: favCount } = await supabase
          .from('favorites')
          .select('*', { count: 'exact', head: true })
          .eq('media_id', mediaId)
        preview.favorites = favCount || 0

        // Vérifier si transcodé
        if (media.pcloud_fileid) {
          preview.filepath = media.pcloud_fileid
          const filename = path.basename(media.pcloud_fileid, path.extname(media.pcloud_fileid))
          const safeName = filename.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s\-_.()[\]]/gi, '_')
          preview.hasTranscoded = existsSync(path.join(TRANSCODED_DIR, safeName))
          
          // Vérifier si fichier source existe
          preview.hasSourceFiles = existsSync(media.pcloud_fileid)
          preview.sourceFilesCount = preview.hasSourceFiles ? 1 : 0
        }
      }
    }

    return NextResponse.json({
      success: true,
      preview
    })

  } catch (error) {
    console.error('[DELETE-MEDIA] ❌ Erreur preview:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}
