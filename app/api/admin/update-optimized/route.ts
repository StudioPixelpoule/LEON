/**
 * API Route: Mise à jour automatique de la base de données après remplacement des fichiers optimisés
 * POST /api/admin/update-optimized
 * 
 * Met à jour les chemins dans la base de données pour les fichiers qui ont été remplacés
 * par leurs versions optimisées (ex: .mkv → .mp4)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { stat, readdir } from 'fs/promises'
import path from 'path'

const PCLOUD_FILMS_DIR = process.env.PCLOUD_LOCAL_PATH || '/Users/lionelvernay/pCloud Drive/films'
const OPTIMIZED_DIR = '/Users/lionelvernay/Desktop/temp/optimized'

export async function POST(request: NextRequest) {
  try {
    // 1. Lister tous les fichiers optimisés
    const optimizedFiles = await readdir(OPTIMIZED_DIR)
    const mp4Files = optimizedFiles.filter(f => f.toLowerCase().endsWith('.mp4'))
    
    if (mp4Files.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun fichier optimisé trouvé',
        updated: 0
      })
    }
    
    console.log(`📁 ${mp4Files.length} fichiers optimisés trouvés`)
    
    // 2. Récupérer tous les médias de la base de données
    const { data: allMedia, error: fetchError } = await supabase
      .from('media')
      .select('id, title, pcloud_fileid')
    
    if (fetchError) {
      console.error('Erreur récupération médias:', fetchError)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des médias' },
        { status: 500 }
      )
    }
    
    console.log(`📊 ${allMedia?.length || 0} médias en base de données`)
    
    // 3. Pour chaque fichier optimisé, trouver le média correspondant et mettre à jour
    let updated = 0
    const updates: Array<{ title: string; oldPath: string; newPath: string }> = []
    
    for (const optimizedFile of mp4Files) {
      // Nom de base sans extension (ex: "Film.mkv" → "Film")
      const baseName = optimizedFile.replace(/\.mp4$/i, '')
      
      // Chercher le média correspondant par nom de base
      // On cherche soit le nom exact, soit avec différentes extensions
      const matchingMedia = allMedia?.find(media => {
        const mediaFilename = path.basename(media.pcloud_fileid)
        const mediaBaseName = mediaFilename.replace(/\.[^.]+$/, '')
        
        // Comparer les noms de base (insensible à la casse)
        return mediaBaseName.toLowerCase() === baseName.toLowerCase()
      })
      
      if (matchingMedia) {
        // Construire le nouveau chemin (même dossier que l'original, mais avec .mp4)
        const originalDir = path.dirname(matchingMedia.pcloud_fileid)
        const newPath = path.join(originalDir, optimizedFile)
        
        // Vérifier que le fichier existe dans pCloud
        try {
          await stat(newPath)
          
          // Mettre à jour la base de données
          const { error: updateError } = await supabase
            .from('media')
            .update({ pcloud_fileid: newPath })
            .eq('id', matchingMedia.id)
          
          if (updateError) {
            console.error(`❌ Erreur mise à jour ${matchingMedia.title}:`, updateError)
          } else {
            console.log(`✅ ${matchingMedia.title}: ${path.basename(matchingMedia.pcloud_fileid)} → ${optimizedFile}`)
            updated++
            updates.push({
              title: matchingMedia.title,
              oldPath: matchingMedia.pcloud_fileid,
              newPath
            })
          }
        } catch (statError) {
          // Fichier pas encore dans pCloud, on skip
          console.log(`⏭️  ${optimizedFile} pas encore dans pCloud (skip)`)
        }
      } else {
        console.log(`⚠️  Aucun média trouvé pour: ${optimizedFile}`)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `${updated} fichier(s) mis à jour`,
      updated,
      updates
    })
    
  } catch (error: any) {
    console.error('Erreur mise à jour optimisés:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: 500 }
    )
  }
}




