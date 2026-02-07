import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { validateMediaPath } from '@/lib/path-validator'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

// Chemin vers subliminal (configurable via variable d'environnement)
const SUBLIMINAL_PATH = process.env.SUBLIMINAL_PATH || 'subliminal'

// Langues autorisées pour éviter l'injection
const VALID_LANGS: Record<string, string> = {
  'fr': 'fra', 'en': 'eng', 'es': 'spa', 'de': 'deu',
  'it': 'ita', 'pt': 'por', 'nl': 'nld', 'ja': 'jpn',
  'ko': 'kor', 'zh': 'zho', 'fra': 'fra', 'eng': 'eng',
  'spa': 'spa', 'deu': 'deu', 'ita': 'ita', 'por': 'por',
}

/**
 * Exécute subliminal de manière sécurisée via spawn (pas de string interpolation)
 */
function runSubliminal(args: string[], cwd: string, timeoutMs = 30000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(SUBLIMINAL_PATH, args, { cwd, timeout: timeoutMs })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (data) => { stdout += data.toString() })
    proc.stderr.on('data', (data) => { stderr += data.toString() })
    proc.on('close', () => resolve({ stdout, stderr }))
    proc.on('error', (err) => reject(err))
  })
}

/**
 * API pour chercher et télécharger des sous-titres depuis OpenSubtitles
 * Utilise subliminal (Python) pour la recherche et le téléchargement
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepathRaw = searchParams.get('path')
  const lang = searchParams.get('lang') || 'fra'

  if (!filepathRaw) {
    return NextResponse.json({ error: 'Paramètre path manquant' }, { status: 400 })
  }
  
  // Valider le chemin contre le path traversal
  const validation = validateMediaPath(filepathRaw)
  if (!validation.valid) {
    console.error('[API] Chemin non autorisé:', validation.error)
    return NextResponse.json({ error: 'Chemin non autorisé' }, { status: 403 })
  }
  
  // Valider la langue contre une whitelist
  const validLang = VALID_LANGS[lang]
  if (!validLang) {
    return NextResponse.json({ error: `Langue non supportée: ${lang}` }, { status: 400 })
  }
  
  // Normaliser pour gérer les caractères Unicode
  const filepath = validation.normalized || filepathRaw.normalize('NFD')
  const videoDir = path.dirname(filepath)
  const videoFilename = path.basename(filepath)
  
  console.log(`[API] Recherche sous-titres: ${videoFilename} (langue: ${validLang})`)
  
  try {
    // Télécharger les sous-titres avec subliminal (via spawn, pas d'interpolation shell)
    const { stdout, stderr } = await runSubliminal(
      ['download', '-l', validLang, videoFilename],
      videoDir
    )
    
    console.log('[SUBTITLES] Sortie subliminal:', stdout)
    
    if (stderr && !stderr.includes('Downloaded')) {
      console.warn('⚠️ Avertissement:', stderr)
    }
    
    // Vérifier si le téléchargement a réussi
    if (stdout.includes('Downloaded') || stdout.includes('1 video collected')) {
      console.log('[SUBTITLES] Sous-titres téléchargés avec succès')
      
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

