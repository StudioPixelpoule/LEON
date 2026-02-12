/**
 * Exécution FFmpeg pour le transcodage HLS
 * Détection codec, probe streams, transcodage vidéo/audio, extraction sous-titres
 */

import { spawn } from 'child_process'
import { promisify } from 'util'
import { exec } from 'child_process'
import { mkdir, readdir, readFile, writeFile, rm, unlink } from 'fs/promises'
import path from 'path'
import { SEGMENT_DURATION } from './types'
import type { TranscodeJob, StreamInfo, AudioInfoEntry } from './types'
import { detectHardwareCapabilities } from '../hardware-detection'
import { markAsTranscoded, syncTranscodedStatus } from './db-sync'

const execAsync = promisify(exec)

// ─── Utilitaires ────────────────────────────────────────────────────────────

/** Échapper les caractères spéciaux pour les commandes shell */
export function escapeFilePath(filepath: string): string {
  return filepath.replace(/'/g, "'\\''")
}

/** Détecter le codec vidéo source (pour savoir si HEVC) */
export async function detectVideoCodec(filepath: string): Promise<string> {
  try {
    const escapedPath = escapeFilePath(filepath)
    const { stdout } = await execAsync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 '${escapedPath}'`,
      { timeout: 30000 }
    )
    const codec = stdout.trim().toLowerCase().replace(/,+$/, '')
    console.log(`[TRANSCODE] Codec détecté: "${codec}" (raw: "${stdout.trim()}")`)
    return codec
  } catch (error) {
    console.error('[TRANSCODE] Erreur détection codec:', error)
    return 'unknown'
  }
}

// ─── Analyse des pistes ─────────────────────────────────────────────────────

/** Codecs sous-titres bitmap (non convertibles en WebVTT) */
const BITMAP_SUBTITLE_CODECS = [
  'hdmv_pgs_subtitle', 'pgssub', 'pgs',
  'dvd_subtitle', 'dvdsub', 'dvbsub',
  'xsub', 'vobsub'
]

/** Codecs/tags audio non décodables */
const INVALID_AUDIO_TAGS = ['enca', 'encv']
const INVALID_AUDIO_CODECS = ['none', 'unknown']

/**
 * Analyser un fichier pour obtenir les infos sur les pistes audio et sous-titres
 */
export async function probeStreams(filepath: string): Promise<StreamInfo> {
  try {
    const escapedPath = escapeFilePath(filepath)
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_streams '${escapedPath}'`
    )
    const data = JSON.parse(stdout)
    const streams = data.streams || []

    const audios = streams
      .filter((s: Record<string, unknown>) => s.codec_type === 'audio')
      .filter((s: Record<string, unknown>) => {
        const tag = (((s.codec_tag_string as string) || '')).toLowerCase()
        const codec = (((s.codec_name as string) || '')).toLowerCase()

        if (INVALID_AUDIO_TAGS.includes(tag)) {
          const tags = s.tags as Record<string, string> | undefined
          console.log(`[TRANSCODE] Piste audio chiffrée ignorée: ${tags?.language || 'und'} (tag: ${tag})`)
          return false
        }

        if (!codec || INVALID_AUDIO_CODECS.includes(codec)) {
          const tags = s.tags as Record<string, string> | undefined
          console.log(`[TRANSCODE] Piste audio invalide ignorée: ${tags?.language || 'und'} (codec: ${codec || 'absent'})`)
          return false
        }

        if (s.channels === 0) {
          const tags = s.tags as Record<string, string> | undefined
          console.log(`[TRANSCODE] Piste audio vide ignorée: ${tags?.language || 'und'} (0 channels)`)
          return false
        }

        return true
      })
      .map((s: Record<string, unknown>, idx: number) => {
        const tags = s.tags as Record<string, string> | undefined
        return {
          index: idx,
          language: tags?.language || 'und',
          title: tags?.title
        }
      })

    const subtitles = streams
      .filter((s: Record<string, unknown>) => s.codec_type === 'subtitle')
      .filter((s: Record<string, unknown>) => {
        const codec = (((s.codec_name as string) || '')).toLowerCase()
        const isBitmap = BITMAP_SUBTITLE_CODECS.some(bc => codec.includes(bc))
        if (isBitmap) {
          const tags = s.tags as Record<string, string> | undefined
          console.log(`[TRANSCODE] Sous-titre bitmap ignoré: ${tags?.language || 'und'} (${codec})`)
        }
        return !isBitmap
      })
      .map((s: Record<string, unknown>, idx: number) => {
        const tags = s.tags as Record<string, string> | undefined
        return {
          index: idx,
          language: tags?.language || 'und',
          title: tags?.title,
          codec: s.codec_name as string
        }
      })

    return { audioCount: audios.length, subtitleCount: subtitles.length, audios, subtitles }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[TRANSCODE] Erreur probe streams:', errorMsg)

    if (errorMsg.includes('Invalid data') || errorMsg.includes('EBML header') || errorMsg.includes('parsing failed')) {
      console.error('[TRANSCODE] FICHIER CORROMPU - impossible à transcoder')
      throw new Error('Fichier corrompu: ' + errorMsg.slice(0, 100))
    }

    return {
      audioCount: 1,
      subtitleCount: 0,
      audios: [{ index: 0, language: 'und', title: 'Audio' }],
      subtitles: []
    }
  }
}

