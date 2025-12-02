import { NextRequest, NextResponse } from 'next/server'
import { readFile, access } from 'fs/promises'
import { constants } from 'fs'
import path from 'path'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

/**
 * API pour charger des sous-titres SRT externes
 * Cherche un fichier .srt/.fr.srt/.en.srt à côté de la vidéo
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepathRaw = searchParams.get('path')
  const lang = searchParams.get('lang') || 'fr' // Langue par défaut : français

  if (!filepathRaw) {
    return NextResponse.json({ error: 'Paramètre path manquant' }, { status: 400 })
  }
  
  // Normaliser pour gérer les caractères Unicode
  const filepath = filepathRaw.normalize('NFD')
  
  try {
    // Générer les chemins possibles pour les sous-titres
    const videoDir = path.dirname(filepath)
    const videoBasename = path.basename(filepath, path.extname(filepath))
    
    // Ordre de recherche : .lang.srt, .srt
    const possiblePaths = [
      path.join(videoDir, `${videoBasename}.${lang}.srt`),
      path.join(videoDir, `${videoBasename}.srt`),
    ]
    
    console.log(`🔍 Recherche sous-titres externes pour: ${videoBasename}`)
    console.log(`   Chemin vidéo: ${filepath}`)
    console.log(`   Dossier vidéo: ${videoDir}`)
    console.log(`   Langue demandée: ${lang}`)
    
    // Chercher le premier fichier existant
    let srtPath: string | null = null
    for (const p of possiblePaths) {
      console.log(`   Test: ${p}`)
      try {
        await access(p, constants.R_OK)
        srtPath = p
        console.log(`✅ Trouvé: ${path.basename(p)}`)
        break
      } catch (err) {
        console.log(`   ❌ Non trouvé: ${path.basename(p)}`)
        // Fichier n'existe pas, continuer
      }
    }
    
    if (!srtPath) {
      console.warn(`⚠️ Aucun fichier SRT trouvé pour ${videoBasename}`)
      console.warn(`   Chemins testés:`, possiblePaths.map(p => path.basename(p)))
      return NextResponse.json({ 
        error: 'Aucun sous-titre externe trouvé',
        searched: possiblePaths.map(p => path.basename(p)),
        videoDir,
        videoBasename
      }, { status: 404 })
    }
    
    // Lire le fichier SRT
    const srtContent = await readFile(srtPath, 'utf-8')
    
    // Convertir SRT en WebVTT (simple)
    const vttContent = convertSRTtoWebVTT(srtContent)
    
    console.log(`✅ Sous-titres externes chargés: ${path.basename(srtPath)} (${vttContent.length} caractères)`)
    
    return new NextResponse(vttContent, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      }
    })
  } catch (error) {
    console.error('❌ Erreur chargement sous-titres externes:', error)
    return NextResponse.json({ 
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

/**
 * Convertir SRT en WebVTT
 */
function convertSRTtoWebVTT(srt: string): string {
  // Remplacer les timecodes SRT (00:00:00,000) par WebVTT (00:00:00.000)
  let vtt = srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  
  // Ajouter l'en-tête WebVTT
  vtt = 'WEBVTT\n\n' + vtt
  
  return vtt
}

