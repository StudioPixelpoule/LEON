import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

const execAsync = promisify(exec)

/**
 * API pour chercher et télécharger des sous-titres depuis OpenSubtitles
 * Utilise subliminal (Python) pour la recherche et le téléchargement
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepathRaw = searchParams.get('path')
  const lang = searchParams.get('lang') || 'fra' // Code ISO 639-3

  if (!filepathRaw) {
    return NextResponse.json({ error: 'Paramètre path manquant' }, { status: 400 })
  }
  
  // Normaliser pour gérer les caractères Unicode
  const filepath = filepathRaw.normalize('NFD')
  const videoDir = path.dirname(filepath)
  const videoFilename = path.basename(filepath)
  
  console.log(`🔍 Recherche sous-titres pour: ${videoFilename}`)
  console.log(`📂 Dossier: ${videoDir}`)
  
  try {
    // Vérifier si subliminal est installé
    const subliminalPath = '/Users/lionelvernay/Library/Python/3.9/bin/subliminal'
    
    try {
      await execAsync(`test -x "${subliminalPath}"`)
    } catch {
      console.error('❌ subliminal non installé ou inaccessible')
      return NextResponse.json({ 
        error: 'Outil de téléchargement non disponible',
        help: 'Installez subliminal : pip3 install --user subliminal'
      }, { status: 503 })
    }
    
    // Télécharger les sous-titres avec subliminal
    console.log(`📥 Téléchargement sous-titres ${lang}...`)
    
    const command = `cd "${videoDir}" && "${subliminalPath}" download -l ${lang} "${videoFilename}"`
    
    const { stdout, stderr } = await execAsync(command, { 
      timeout: 30000, // 30 secondes max
      maxBuffer: 1024 * 1024 * 10 // 10MB
    })
    
    console.log('📋 Sortie subliminal:', stdout)
    
    if (stderr && !stderr.includes('Downloaded')) {
      console.warn('⚠️ Avertissement:', stderr)
    }
    
    // Vérifier si le téléchargement a réussi
    if (stdout.includes('Downloaded') || stdout.includes('1 video collected')) {
      console.log('✅ Sous-titres téléchargés avec succès')
      
      // Le fichier .srt devrait maintenant exister
      // Rediriger vers l'API externe qui va le charger
      const externalUrl = `/api/subtitles/external?path=${encodeURIComponent(filepath)}&lang=fr`
      
      return NextResponse.json({ 
        success: true,
        message: 'Sous-titres téléchargés',
        redirectTo: externalUrl
      }, { status: 200 })
    } else if (stdout.includes('No subtitles found') || stdout.includes('0 video collected')) {
      console.warn('⚠️ Aucun sous-titre trouvé')
      return NextResponse.json({ 
        error: 'Aucun sous-titre disponible pour ce film',
        suggestion: 'Essayez de chercher manuellement sur OpenSubtitles.org'
      }, { status: 404 })
    } else {
      console.warn('⚠️ Résultat inattendu:', stdout)
      return NextResponse.json({ 
        error: 'Téléchargement incertain',
        details: stdout
      }, { status: 500 })
    }
  } catch (error) {
    console.error('❌ Erreur téléchargement sous-titres:', error)
    
    // Vérifier si c'est un timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      return NextResponse.json({ 
        error: 'Délai d\'attente dépassé',
        details: 'Le téléchargement a pris trop de temps (> 30s)'
      }, { status: 504 })
    }
    
    return NextResponse.json({ 
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

