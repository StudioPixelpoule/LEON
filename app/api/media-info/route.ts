import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

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
  }[]
  subtitleTracks: {
    index: number
    language: string
    title: string
    codec: string
    forced?: boolean
  }[]
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepathRaw = searchParams.get('path')

  if (!filepathRaw) {
    return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })
  }
  
  // Normaliser pour gérer les caractères Unicode
  const filepath = filepathRaw.normalize('NFD')

  try {
    // Utiliser ffprobe pour obtenir les infos sur les pistes
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
      subtitleTracks
    }

    return NextResponse.json(mediaInfo)
  } catch (error) {
    console.error('Erreur ffprobe:', error)
    return NextResponse.json(
      { 
        audioTracks: [],
        subtitleTracks: []
      }
    )
  }
}
