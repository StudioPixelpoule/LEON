import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'

const execAsync = promisify(exec)
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
  
  // NE PAS normaliser - utiliser le chemin tel quel
  const filepath = filepathRaw

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
      
      return NextResponse.json({
        audioTracks,
        subtitleTracks,
        isPreTranscoded: true,
        preTranscodedDir: preTranscoded.dir
      })
    }
    
    // SINON: Utiliser FFprobe sur le fichier original
    console.log(`[MEDIA-INFO] 🔍 FFprobe sur fichier original: ${filepath}`)
    
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_streams "${filepath}"`
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
