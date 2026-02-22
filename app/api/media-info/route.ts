import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'
import { validateMediaPath } from '@/lib/path-validator'
import { findLocalSubtitles } from '@/lib/localScanner'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

// Helper pour exécuter ffprobe avec spawn (sécurisé)
function runFFprobe(args: string[], filepath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [...args, filepath])
    let stdout = ''
    let stderr = ''

    ffprobe.stdout.on('data', (data) => { stdout += data.toString() })
    ffprobe.stderr.on('data', (data) => { stderr += data.toString() })

    ffprobe.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(stderr || `ffprobe exited with code ${code}`))
      }
    })

    ffprobe.on('error', reject)
  })
}
const TRANSCODED_DIR = process.env.TRANSCODED_DIR || '/leon/transcoded'

interface StreamInfo {
  index: number
  codec_type: string
  codec_name?: string
  tags?: {
    language?: string
    title?: string
  }
}

interface MediaInfo {
  audioTracks: {
    index: number
    language: string
    title: string
    codec: string
    hlsPlaylist?: string // 🆕 Pour HLS pré-transcodé
  }[]
  subtitleTracks: {
    index: number
    language: string
    title: string
    codec: string
    forced?: boolean
    vttFile?: string // 🆕 Pour sous-titres WebVTT pré-transcodés
  }[]
  isPreTranscoded?: boolean // 🆕 Indicateur
}

// Mapping des codes ISO 639 vers noms complets
const languageMap: Record<string, string> = {
  'fre': 'Français',
  'fra': 'Français',
  'fr': 'Français',
  'eng': 'English',
  'en': 'English',
  'spa': 'Español',
  'es': 'Español',
  'ger': 'Deutsch',
  'deu': 'Deutsch',
  'de': 'Deutsch',
  'ita': 'Italiano',
  'it': 'Italiano',
  'por': 'Português',
  'pt': 'Português',
  'rus': 'Русский',
  'ru': 'Русский',
  'jpn': '日本語',
  'ja': '日本語',
  'chi': '中文',
  'zh': '中文',
  'kor': '한국어',
  'ko': '한국어',
  'ara': 'العربية',
  'ar': 'العربية',
  'hin': 'हिन्दी',
  'hi': 'हिन्दी',
  'und': 'Non défini',
  'unknown': 'Inconnu'
}

/**
 * Trouver le dossier pré-transcodé pour un fichier
 */