// ─── Extraction sous-titres ─────────────────────────────────────────────────

/**
 * Extraire les sous-titres en fichiers WebVTT
 * Note: les sous-titres bitmap (PGS, DVD) sont déjà filtrés dans probeStreams()
 */
export async function extractSubtitles(
  filepath: string,
  outputDir: string,
  subtitles: Array<{ index: number; language: string; title?: string; codec: string }>
): Promise<void> {
  if (subtitles.length === 0) {
    console.log(`[TRANSCODE] Aucun sous-titre texte à extraire`)
    return
  }

  console.log(`[TRANSCODE] Extraction de ${subtitles.length} sous-titres texte...`)

  const extractedSubs: Array<{ language: string; title?: string; file: string }> = []
  const escapedPath = escapeFilePath(filepath)

  for (const sub of subtitles) {
    const outputFile = path.join(outputDir, `sub_${sub.language}_${sub.index}.vtt`)

    try {
      await execAsync(
        `ffmpeg -y -i '${escapedPath}' -map 0:s:${sub.index} -c:s webvtt "${outputFile}"`
      )
      console.log(`[TRANSCODE] Sous-titre extrait: ${sub.language}`)
      extractedSubs.push({
        language: sub.language,
        title: sub.title,
        file: `sub_${sub.language}_${sub.index}.vtt`
      })
    } catch {
      console.warn(`[TRANSCODE] Impossible d'extraire sous-titre ${sub.language} (${sub.codec}) - ignoré`)
    }
  }

  if (extractedSubs.length > 0) {
    await writeFile(
      path.join(outputDir, 'subtitles.json'),
      JSON.stringify(extractedSubs, null, 2)
    )
    console.log(`[TRANSCODE] ${extractedSubs.length}/${subtitles.length} sous-titres extraits`)
  }
}

// ─── Playlist HLS ───────────────────────────────────────────────────────────

/**
 * Créer le master playlist HLS avec EXT-X-MEDIA pour chaque piste audio
 */
export function createMasterPlaylist(
  streamInfo: { audioCount: number; audios: Array<{ index: number; language: string; title?: string }> },
  audioInfo: AudioInfoEntry[]
): string {
  const lines: string[] = ['#EXTM3U', '#EXT-X-VERSION:6']

  if (audioInfo.length > 0) {
    for (const audio of audioInfo) {
      const defaultAttr = audio.isDefault ? 'YES' : 'NO'
      const name = audio.title || `Audio ${audio.index + 1}`
      const lang = audio.language || 'und'

      lines.push(
        `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${name}",LANGUAGE="${lang}",DEFAULT=${defaultAttr},AUTOSELECT=YES,URI="${audio.playlist}"`
      )
    }

    lines.push('#EXT-X-STREAM-INF:BANDWIDTH=5000000,CODECS="avc1.640028,mp4a.40.2",AUDIO="audio"')
    lines.push('video.m3u8')
  } else {
    lines.push('#EXT-X-STREAM-INF:BANDWIDTH=5000000,CODECS="avc1.640028"')
    lines.push('video.m3u8')
  }

  return lines.join('\n')
}

// ─── Transcodage principal ──────────────────────────────────────────────────

/** Callbacks pour la gestion des processus actifs */
export interface TranscodeCallbacks {
  setActiveProcess: (jobId: string, process: ReturnType<typeof spawn>) => void
}

/**
 * Transcoder un fichier complet (vidéo + audio + sous-titres + playlist master)
 */
