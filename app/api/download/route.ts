/**
 * API Route: Génération de lien de téléchargement pCloud
 * Retourne un lien temporaire pour télécharger le fichier
 */

import { NextRequest, NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { getDownloadLink } from '@/lib/pcloud'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mediaId, includeSubtitles } = body
    
    if (!mediaId) {
      return NextResponse.json(
        { error: 'mediaId requis' },
        { status: 400 }
      )
    }
    
    // Récupérer le média depuis Supabase
    const { data: media, error } = await supabase
      .from('media')
      .select('*')
      .eq('id', mediaId)
      .single()
    
    if (error || !media) {
      return NextResponse.json(
        { error: 'Média introuvable' },
        { status: 404 }
      )
    }
    
    // Générer le lien de téléchargement pCloud
    const downloadUrl = await getDownloadLink(media.pcloud_fileid)
    
    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'Impossible de générer le lien de téléchargement' },
        { status: 500 }
      )
    }
    
    // Liens des sous-titres si demandés
    let subtitleLinks: Record<string, string> = {}
    
    if (includeSubtitles && media.subtitles) {
      for (const [lang, subtitle] of Object.entries(media.subtitles)) {
        const subLink = await getDownloadLink((subtitle as any).fileid)
        if (subLink) {
          subtitleLinks[lang] = subLink
        }
      }
    }
    
    // TODO Phase 2: Enregistrer dans la table downloads pour historique
    
    return NextResponse.json({
      success: true,
      downloadUrl,
      subtitles: Object.keys(subtitleLinks).length > 0 ? subtitleLinks : null,
      media: {
        id: media.id,
        title: media.title,
        fileSize: media.file_size
      }
    })
    
  } catch (error) {
    console.error('Erreur download:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}




