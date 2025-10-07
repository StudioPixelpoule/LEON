/**
 * API Route: Scan du dossier local (pCloud Drive) avec reconnaissance intelligente
 * Détecte les nouveaux fichiers vidéo et les indexe dans Supabase
 * Utilise le système de reconnaissance intelligente pour améliorer la précision
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getMovieDetails, getTMDBImageUrl, getYearFromDate } from '@/lib/tmdb'
import { searchMovie } from '@/lib/tmdb'
import { sanitizeFilename } from '@/lib/media-recognition/filenameSanitizer'
import { findSubtitles as findSubtitlesIntelligent } from '@/lib/media-recognition/subtitleMatcher'
import { 
  scanLocalFolder, 
  findLocalSubtitles, 
  formatFileSize, 
  detectVideoQuality, 
  checkPathAccess,
  type LocalMediaFile 
} from '@/lib/localScanner'

export async function POST() {
  try {
    // 1. Vérifier que le dossier pCloud Drive est accessible
    const pCloudPath = process.env.PCLOUD_LOCAL_PATH || '/Users/lionelvernay/pCloud Drive/films'
    
    const isAccessible = await checkPathAccess(pCloudPath)
    if (!isAccessible) {
      return NextResponse.json(
        { error: `Dossier pCloud Drive non accessible: ${pCloudPath}. Vérifiez que pCloud Drive est monté.` },
        { status: 500 }
      )
    }
    
    // 2. Scanner le dossier local
    const videoFiles = await scanLocalFolder(pCloudPath)
    
    if (videoFiles.length === 0) {
      return NextResponse.json({ 
        message: 'Aucun fichier vidéo trouvé',
        count: 0 
      })
    }
    
    // 3. Indexation par batch de 100 (optimisation MacBook Air M1)
    const BATCH_SIZE = 100
    let indexed = 0
    let updated = 0
    let errors = 0
    let highConfidence = 0
    let mediumConfidence = 0
    let lowConfidence = 0
    let unidentified = 0
    
    console.log(`🎬 Début du scan: ${videoFiles.length} fichiers trouvés`)
    
    for (let i = 0; i < videoFiles.length; i += BATCH_SIZE) {
      const batch = videoFiles.slice(i, i + BATCH_SIZE)
      console.log(`📦 Traitement du batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(videoFiles.length / BATCH_SIZE)}`)
      
      for (const file of batch) {
        try {
          // Vérifier si déjà indexé (par filepath au lieu de fileid)
          const { data: existing } = await supabase
            .from('media')
            .select('id, poster_url, tmdb_id')
            .eq('pcloud_fileid', file.filepath)
            .single()
          
          // Si déjà indexé ET a des métadonnées complètes, skip
          if (existing && existing.poster_url && existing.tmdb_id) {
            console.log(`⏭️  Déjà indexé avec métadonnées: ${file.filename}`)
            updated++
            continue
          }
          
          // Si existe mais sans métadonnées, on va les ajouter
          if (existing) {
            console.log(`🔄 Mise à jour métadonnées: ${file.filename}`)
          }
          
          console.log(`🔍 Analyse: ${file.filename}`)
          
          // Détecter la qualité vidéo
          const quality = detectVideoQuality(file.filename, file.size)
          
          // Nettoyer le nom de fichier et extraire le titre + année
          const { cleanName, year } = sanitizeFilename(file.filename)
          console.log(`📝 Nom nettoyé: "${cleanName}"${year ? ` (${year})` : ''}`)
          
          // Rechercher le film sur TMDB
          const movieResults = await searchMovie(cleanName, year)
          
          let mediaDetails = null
          let confidence = 0
          
          if (movieResults && movieResults.length > 0) {
            const bestMatch = movieResults[0]
            confidence = 85 // Confiance élevée pour le premier résultat
            
            console.log(`✅ Match trouvé: ${bestMatch.title} (${bestMatch.release_date ? new Date(bestMatch.release_date).getFullYear() : '?'}) - Confiance: ${confidence}%`)
            
            // Comptabiliser par niveau de confiance
            if (confidence >= 80) highConfidence++
            else if (confidence >= 60) mediumConfidence++
            else lowConfidence++
            
            // Récupérer les détails complets depuis TMDB
            console.log(`🌐 Récupération TMDB movie ID: ${bestMatch.id}`)
            mediaDetails = await getMovieDetails(bestMatch.id)
            
            if (mediaDetails) {
              console.log(`📊 Métadonnées reçues: ${mediaDetails.title}`)
            } else {
              console.log(`⚠️  Échec récupération métadonnées TMDB`)
            }
          } else {
            console.log(`❌ Aucun match trouvé`)
            unidentified++
          }
          
          // Rechercher les sous-titres localement
          const localSubtitles = await findLocalSubtitles(file.filepath)
          
          // Formater les sous-titres pour la base de données
          const subtitles = localSubtitles.reduce((acc, sub) => {
            const lang = sub.language || 'UNKNOWN'
            acc[lang.toUpperCase()] = {
              filename: sub.filename,
              filepath: sub.filepath,
              isForced: sub.forced || false,
              isSDH: sub.sdh || false
            }
            return acc
          }, {} as Record<string, any>)
          
          // Préparer les données pour INSERT ou UPDATE
          const mediaData = {
            pcloud_fileid: file.filepath,
            title: mediaDetails?.title || cleanName || file.filename,
            original_title: mediaDetails?.original_title || null,
            year: mediaDetails?.release_date ? getYearFromDate(mediaDetails.release_date) : year || null,
            duration: mediaDetails?.runtime || null,
            formatted_runtime: mediaDetails?.runtime ? `${Math.floor(mediaDetails.runtime / 60)}h ${mediaDetails.runtime % 60}min` : null,
            file_size: formatFileSize(file.size),
            quality: quality,
            tmdb_id: mediaDetails?.id || null,
            poster_url: getTMDBImageUrl(mediaDetails?.poster_path || null, 'w500'),
            backdrop_url: getTMDBImageUrl(mediaDetails?.backdrop_path || null, 'original'),
            overview: mediaDetails?.overview || null,
            genres: mediaDetails?.genres?.map((g: any) => g.name) || null,
            movie_cast: mediaDetails?.credits?.cast || null,
            subtitles: Object.keys(subtitles).length > 0 ? subtitles : null,
            release_date: mediaDetails?.release_date || null,
            rating: mediaDetails?.vote_average || null,
            vote_count: mediaDetails?.vote_count || null,
            tagline: mediaDetails?.tagline || null,
            director: mediaDetails?.credits?.crew?.find((c: any) => c.job === 'Director') || null,
            trailer_url: mediaDetails?.videos?.results?.[0]?.key ? `https://youtube.com/watch?v=${mediaDetails.videos.results[0].key}` : null,
          }
          
          // Si existe déjà, UPDATE, sinon INSERT
          let upsertError = null
          if (existing) {
            const { error } = await supabase
              .from('media')
              .update(mediaData)
              .eq('id', existing.id)
            upsertError = error
          } else {
            const { error } = await supabase
              .from('media')
              .insert(mediaData)
            upsertError = error
          }
          
          if (upsertError) {
            console.error(`❌ Erreur upsert ${file.filename}:`, upsertError)
            errors++
          } else {
            console.log(`💾 ${existing ? 'Mis à jour' : 'Indexé'}: ${file.filename}`)
            indexed++
          }
          
        } catch (error) {
          console.error(`Erreur traitement ${file.filename}:`, error)
          errors++
        }
      }
    }
    
    // Calculer les statistiques de reconnaissance
    const identificationRate = videoFiles.length > 0
      ? Math.round(((indexed - unidentified) / indexed) * 100)
      : 0
    
    return NextResponse.json({
      success: true,
      message: 'Scan terminé',
      stats: {
        total: videoFiles.length,
        indexed,
        updated,
        errors,
        identificationRate,
        confidence: {
          high: highConfidence,
          medium: mediumConfidence,
          low: lowConfidence
        },
        unidentified
      }
    })
    
  } catch (error) {
    console.error('Erreur scan:', error)
    return NextResponse.json(
      { error: 'Erreur lors du scan' },
      { status: 500 }
    )
  }
}

