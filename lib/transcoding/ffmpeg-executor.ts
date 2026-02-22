/**
 * Exécution FFmpeg pour le pré-transcodage HLS
 * 
 * Fonctionnalités :
 * - Single-pass multi-output : vidéo + audios + sous-titres en une seule commande
 * - Détection framerate source + GOP dynamique
 * - Validation post-transcodage (segments, playlists, intégrité)
 * - Fallback séquentiel si le single-pass échoue
 */

import { spawn } from 'child_process'
import { promisify } from 'util'
import { exec } from 'child_process'
import { mkdir, readdir, readFile, writeFile, rm, unlink, stat } from 'fs/promises'
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

/** Détecter le framerate source pour calculer le GOP dynamiquement */
export async function detectFramerate(filepath: string): Promise<number> {
  try {
    const escapedPath = escapeFilePath(filepath)
    const { stdout } = await execAsync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 '${escapedPath}'`,
      { timeout: 30000 }
    )
    // r_frame_rate est au format "24000/1001" ou "25/1"
    const raw = stdout.trim().split(',')[0]
    const parts = raw.split('/')
    const fps = parts.length === 2 ? parseInt(parts[0]) / parseInt(parts[1]) : parseFloat(raw)

    if (isNaN(fps) || fps <= 0 || fps > 120) {
      console.warn(`[TRANSCODE] Framerate invalide: "${raw}", fallback 24fps`)
      return 24
    }

    const rounded = Math.round(fps * 100) / 100
    console.log(`[TRANSCODE] Framerate détecté: ${rounded}fps (raw: "${raw}")`)
    return rounded
  } catch (error) {
    console.warn('[TRANSCODE] Erreur détection framerate, fallback 24fps:', error)
    return 24
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

// ─── Extraction sous-titres batch ───────────────────────────────────────────

/**
 * Extraire TOUS les sous-titres en une seule commande FFmpeg (batch)
 * Au lieu de N commandes séparées, une seule lecture du fichier source
 */
export async function extractSubtitlesBatch(
  filepath: string,
  outputDir: string,
  subtitles: Array<{ index: number; language: string; title?: string; codec: string }>
): Promise<void> {
  if (subtitles.length === 0) {
    console.log(`[TRANSCODE] Aucun sous-titre texte à extraire`)
    return
  }

  console.log(`[TRANSCODE] Extraction batch de ${subtitles.length} sous-titres texte...`)

  const escapedPath = escapeFilePath(filepath)
  const extractedSubs: Array<{ language: string; title?: string; file: string }> = []

  // Construire une seule commande FFmpeg avec tous les -map 0:s:X
  const args: string[] = ['-y', '-i', `'${escapedPath}'`]
  const outputFiles: Array<{ sub: typeof subtitles[0]; file: string }> = []

  for (const sub of subtitles) {
    const outputFile = path.join(outputDir, `sub_${sub.language}_${sub.index}.vtt`)
    args.push('-map', `0:s:${sub.index}`, '-c:s', 'webvtt', `"${outputFile}"`)
    outputFiles.push({ sub, file: `sub_${sub.language}_${sub.index}.vtt` })
  }

  try {
    await execAsync(`ffmpeg ${args.join(' ')}`, { timeout: 120000 })
    console.log(`[TRANSCODE] Extraction batch réussie: ${subtitles.length} sous-titres`)

    for (const { sub, file } of outputFiles) {
      extractedSubs.push({ language: sub.language, title: sub.title, file })
    }
  } catch (batchError) {
    console.warn(`[TRANSCODE] Extraction batch échouée, fallback individuel:`, batchError instanceof Error ? batchError.message.slice(0, 100) : batchError)

    // Fallback : extraction individuelle (robustesse)
    for (const { sub, file } of outputFiles) {
      const outputFile = path.join(outputDir, file)
      try {
        await execAsync(`ffmpeg -y -i '${escapedPath}' -map 0:s:${sub.index} -c:s webvtt "${outputFile}"`, { timeout: 60000 })
        console.log(`[TRANSCODE] Sous-titre extrait (individuel): ${sub.language}`)
        extractedSubs.push({ language: sub.language, title: sub.title, file })
      } catch {
        console.warn(`[TRANSCODE] Impossible d'extraire sous-titre ${sub.language} (${sub.codec}) - ignoré`)
      }
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

// ─── Validation post-transcodage ────────────────────────────────────────────

/**
 * Valide l'intégrité du transcodage avant de créer .done
 * Retourne true si tout est correct, false sinon avec raison
 */
async function validateTranscodeResult(
  outputDir: string,
  audioInfo: AudioInfoEntry[]
): Promise<{ valid: boolean; reason?: string }> {
  try {
    // 1. Vérifier que video.m3u8 existe et contient #EXT-X-ENDLIST
    const videoPlaylistPath = path.join(outputDir, 'video.m3u8')
    let videoPlaylist: string
    try {
      videoPlaylist = await readFile(videoPlaylistPath, 'utf-8')
    } catch {
      return { valid: false, reason: 'video.m3u8 manquant' }
    }

    if (!videoPlaylist.includes('#EXT-X-ENDLIST')) {
      return { valid: false, reason: 'video.m3u8 ne contient pas #EXT-X-ENDLIST (transcodage incomplet)' }
    }

    // 2. Compter les segments vidéo référencés dans la playlist
    const videoSegmentRefs = videoPlaylist.match(/video_segment\d+\.ts/g) || []
    const expectedVideoSegments = videoSegmentRefs.length

    if (expectedVideoSegments === 0) {
      return { valid: false, reason: 'video.m3u8 ne référence aucun segment' }
    }

    // 3. Vérifier que tous les segments vidéo existent sur disque
    const files = await readdir(outputDir)
    const videoSegmentsOnDisk = files.filter(f => f.startsWith('video_segment') && f.endsWith('.ts'))

    if (videoSegmentsOnDisk.length < expectedVideoSegments) {
      return { 
        valid: false, 
        reason: `Segments vidéo manquants: ${videoSegmentsOnDisk.length}/${expectedVideoSegments} sur disque` 
      }
    }

    // 4. Vérifier chaque piste audio
    for (const audio of audioInfo) {
      const audioPlaylistPath = path.join(outputDir, audio.playlist)
      let audioPlaylist: string
      try {
        audioPlaylist = await readFile(audioPlaylistPath, 'utf-8')
      } catch {
        return { valid: false, reason: `${audio.playlist} manquant (piste audio ${audio.index})` }
      }

      if (!audioPlaylist.includes('#EXT-X-ENDLIST')) {
        return { valid: false, reason: `${audio.playlist} incomplet (pas de #EXT-X-ENDLIST)` }
      }

      const audioSegmentRefs = audioPlaylist.match(/audio_\d+_segment\d+\.ts/g) || []
      const audioSegmentsOnDisk = files.filter(f => f.startsWith(`audio_${audio.index}_segment`) && f.endsWith('.ts'))

      if (audioSegmentsOnDisk.length < audioSegmentRefs.length) {
        return { 
          valid: false, 
          reason: `Segments audio ${audio.index} manquants: ${audioSegmentsOnDisk.length}/${audioSegmentRefs.length}` 
        }
      }
    }

    // 5. Vérifier qu'un segment aléatoire a une taille > 0
    const randomSegment = videoSegmentsOnDisk[Math.floor(Math.random() * videoSegmentsOnDisk.length)]
    const segmentStat = await stat(path.join(outputDir, randomSegment))
    if (segmentStat.size === 0) {
      return { valid: false, reason: `Segment vide détecté: ${randomSegment}` }
    }

    console.log(`[TRANSCODE] ✅ Validation réussie: ${expectedVideoSegments} segments vidéo, ${audioInfo.length} pistes audio`)
    return { valid: true }
  } catch (error) {
    return { valid: false, reason: `Erreur validation: ${error instanceof Error ? error.message : error}` }
  }
}

// ─── Transcodage principal ──────────────────────────────────────────────────

/** Callbacks pour la gestion des processus actifs */
export interface TranscodeCallbacks {
  setActiveProcess: (jobId: string, process: ReturnType<typeof spawn>) => void
}

/**
 * Transcoder un fichier complet (vidéo + audio + sous-titres + playlist master)
 * 
 * Stratégie : single-pass multi-output avec fallback séquentiel
 * 1. Tente une seule commande FFmpeg avec tous les outputs (vidéo + N audios)
 * 2. Si ça échoue, repasse en mode séquentiel (vidéo seule, puis audio un par un)
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

  // Analyser le fichier
  const streamInfo = await probeStreams(job.filepath)
  console.log(`[TRANSCODE] Pistes détectées: ${streamInfo.audioCount} audio, ${streamInfo.subtitleCount} sous-titres`)

  // Détecter le framerate source pour GOP dynamique
  const fps = await detectFramerate(job.filepath)
  const gopSize = Math.round(fps * SEGMENT_DURATION)
  const keyintMin = Math.round(fps)
  console.log(`[TRANSCODE] GOP dynamique: ${gopSize} frames (${fps}fps × ${SEGMENT_DURATION}s)`)

  // Extraire les sous-titres en WebVTT (batch)
  if (streamInfo.subtitleCount > 0) {
    await extractSubtitlesBatch(job.filepath, job.outputDir, streamInfo.subtitles)
  }

  // Préparer les infos audio
  console.log(`[TRANSCODE] Mode DEMUXED: vidéo séparée + ${streamInfo.audioCount} audio séparés`)
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

  // Détecter le codec et préparer les args de décodage
  const sourceCodec = await detectVideoCodec(job.filepath)
  const isHEVC = sourceCodec === 'hevc' || sourceCodec === 'h265'

  // Fallback CPU pour HEVC (chemin éprouvé : decode CPU + encode GPU)
  const cpuDecoderArgs = ['-init_hw_device', 'vaapi=va:/dev/dri/renderD128', '-filter_hw_device', 'va']
  const cpuVideoFilter = 'format=nv12,hwupload'

  let decoderArgs: string[] = []
  let videoFilter: string
  let hevcHwDecode = false

  if (hardware.acceleration === 'vaapi') {
    if (isHEVC) {
      // Pipeline full VAAPI : decode GPU + encode GPU (Apollo Lake supporte HEVC decode)
      // Si le driver ne le supporte pas, fallback automatique sur decode CPU
      decoderArgs = hardware.decoderArgs
      videoFilter = 'format=nv12|vaapi,hwupload'
      hevcHwDecode = true
      console.log('[TRANSCODE] HEVC: tentative décodage GPU (full VAAPI pipeline)')
    } else {
      decoderArgs = hardware.decoderArgs
      videoFilter = 'format=nv12|vaapi,hwupload'
    }
  } else {
    decoderArgs = []
    videoFilter = 'format=yuv420p'
  }

  // Helper pour exécuter FFmpeg et suivre la progression
  const runFFmpeg = (args: string[], label: string, progressWeight: number, progressOffset: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log(`[TRANSCODE] FFmpeg ${label}: nice -n 10 ffmpeg`, args.join(' ').slice(0, 300) + '...')

      const ffmpeg = spawn('nice', ['-n', '10', 'ionice', '-c', '2', '-n', '5', 'ffmpeg', ...args], {
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

  // Arguments HLS communs
  const hlsArgs = (segmentPrefix: string, playlistName: string) => [
    '-f', 'hls',
    '-hls_time', String(SEGMENT_DURATION),
    '-hls_list_size', '0',
    '-hls_segment_type', 'mpegts',
    '-hls_flags', 'independent_segments',
    '-hls_segment_filename', path.join(job.outputDir, `${segmentPrefix}%d.ts`),
    '-hls_playlist_type', 'vod',
    '-start_number', '0',
    path.join(job.outputDir, playlistName)
  ]

  try {
    let singlePassSuccess = false

    // ═══ TENTATIVE 1 : Single-pass multi-output ═══
    if (streamInfo.audioCount > 0) {
      console.log(`[TRANSCODE] 🚀 Tentative single-pass multi-output (vidéo + ${streamInfo.audioCount} audio)...`)

      const singlePassArgs: string[] = [
        ...decoderArgs,
        '-i', job.filepath,
        // Output 1 : Vidéo
        '-map', '0:v:0',
        '-map_metadata', '-1',
        '-vf', videoFilter,
        ...hardware.encoderArgs,
        '-g', String(gopSize),
        '-keyint_min', String(keyintMin),
        '-sc_threshold', '0',
        '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_DURATION})`,
        ...hlsArgs('video_segment', 'video.m3u8'),
      ]

      // Output 2+N : Audio(s)
      for (let i = 0; i < streamInfo.audioCount; i++) {
        singlePassArgs.push(
          '-map', `0:a:${i}`,
          '-c:a', 'aac',
          '-b:a', '192k',
          '-ac', '2',
          '-ar', '48000',
          ...hlsArgs(`audio_${i}_segment`, `audio_${i}.m3u8`)
        )
      }

      try {
        await runFFmpeg(singlePassArgs, 'Single-pass multi-output', 95, 0)
        singlePassSuccess = true
        console.log(`[TRANSCODE] ✅ Single-pass réussi`)
      } catch (singlePassError) {
        // Nettoyage des fichiers partiels
        try {
          const partialFiles = await readdir(job.outputDir)
          for (const f of partialFiles) {
            if (f.endsWith('.ts') || f.endsWith('.m3u8')) {
              await unlink(path.join(job.outputDir, f)).catch(() => {})
            }
          }
        } catch { /* Ignore */ }

        // HEVC hardware échoué → retry avec décodage CPU (chemin éprouvé)
        if (isHEVC && hevcHwDecode) {
          console.warn('[TRANSCODE] HEVC hardware decode échoué, basculement sur décodage CPU')
          hevcHwDecode = false
          decoderArgs = cpuDecoderArgs
          videoFilter = cpuVideoFilter

          const cpuSinglePassArgs: string[] = [
            ...decoderArgs,
            '-i', job.filepath,
            '-map', '0:v:0',
            '-map_metadata', '-1',
            '-vf', videoFilter,
            ...hardware.encoderArgs,
            '-g', String(gopSize),
            '-keyint_min', String(keyintMin),
            '-sc_threshold', '0',
            '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_DURATION})`,
            ...hlsArgs('video_segment', 'video.m3u8'),
          ]

          for (let i = 0; i < streamInfo.audioCount; i++) {
            cpuSinglePassArgs.push(
              '-map', `0:a:${i}`,
              '-c:a', 'aac',
              '-b:a', '192k',
              '-ac', '2',
              '-ar', '48000',
              ...hlsArgs(`audio_${i}_segment`, `audio_${i}.m3u8`)
            )
          }

          try {
            await runFFmpeg(cpuSinglePassArgs, 'Single-pass CPU fallback', 95, 0)
            singlePassSuccess = true
            console.log('[TRANSCODE] ✅ Single-pass réussi (décodage CPU)')
          } catch (cpuError) {
            console.warn('[TRANSCODE] ⚠️ Single-pass CPU échoué, passage en séquentiel:', cpuError instanceof Error ? cpuError.message.slice(0, 200) : cpuError)
            try {
              const partialFiles2 = await readdir(job.outputDir)
              for (const f of partialFiles2) {
                if (f.endsWith('.ts') || f.endsWith('.m3u8')) {
                  await unlink(path.join(job.outputDir, f)).catch(() => {})
                }
              }
            } catch { /* Ignore */ }
          }
        } else {
          console.warn('[TRANSCODE] ⚠️ Single-pass échoué, passage en séquentiel:', singlePassError instanceof Error ? singlePassError.message.slice(0, 200) : singlePassError)
        }
      }
    }

    // ═══ TENTATIVE 2 : Fallback séquentiel ═══
    if (!singlePassSuccess) {
      const mode = streamInfo.audioCount > 0 ? 'Fallback séquentiel' : 'Vidéo seule (pas d\'audio)'
      console.log(`[TRANSCODE] ${mode}...`)

      const videoWeight = streamInfo.audioCount > 0 ? 70 : 100
      const audioWeight = streamInfo.audioCount > 0 ? 25 / streamInfo.audioCount : 0

      // PASS 1 : Vidéo
      const buildVideoArgs = () => {
        const args = [
          ...decoderArgs,
          '-i', job.filepath,
          '-map', '0:v:0',
          '-an',
          '-map_metadata', '-1',
          '-vf', videoFilter,
          ...hardware.encoderArgs,
          '-g', String(gopSize),
          '-keyint_min', String(keyintMin),
          '-sc_threshold', '0',
          '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_DURATION})`,
          ...hlsArgs('video_segment', 'video.m3u8'),
        ]

        if (streamInfo.audioCount === 0) {
          args.splice(args.indexOf('-an'), 1)
          args.splice(args.indexOf('-map'), 0, '-map', '0:a?')
        }
        return args
      }

      try {
        await runFFmpeg(buildVideoArgs(), 'Vidéo (séquentiel)', videoWeight, 0)
      } catch (videoError) {
        if (isHEVC && hevcHwDecode) {
          console.warn('[TRANSCODE] HEVC hardware decode échoué (séquentiel), basculement sur décodage CPU')
          hevcHwDecode = false
          decoderArgs = cpuDecoderArgs
          videoFilter = cpuVideoFilter

          try {
            const partialVideoFiles = await readdir(job.outputDir)
            for (const f of partialVideoFiles) {
              if ((f.startsWith('video_segment') && f.endsWith('.ts')) || f === 'video.m3u8') {
                await unlink(path.join(job.outputDir, f)).catch(() => {})
              }
            }
          } catch { /* Ignore */ }

          await runFFmpeg(buildVideoArgs(), 'Vidéo CPU fallback', videoWeight, 0)
        } else {
          throw videoError
        }
      }

      // PASS 2+N : Audio(s)
      for (let i = 0; i < streamInfo.audioCount; i++) {
        const audioOffset = videoWeight + (i * audioWeight)
        const label = `Audio ${i + 1}/${streamInfo.audioCount} (séquentiel)`

        const audioArgs = [
          '-i', job.filepath,
          '-map', `0:a:${i}`,
          '-vn',
          '-map_metadata', '-1',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-ac', '2',
          '-ar', '48000',
          ...hlsArgs(`audio_${i}_segment`, `audio_${i}.m3u8`),
        ]

        if (i === 0) {
          await runFFmpeg(audioArgs, label, audioWeight, audioOffset)
        } else {
          try {
            await runFFmpeg(audioArgs, label, audioWeight, audioOffset)
          } catch (audioError) {
            console.warn(`[TRANSCODE] ⚠️ Piste ${label} ignorée (non-fatale): ${audioError instanceof Error ? audioError.message : audioError}`)
            try {
              const audioFiles = await readdir(job.outputDir)
              for (const file of audioFiles) {
                if (file.startsWith(`audio_${i}_`) || file === `audio_${i}.m3u8`) {
                  await unlink(path.join(job.outputDir, file))
                }
              }
            } catch { /* Ignore */ }

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
    }

    // ═══ MASTER PLAYLIST ═══
    console.log(`[TRANSCODE] Création du master playlist...`)
    const masterPlaylist = createMasterPlaylist(streamInfo, audioInfo)
    await writeFile(path.join(job.outputDir, 'playlist.m3u8'), masterPlaylist)
    console.log(`[TRANSCODE] Master playlist créé`)

    // ═══ VALIDATION POST-TRANSCODAGE ═══
    console.log(`[TRANSCODE] 🔍 Validation post-transcodage...`)
    const validation = await validateTranscodeResult(job.outputDir, audioInfo)

    if (!validation.valid) {
      console.error(`[TRANSCODE] ❌ Validation échouée: ${validation.reason}`)
      await rm(transcodingLockPath, { force: true })
      throw new Error(`Validation post-transcodage échouée: ${validation.reason}`)
    }

    // ═══ FINALISATION ═══
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
