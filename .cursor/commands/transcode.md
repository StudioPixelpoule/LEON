# /transcode — Debug Transcodage LEON

## Usage

Exécuter `/transcode` pour diagnostiquer les problèmes de streaming et transcodage.

## Commandes de Diagnostic

### Sessions FFmpeg Actives

```bash
# Via API
curl http://localhost:3000/api/ffmpeg-sessions

# Processus système
docker exec leon ps aux | grep ffmpeg
```

### Cache Segments

```bash
# Stats cache
curl http://localhost:3000/api/cache/stats

# Vider le cache
curl -X POST http://localhost:3000/api/cache/clear
```

### Info Fichier Vidéo

```bash
# Informations complètes
docker exec leon ffprobe -v verbose /leon/media/films/test.mkv

# Codecs uniquement
docker exec leon ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,width,height,bit_rate \
  -of csv=p=0 /leon/media/films/test.mkv

# Pistes audio
docker exec leon ffprobe -v error -select_streams a \
  -show_entries stream=index,codec_name:stream_tags=language,title \
  -of csv=p=0 /leon/media/films/test.mkv

# Sous-titres
docker exec leon ffprobe -v error -select_streams s \
  -show_entries stream=index,codec_name:stream_tags=language,title \
  -of csv=p=0 /leon/media/films/test.mkv
```

### Logs FFmpeg

```bash
# Derniers logs
docker logs leon 2>&1 | grep -i ffmpeg | tail -50

# Erreurs seulement
docker logs leon 2>&1 | grep -i "ffmpeg.*error" | tail -20
```

### État Queue Transcodage

```bash
# Stats queue
curl http://localhost:3000/api/transcode

# Fichier queue persistant
docker exec leon cat /app/transcode-queue.json
```

## Problèmes Courants

### Vidéo ne Démarre Pas

```markdown
## Diagnostic

1. Vérifier FFmpeg lancé
   curl http://localhost:3000/api/ffmpeg-sessions

2. Si 0 sessions :
   - Vérifier le chemin du fichier
   - Vérifier les permissions
   - Tester avec ffprobe

3. Si sessions bloquées :
   - Vérifier charge CPU (docker stats leon)
   - Vérifier espace disque
```

### Buffering Infini

```markdown
## Diagnostic

1. Transcodage trop lent ?
   docker stats leon  # CPU > 100% ?

2. Réseau trop lent ?
   # Tester depuis client
   curl -o /dev/null -w "%{speed_download}" http://leon/api/hls?path=...

3. Configuration HLS ?
   # Vérifier buffer dans SimpleVideoPlayer
```

### Erreur HEVC

```markdown
## Diagnostic

1. Vérifier codec source
   docker exec leon ffprobe -v error -select_streams v:0 \
     -show_entries stream=codec_name -of csv=p=0 /path/to/file.mkv

2. Si "hevc" :
   - Décodage GPU peut échouer
   - Forcer décodage CPU dans hardware-detection.ts
```

### Sous-titres 500

```markdown
## Diagnostic

1. Vérifier format sous-titres
   docker exec leon ffprobe -v error -select_streams s \
     -show_entries stream=codec_name -of csv=p=0 /path/to/file.mkv

2. Si "hdmv_pgs_subtitle" ou "dvd_subtitle" :
   - Format image, non convertible en WebVTT
   - Doit être skippé par le code
```

## Configuration FFmpeg

### Commande Standard (VAAPI)

```bash
ffmpeg -hwaccel vaapi -hwaccel_device /dev/dri/renderD128 \
  -hwaccel_output_format vaapi \
  -i input.mkv \
  -c:v h264_vaapi -profile:v main -level 4.1 \
  -b:v 5M -maxrate 6M -bufsize 12M \
  -g 48 -sc_threshold 0 \
  -f hls -hls_time 2 -hls_list_size 0 \
  -hls_segment_type mpegts \
  -hls_flags independent_segments \
  output.m3u8
```

### Test Manuel Transcodage

```bash
# Tester une commande FFmpeg manuellement
docker exec leon ffmpeg -i /leon/media/films/test.mkv \
  -c:v h264_vaapi -vaapi_device /dev/dri/renderD128 \
  -f null - 2>&1 | head -50
```

## Rapport de Diagnostic

```markdown
# Diagnostic Transcodage LEON

**Date** : [Date]
**Fichier** : [Chemin]

## État Système

| Métrique | Valeur |
|----------|--------|
| Sessions FFmpeg actives | X |
| CPU Usage | X% |
| Mémoire | X/16GB |
| Cache segments | X GB |

## Info Fichier

| Propriété | Valeur |
|-----------|--------|
| Codec vidéo | h264/hevc |
| Résolution | 1920x1080 |
| Durée | HH:MM:SS |
| Pistes audio | X |
| Sous-titres | X |

## Diagnostic

[Description du problème et cause identifiée]

## Solution

[Correction recommandée]

## Commandes Utilisées

```bash
[Commandes exécutées pour le diagnostic]
```
```

## Actions Rapides

### Nettoyer Sessions Zombies

```bash
# Kill toutes les sessions
curl -X POST http://localhost:3000/api/transcode -d '{"action":"stop"}'

# Ou directement
docker exec leon pkill -f ffmpeg
```

### Vider Cache

```bash
curl -X POST http://localhost:3000/api/cache/clear
```

### Redémarrer Container

```bash
docker restart leon
```