function getPreTranscodedDir(filepath: string): { dir: string; found: boolean } {
  const filename = path.basename(filepath, path.extname(filepath))
  const safeName = filename.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s\-_.()[\]]/gi, '_')
  
  // Vérifier dans le dossier racine (films)
  const mainDir = path.join(TRANSCODED_DIR, safeName)
  if (existsSync(mainDir) && existsSync(path.join(mainDir, '.done'))) {
    return { dir: mainDir, found: true }
  }
  
  // Vérifier dans le sous-dossier series/ (épisodes)
  const seriesDir = path.join(TRANSCODED_DIR, 'series', safeName)
  if (existsSync(seriesDir) && existsSync(path.join(seriesDir, '.done'))) {
    return { dir: seriesDir, found: true }
  }
  
  return { dir: mainDir, found: false }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepathRaw = searchParams.get('path')

  if (!filepathRaw) {
    return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })
  }
  
  // Validation sécurisée du chemin
  const pathValidation = validateMediaPath(filepathRaw)
  if (!pathValidation.valid || !pathValidation.normalized) {
    return NextResponse.json({ error: pathValidation.error || 'Chemin invalide' }, { status: 400 })
  }
  const filepath = pathValidation.normalized

  try {
    // 🆕 VÉRIFIER D'ABORD SI LE FICHIER EST PRÉ-TRANSCODÉ
    const preTranscoded = getPreTranscodedDir(filepath)
    
    if (preTranscoded.found) {
      console.log(`[MEDIA-INFO] 📁 Fichier pré-transcodé trouvé: ${preTranscoded.dir}`)
      
      const audioInfoPath = path.join(preTranscoded.dir, 'audio_info.json')
      const subtitlesPath = path.join(preTranscoded.dir, 'subtitles.json')
      
      let audioTracks: MediaInfo['audioTracks'] = []
      let subtitleTracks: MediaInfo['subtitleTracks'] = []
      
      // Charger les pistes audio depuis audio_info.json
      if (existsSync(audioInfoPath)) {
        try {
          const audioInfo = JSON.parse(await readFile(audioInfoPath, 'utf-8'))
          audioTracks = audioInfo.map((track: any, idx: number) => ({
            index: idx,
            language: languageMap[track.language] || track.language || 'Inconnu',
            title: track.title || `Piste audio ${idx + 1}`,
            codec: 'aac', // Pré-transcodé en AAC
            hlsPlaylist: track.file || `stream_${idx}.m3u8`
          }))
          console.log(`[MEDIA-INFO] 🔊 ${audioTracks.length} pistes audio trouvées`)
        } catch (err) {
          console.warn('[MEDIA-INFO] ⚠️ Erreur lecture audio_info.json:', err)
        }
      }
      
      // Charger les sous-titres depuis subtitles.json
      if (existsSync(subtitlesPath)) {
        try {
          const subsInfo = JSON.parse(await readFile(subtitlesPath, 'utf-8'))
          subtitleTracks = subsInfo.map((sub: any, idx: number) => ({
            index: idx,
            language: languageMap[sub.language] || sub.language || 'Inconnu',
            title: sub.title || `Sous-titres ${idx + 1}`,
            codec: 'webvtt',
            forced: sub.forced || false,
            vttFile: sub.file // ex: sub_fre_0.vtt
          }))
          console.log(`[MEDIA-INFO] 📝 ${subtitleTracks.length} sous-titres trouvés`)
        } catch (err) {
          console.warn('[MEDIA-INFO] ⚠️ Erreur lecture subtitles.json:', err)
        }
      }
      
      // Si pas de audio_info.json, au moins une piste par défaut
      if (audioTracks.length === 0) {
        audioTracks = [{
          index: 0,
          language: 'Original',
          title: 'Piste audio',
          codec: 'aac',
          hlsPlaylist: 'playlist.m3u8'
        }]
      }
      
      // Détecter les SRT externes (téléchargés par OpenSubtitles)
      const externalSubs = await findLocalSubtitles(filepath)
      if (externalSubs.length > 0) {
        const existingLanguages = new Set(
          subtitleTracks.map(t => `${t.language}-${!!t.forced}`)
        )
        for (const sub of externalSubs) {
          const lang = sub.language || 'Inconnu'
          const mappedLang = languageMap[lang.toLowerCase()] || lang
          const isForced = !!sub.forced
          const key = `${mappedLang}-${isForced}`
          if (!existingLanguages.has(key)) {
            subtitleTracks.push({
              index: subtitleTracks.length,
              language: mappedLang,
              title: isForced ? `${mappedLang} (Forcé)` : mappedLang,
              codec: path.extname(sub.filename).slice(1),
              forced: isForced,
            })
            existingLanguages.add(key)
          }
        }
        console.log(`[MEDIA-INFO] ${externalSubs.length} SRT externe(s) détecté(s)`)
      }

      return NextResponse.json({
        audioTracks,
        subtitleTracks,
        isPreTranscoded: true,
        preTranscodedDir: preTranscoded.dir
      })
    }
    
    // SINON: Utiliser FFprobe sur le fichier original
    console.log(`[MEDIA-INFO] 🔍 FFprobe sur fichier original: ${filepath}`)
    
    const stdout = await runFFprobe(
      ['-v', 'quiet', '-print_format', 'json', '-show_streams'],
      filepath
    )

    const data = JSON.parse(stdout)
    const streams: StreamInfo[] = data.streams || []

    const audioTracks = streams
      .filter(s => s.codec_type === 'audio')
      .map((stream, idx) => {
        const lang = stream.tags?.language || 'und'
        const title = stream.tags?.title || ''
        
        return {
          index: stream.index,
          language: languageMap[lang] || lang,
          title: title || `Piste audio ${idx + 1}`,
          codec: stream.codec_name || 'unknown'
        }
      })

    const subtitleTracks = streams
      .filter(s => s.codec_type === 'subtitle')
      .map((stream, idx) => {
        const lang = stream.tags?.language || 'und'
        const title = stream.tags?.title || ''
        const isForced = title.toLowerCase().includes('forced') || 
                        title.toLowerCase().includes('forcé')
        
        return {
          index: stream.index,
          language: languageMap[lang] || lang,
          title: title || `Sous-titres ${idx + 1}`,
          codec: stream.codec_name || 'unknown',
          forced: isForced
        }
      })

    // Détecter les SRT externes (téléchargés par OpenSubtitles)
    const externalSubs = await findLocalSubtitles(filepath)
    if (externalSubs.length > 0) {
      const existingLanguages = new Set(
        subtitleTracks.map(t => `${t.language}-${!!t.forced}`)
      )
      for (const sub of externalSubs) {
        const lang = sub.language || 'Inconnu'
        const mappedLang = languageMap[lang.toLowerCase()] || lang
        const isForced = !!sub.forced
        const key = `${mappedLang}-${isForced}`
        if (!existingLanguages.has(key)) {
          subtitleTracks.push({
            index: subtitleTracks.length + 100,
            language: mappedLang,
            title: isForced ? `${mappedLang} (Forcé)` : mappedLang,
            codec: path.extname(sub.filename).slice(1),
            forced: isForced,
          })
          existingLanguages.add(key)
        }
      }
      console.log(`[MEDIA-INFO] ${externalSubs.length} SRT externe(s) détecté(s)`)
    }

    const mediaInfo: MediaInfo = {
      audioTracks,
      subtitleTracks,
      isPreTranscoded: false
    }

    return NextResponse.json(mediaInfo)
  } catch (error) {
    console.error('Erreur ffprobe:', error)
    return NextResponse.json(
      { 
        audioTracks: [],
        subtitleTracks: [],
        isPreTranscoded: false
      }
    )
  }
}
