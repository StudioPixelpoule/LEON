/**
 * Détection des chapitres et du timing du générique de fin
 * 
 * Fonctionnalités :
 * - Extraction des chapitres depuis les métadonnées du fichier (MKV, MP4)
 * - Détection automatique du chapitre "Credits" / "End Credits"
 * - Fallback sur détection de silence/noir en fin de vidéo
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Types pour les chapitres FFprobe
export interface FFprobeChapter {
  id: number
  time_base: string
  start: number // en secondes
  start_time: string
  end: number
  end_time: string
  tags?: {
    title?: string
    language?: string
  }
}

export interface ChaptersResult {
  chapters: FFprobeChapter[]
  creditsStartTime: number | null // En secondes
  timingSource: 'chapters' | 'auto' | null
  duration: number // Durée totale en secondes
}

// Mots-clés pour détecter le générique de fin
const CREDITS_KEYWORDS = [
  'credits', 'end credits', 'générique', 'fin', 'ending',
  'end', 'crédits', 'credit', 'outro', 'epilogue', 'épilogue'
]

/**
 * Extrait les chapitres d'un fichier vidéo via FFprobe
 */
export async function extractChapters(filepath: string): Promise<ChaptersResult> {
  try {
    // Échapper le chemin pour le shell
    const escapedPath = filepath.replace(/'/g, "'\\''")
    
    // FFprobe pour extraire chapitres + durée
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_chapters -show_format '${escapedPath}'`,
      { maxBuffer: 10 * 1024 * 1024 }
    )
    
    const data = JSON.parse(stdout)
    const chapters: FFprobeChapter[] = data.chapters || []
    const duration = parseFloat(data.format?.duration || '0')
    
    // Chercher le chapitre "Credits" ou similaire
    let creditsStartTime: number | null = null
    let timingSource: 'chapters' | 'auto' | null = null
    
    if (chapters.length > 0) {
      // Chercher un chapitre avec un titre contenant "credits" ou similaire
      for (const chapter of chapters) {
        const title = (chapter.tags?.title || '').toLowerCase()
        
        if (CREDITS_KEYWORDS.some(keyword => title.includes(keyword))) {
          // Chapitre trouvé ! Le générique commence ici
          creditsStartTime = chapter.start
          timingSource = 'chapters'
          console.log(`[CHAPTERS] ✅ Chapitre générique trouvé: "${chapter.tags?.title}" à ${creditsStartTime}s`)
          break
        }
      }
      
      // Si pas de chapitre "credits" explicite, prendre le dernier chapitre 
      // s'il commence dans les 10 dernières minutes et fait moins de 8 minutes
      if (!creditsStartTime && chapters.length > 1) {
        const lastChapter = chapters[chapters.length - 1]
        const lastChapterDuration = lastChapter.end - lastChapter.start
        const timeFromEnd = duration - lastChapter.start
        
        // Heuristique : dernier chapitre < 8min et commence dans les 10 dernières minutes
        if (lastChapterDuration < 480 && timeFromEnd < 600) {
          creditsStartTime = lastChapter.start
          timingSource = 'auto'
          console.log(`[CHAPTERS] 🔍 Dernier chapitre utilisé comme générique: ${creditsStartTime}s (${Math.round(lastChapterDuration)}s)`)
        }
      }
    }
    
    return {
      chapters,
      creditsStartTime,
      timingSource,
      duration
    }
  } catch (error) {
    console.error('[CHAPTERS] Erreur extraction chapitres:', error)
    return {
      chapters: [],
      creditsStartTime: null,
      timingSource: null,
      duration: 0
    }
  }
}

/**
 * Détecte le début du générique via analyse audio (silence) et vidéo (noir)
 * Plus lent mais utile quand il n'y a pas de chapitres
 * 
 * @param filepath Chemin du fichier vidéo
 * @param duration Durée totale en secondes
 * @param analyzeLastMinutes Analyser les X dernières minutes (défaut: 8)
 */
export async function detectCreditsViaSilence(
  filepath: string, 
  duration: number,
  analyzeLastMinutes: number = 8
): Promise<{ creditsStartTime: number | null; confidence: number }> {
  try {
    if (duration <= 0) {
      return { creditsStartTime: null, confidence: 0 }
    }
    
    // Analyser les dernières minutes
    const startTime = Math.max(0, duration - (analyzeLastMinutes * 60))
    const escapedPath = filepath.replace(/'/g, "'\\''")
    
    // Détection de silence (souvent présent au début du générique)
    const { stdout: silenceOutput } = await execAsync(
      `ffmpeg -ss ${startTime} -i '${escapedPath}' -af silencedetect=noise=-50dB:d=2 -f null - 2>&1 | grep silence_start`,
      { maxBuffer: 5 * 1024 * 1024 }
    ).catch(() => ({ stdout: '' }))
    
    // Parser les silences détectés
    const silences: number[] = []
    const silenceMatches = silenceOutput.matchAll(/silence_start: ([\d.]+)/g)
    for (const match of silenceMatches) {
      const silenceTime = startTime + parseFloat(match[1])
      // Ne considérer que les silences dans les 5 dernières minutes
      if (silenceTime > duration - 300) {
        silences.push(silenceTime)
      }
    }
    
    if (silences.length > 0) {
      // Prendre le premier silence significatif comme début potentiel du générique
      const creditsStartTime = Math.min(...silences)
      const confidence = 0.6 // Confiance moyenne
      
      console.log(`[CHAPTERS] 🔇 Silence détecté à ${creditsStartTime}s (confiance: ${confidence})`)
      return { creditsStartTime, confidence }
    }
    
    return { creditsStartTime: null, confidence: 0 }
  } catch (error) {
    console.error('[CHAPTERS] Erreur détection silence:', error)
    return { creditsStartTime: null, confidence: 0 }
  }
}

/**
 * Fonction principale : tente d'abord les chapitres, puis le fallback silence
 */
export async function detectCreditsStart(
  filepath: string,
  skipSilenceDetection: boolean = false
): Promise<{
  creditsStartTime: number | null
  timingSource: 'chapters' | 'auto' | 'silence' | null
  chapters: FFprobeChapter[]
  duration: number
}> {
  // 1. Essayer d'abord les chapitres
  const chaptersResult = await extractChapters(filepath)
  
  if (chaptersResult.creditsStartTime !== null) {
    return {
      creditsStartTime: chaptersResult.creditsStartTime,
      timingSource: chaptersResult.timingSource,
      chapters: chaptersResult.chapters,
      duration: chaptersResult.duration
    }
  }
  
  // 2. Fallback : détection par silence (optionnel, plus lent)
  if (!skipSilenceDetection && chaptersResult.duration > 0) {
    const silenceResult = await detectCreditsViaSilence(filepath, chaptersResult.duration)
    
    if (silenceResult.creditsStartTime !== null && silenceResult.confidence >= 0.5) {
      return {
        creditsStartTime: silenceResult.creditsStartTime,
        timingSource: 'silence' as const,
        chapters: chaptersResult.chapters,
        duration: chaptersResult.duration
      }
    }
  }
  
  // Aucune détection réussie
  return {
    creditsStartTime: null,
    timingSource: null,
    chapters: chaptersResult.chapters,
    duration: chaptersResult.duration
  }
}