export async function transcodeFile(
  job: TranscodeJob,
  callbacks: TranscodeCallbacks
): Promise<void> {
  await mkdir(job.outputDir, { recursive: true })

  // Créer le fichier verrou .transcoding
  const transcodingLockPath = path.join(job.outputDir, '.transcoding')
  await writeFile(transcodingLockPath, new Date().toISOString())

  // Obtenir la durée du fichier
  const escapedFilePath = escapeFilePath(job.filepath)
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 '${escapedFilePath}'`
    )
    job.estimatedDuration = parseFloat(stdout.trim())
  } catch {
    job.estimatedDuration = 7200
    console.warn(`[TRANSCODE] Impossible d'obtenir la durée, estimation 2h`)
  }

  const hardware = await detectHardwareCapabilities()

  // Étape 1: Analyser le fichier
  const streamInfo = await probeStreams(job.filepath)
  console.log(`[TRANSCODE] Pistes détectées: ${streamInfo.audioCount} audio, ${streamInfo.subtitleCount} sous-titres`)

  // Étape 2: Extraire les sous-titres en WebVTT
  if (streamInfo.subtitleCount > 0) {
    await extractSubtitles(job.filepath, job.outputDir, streamInfo.subtitles)
  }

  // Étape 3: DEMUXED HLS - Standard Netflix/YouTube
  console.log(`[TRANSCODE] Mode DEMUXED: vidéo séparée + ${streamInfo.audioCount} audio séparés`)

  // Sauvegarder les infos audio
  const audioInfo: AudioInfoEntry[] = streamInfo.audios.map((audio, idx) => ({
    index: idx,
    language: audio.language || 'und',
    title: audio.title || `Audio ${idx + 1}`,
    playlist: `audio_${idx}.m3u8`,
    isDefault: idx === 0
  }))

  if (streamInfo.audioCount > 0) {
    await writeFile(
      path.join(job.outputDir, 'audio_info.json'),
      JSON.stringify(audioInfo, null, 2)
    )
    console.log(`[TRANSCODE] audio_info.json créé avec ${audioInfo.length} pistes`)
  }

  // PASS 1: Encoder la VIDÉO (sans audio)
  console.log(`[TRANSCODE] Pass 1: Encodage vidéo...`)

  const sourceCodec = await detectVideoCodec(job.filepath)
  const isHEVC = sourceCodec === 'hevc' || sourceCodec === 'h265'

  if (isHEVC) {
    console.log(`[TRANSCODE] Source HEVC détectée - décodage software (CPU) + encodage hardware (GPU)`)
  }

  const useHardwareDecoder = hardware.acceleration === 'vaapi' && !isHEVC

  let decoderArgs: string[] = []
  let videoFilter: string

  if (hardware.acceleration === 'vaapi') {
    if (isHEVC) {
      decoderArgs = ['-init_hw_device', 'vaapi=va:/dev/dri/renderD128', '-filter_hw_device', 'va']
      videoFilter = 'format=nv12,hwupload'
    } else {
      decoderArgs = hardware.decoderArgs
      videoFilter = 'format=nv12|vaapi,hwupload'
    }
  } else {
    decoderArgs = []
    videoFilter = 'format=yuv420p'
  }

  const videoArgs = [
    ...decoderArgs,
    '-i', job.filepath,
    '-map', '0:v:0',
    '-an',
    '-map_metadata', '-1',
    '-vf', videoFilter,
    ...hardware.encoderArgs,
    '-g', '48',
    '-keyint_min', '24',
    '-sc_threshold', '0',
    '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_DURATION})`,
    '-f', 'hls',
    '-hls_time', String(SEGMENT_DURATION),
    '-hls_list_size', '0',
    '-hls_segment_type', 'mpegts',
    '-hls_flags', 'independent_segments',
    '-hls_segment_filename', path.join(job.outputDir, 'video_segment%d.ts'),
    '-hls_playlist_type', 'vod',
    '-start_number', '0',
    path.join(job.outputDir, 'video.m3u8')
  ]

  // PASS 2+: Encoder chaque piste AUDIO séparément
  const audioArgsList: string[][] = []

  for (let i = 0; i < streamInfo.audioCount; i++) {
    const audioArgs = [
      '-i', job.filepath,
      '-map', `0:a:${i}`,
      '-vn',
      '-map_metadata', '-1',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ac', '2',
      '-ar', '48000',
      '-f', 'hls',
      '-hls_time', String(SEGMENT_DURATION),
      '-hls_list_size', '0',
      '-hls_segment_type', 'mpegts',
      '-hls_flags', 'independent_segments',
      '-hls_segment_filename', path.join(job.outputDir, `audio_${i}_segment%d.ts`),
      '-hls_playlist_type', 'vod',
      '-start_number', '0',
      path.join(job.outputDir, `audio_${i}.m3u8`)
    ]
    audioArgsList.push(audioArgs)
  }

  // Si pas d'audio, créer un flux vidéo+audio simple
  if (streamInfo.audioCount === 0) {
    videoArgs.splice(videoArgs.indexOf('-an'), 1)
    videoArgs.splice(videoArgs.indexOf('-map'), 0, '-map', '0:a?')
  }

  console.log(`[TRANSCODE] Démarrage FFmpeg vidéo...`)
  console.log(`[TRANSCODE] Video args: ffmpeg ${videoArgs.slice(0, 10).join(' ')} ...`)

  // Helper pour exécuter FFmpeg et suivre la progression
  const runFFmpeg = (args: string[], label: string, progressWeight: number, progressOffset: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log(`[TRANSCODE] FFmpeg ${label}: nice -n 19 ffmpeg`, args.join(' ').slice(0, 200) + '...')

      const ffmpeg = spawn('nice', ['-n', '19', 'ionice', '-c', '3', 'ffmpeg', ...args], {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      callbacks.setActiveProcess(job.id, ffmpeg)
      job.pid = ffmpeg.pid

      let lastError = ''

      ffmpeg.stderr?.on('data', (data) => {
        const message = data.toString()
        lastError = message

        const timeMatch = message.match(/time=(\d+):(\d+):(\d+)\.(\d+)/)
        const speedMatch = message.match(/speed=\s*([\d.]+)x/)

        if (timeMatch) {
          const hours = parseInt(timeMatch[1])
          const minutes = parseInt(timeMatch[2])
          const seconds = parseInt(timeMatch[3])
          job.currentTime = hours * 3600 + minutes * 60 + seconds

          if (job.estimatedDuration && job.estimatedDuration > 0) {
            const passProgress = (job.currentTime / job.estimatedDuration) * 100
            job.progress = Math.min(99, progressOffset + (passProgress * progressWeight / 100))
          }
        }

        if (speedMatch) {
          job.speed = parseFloat(speedMatch[1])
        }
      })

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`[TRANSCODE] ${label} terminé`)
          resolve()
        } else {
          console.error(`[TRANSCODE] FFmpeg ${label} erreur (code ${code}):`)
          console.error(`[TRANSCODE] Dernière sortie: ${lastError.slice(-500)}`)
          reject(new Error(`FFmpeg ${label} exit code: ${code}`))
        }
      })

      ffmpeg.on('error', (err) => {
        reject(err)
      })
    })
  }

  try {
    const videoWeight = streamInfo.audioCount > 0 ? 70 : 100
    const audioWeight = streamInfo.audioCount > 0 ? 30 / streamInfo.audioCount : 0

    // PASS 1: Vidéo
    await runFFmpeg(videoArgs, 'Vidéo', videoWeight, 0)

    // PASS 2+: Audio(s)
    for (let i = 0; i < audioArgsList.length; i++) {
      const audioOffset = videoWeight + (i * audioWeight)
      const label = `Audio ${i + 1}/${audioArgsList.length}`

      if (i === 0) {
        await runFFmpeg(audioArgsList[i], label, audioWeight, audioOffset)
      } else {
        try {
          await runFFmpeg(audioArgsList[i], label, audioWeight, audioOffset)
        } catch (audioError) {
          console.warn(`[TRANSCODE] ⚠️ Piste ${label} ignorée (non-fatale): ${audioError instanceof Error ? audioError.message : audioError}`)
          try {
            const audioFiles = await readdir(job.outputDir)
            for (const file of audioFiles) {
              if (file.startsWith(`audio_${i}_`) || file === `audio_${i}.m3u8`) {
                await unlink(path.join(job.outputDir, file))
              }
            }
          } catch { /* Ignore les erreurs de nettoyage */ }

          try {
            const audioInfoPath = path.join(job.outputDir, 'audio_info.json')
            const audioInfoRaw = await readFile(audioInfoPath, 'utf-8')
            const audioInfoParsed = JSON.parse(audioInfoRaw)
            if (audioInfoParsed.tracks) {
              audioInfoParsed.tracks = audioInfoParsed.tracks.filter((_: unknown, idx: number) => idx !== i)
              await writeFile(audioInfoPath, JSON.stringify(audioInfoParsed, null, 2))
              console.log(`[TRANSCODE] audio_info.json mis à jour (piste ${i} retirée)`)
            }
          } catch { /* Ignore */ }
        }
      }
    }

    // PASS FINAL: Créer le master playlist
    console.log(`[TRANSCODE] Création du master playlist...`)
    const masterPlaylist = createMasterPlaylist(streamInfo, audioInfo)
    await writeFile(path.join(job.outputDir, 'playlist.m3u8'), masterPlaylist)
    console.log(`[TRANSCODE] Master playlist créé`)

    // Supprimer le verrou et créer .done
    await rm(transcodingLockPath, { force: true })
    await writeFile(path.join(job.outputDir, '.done'), new Date().toISOString())

    // Marquer comme transcodé en BDD
    const marked = await markAsTranscoded(job.filepath)

    if (!marked) {
      console.warn(`[TRANSCODE] markAsTranscoded a échoué, lancement sync immédiat...`)
      await syncTranscodedStatus()
    }

  } catch (error) {
    try {
      await rm(transcodingLockPath, { force: true })
    } catch (rmError) {
      console.warn('[TRANSCODE] Erreur suppression lock erreur:', rmError instanceof Error ? rmError.message : rmError)
    }
    throw error
  }
}
