/**
 * API Route: Streaming vidéo local pour le lecteur web
 * GET /api/stream?path=/chemin/vers/video.mkv
 * Sert les fichiers vidéo locaux avec support du streaming (range requests)
 */

import { NextRequest, NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import fs from 'fs'
import { stat } from 'fs/promises'
import path from 'path'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filepathRaw = searchParams.get('path')
    
    if (!filepathRaw) {
      return NextResponse.json(
        { error: 'Chemin du fichier manquant' },
        { status: 400 }
      )
    }
    
    // Normaliser pour gérer les caractères Unicode
    const filepath = filepathRaw.normalize('NFD')
    
    console.log(`📂 Tentative d'accès au fichier: ${filepath}`)

    // Vérifier que le fichier existe
    try {
      await stat(filepath)
      console.log(`✅ Fichier trouvé: ${filepath}`)
    } catch (error) {
      console.error(`❌ Fichier non trouvé: ${filepath}`)
      console.error(`   Erreur:`, error)
      return NextResponse.json(
        { error: 'Fichier non trouvé', path: filepath },
        { status: 404 }
      )
    }

    // Obtenir les informations du fichier
    const fileStats = await stat(filepath)
    const fileSize = fileStats.size

    // Obtenir le range header pour le streaming
    const range = request.headers.get('range')

    if (range) {
      // Parse le range (ex: "bytes=0-1024")
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = (end - start) + 1

      // Créer un stream pour la portion demandée
      const fileStream = fs.createReadStream(filepath, { start, end })

      // Déterminer le type MIME
      const ext = path.extname(filepath).toLowerCase()
      const mimeTypes: { [key: string]: string } = {
        '.mp4': 'video/mp4',
        '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.webm': 'video/webm'
      }
      const contentType = mimeTypes[ext] || 'video/mp4'

      // Retourner la réponse avec le bon range
      return new NextResponse(fileStream as any, {
        status: 206, // Partial Content
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': contentType,
        },
      })
    } else {
      // Pas de range, envoyer le fichier complet
      const fileStream = fs.createReadStream(filepath)
      
      const ext = path.extname(filepath).toLowerCase()
      const mimeTypes: { [key: string]: string } = {
        '.mp4': 'video/mp4',
        '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.webm': 'video/webm'
      }
      const contentType = mimeTypes[ext] || 'video/mp4'

      return new NextResponse(fileStream as any, {
        status: 200,
        headers: {
          'Content-Length': fileSize.toString(),
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
        },
      })
    }
  } catch (error) {
    console.error('❌ Erreur streaming:', error)
    return NextResponse.json(
      { error: 'Erreur lors du streaming de la vidéo' },
      { status: 500 }
    )
  }
}

