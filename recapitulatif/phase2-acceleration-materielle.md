# Phase 2 - Accélération Matérielle

## 🎯 Objectif
Optimiser le transcodage HLS en utilisant l'accélération GPU disponible (VideoToolbox sur macOS, Intel Quick Sync sur Linux/NAS).

## ✅ Implémentation

### 1. Détection Automatique du Matériel
**Fichier** : `lib/hardware-detection.ts`

Système de détection automatique qui identifie :
- **macOS** : VideoToolbox (Apple Silicon M1/M2/M3 ou Intel Mac)
- **Linux** : Intel Quick Sync via QSV ou VAAPI
- **Fallback** : Encodage CPU (libx264) si aucun GPU disponible

**Avantages** :
- ✅ Code adaptatif selon la plateforme
- ✅ Pas de configuration manuelle
- ✅ Fallback automatique sur CPU si GPU échoue
- ✅ Cache de détection (1 seule détection au démarrage)

### 2. Configuration Optimisée par Plateforme

#### macOS (VideoToolbox)
```typescript
{
  acceleration: 'videotoolbox',
  encoder: 'h264_videotoolbox',
  decoderArgs: ['-hwaccel', 'videotoolbox'],
  encoderArgs: [
    '-c:v', 'h264_videotoolbox',
    '-b:v', '3000k',
    '-maxrate', '4000k',
    '-bufsize', '6000k',
    '-profile:v', 'main',
    '-level', '4.0',
    '-allow_sw', '1', // Fallback CPU
  ]
}
```

#### Linux (Intel Quick Sync - QSV)
```typescript
{
  acceleration: 'qsv',
  encoder: 'h264_qsv',
  decoderArgs: ['-hwaccel', 'qsv', '-hwaccel_device', '/dev/dri/renderD128'],
  encoderArgs: [
    '-c:v', 'h264_qsv',
    '-preset', 'fast',
    '-b:v', '3000k',
    '-maxrate', '4000k',
    '-bufsize', '6000k',
    '-profile:v', 'main',
    '-level', '4.0',
  ]
}
```

#### Linux (Intel Quick Sync - VAAPI)
```typescript
{
  acceleration: 'vaapi',
  encoder: 'h264_vaapi',
  decoderArgs: ['-hwaccel', 'vaapi', '-hwaccel_device', '/dev/dri/renderD128'],
  encoderArgs: [
    '-vf', 'format=nv12,hwupload', // Upload vers GPU
    '-c:v', 'h264_vaapi',
    '-b:v', '3000k',
    '-maxrate', '4000k',
    '-bufsize', '6000k',
    '-profile:v', 'main',
    '-level', '4.0',
  ]
}
```

#### Fallback CPU (libx264)
```typescript
{
  acceleration: 'none',
  encoder: 'libx264',
  decoderArgs: [],
  encoderArgs: [
    '-c:v', 'libx264',
    '-preset', 'veryfast', // Minimiser charge CPU
    '-b:v', '3000k',
    '-maxrate', '4000k',
    '-bufsize', '6000k',
    '-profile:v', 'main',
    '-level', '4.0',
    '-threads', '4',
  ]
}
```

### 3. Intégration dans HLS API
**Fichier** : `app/api/hls/route.ts`

Le code FFmpeg n'est plus hardcodé :
- Détection automatique au démarrage du transcodage
- Arguments FFmpeg adaptés selon le GPU détecté
- Logs clairs pour debug : `[HLS] 🎨 GPU détecté: { acceleration: 'videotoolbox', ... }`

## 📊 Gains de Performance Attendus

### Sur macOS (VideoToolbox)
- ✅ Déjà optimal (Apple Silicon très performant)
- ✅ Charge CPU réduite (~20-30%)
- ✅ Transcoding rapide (3-4x temps réel)

### Sur NAS Synology DS718+ (Intel Quick Sync)
- 🚀 **Charge CPU** : 80% → 20-30%
- 🚀 **Vitesse transcoding** : 0.8x → 3-4x temps réel
- 🚀 **Démarrage** : 10-15s → 2-3s (premiers segments)
- 🚀 **Consommation électrique** : Réduite de ~50%

## 🧪 Tests

### Sur macOS (Dev)
```bash
# Lancer un film et vérifier les logs serveur
# Devrait afficher :
[HARDWARE] 🔍 Détection du matériel...
[HARDWARE] Plateforme: macos
[HARDWARE] ✅ VideoToolbox détecté (Apple GPU)
[HLS] 🎨 GPU détecté: {
  acceleration: 'videotoolbox',
  encoder: 'h264_videotoolbox',
  platform: 'macos'
}
```

### Sur NAS (Production)
```bash
# Déployer sur NAS via Docker
# Vérifier les logs :
[HARDWARE] ✅ Intel Quick Sync (QSV) détecté
# OU
[HARDWARE] ✅ Intel Quick Sync (VAAPI) détecté

# Monitorer la charge CPU pendant lecture :
htop
# CPU devrait être à ~20-30% au lieu de 80%
```

## 🔧 Configuration Requise

### Sur NAS Synology (Linux)
Pour activer Intel Quick Sync, vérifier :

1. **Devices GPU disponibles**
```bash
ls -la /dev/dri/
# Devrait afficher : renderD128, card0, etc.
```

2. **Docker Compose** : Mapper les devices GPU
```yaml
services:
  leon:
    devices:
      - /dev/dri:/dev/dri  # Intel Quick Sync
    privileged: false
```

3. **FFmpeg avec support QSV/VAAPI**
```bash
ffmpeg -hwaccels
# Devrait lister : vaapi, qsv
```

## 📝 Logs et Monitoring

### Logs Importants
- `[HARDWARE] 🔍 Détection du matériel...` : Début détection
- `[HARDWARE] ✅ XXX détecté` : GPU trouvé
- `[HLS] 🎨 GPU détecté: {...}` : Configuration utilisée
- `[HLS] ⏱️ frame=XXX fps=XX speed=X.XXx` : Progression transcoding

### Indicateurs de Performance
- **speed** : Doit être > 1.0x (idéalement 3-4x)
- **fps** : Frames par seconde (plus élevé = mieux)
- **CPU** : Charge CPU (devrait être < 30% avec GPU)

## 🚀 Prochaines Optimisations (Phase 3+)

- **Pré-buffering intelligent** : Générer les 3 premiers segments en priorité
- **Cache segments** : Réutiliser segments déjà transcodés
- **Adaptive bitrate** : Ajuster qualité selon bande passante
- **Thumbnails preview** : Générer miniatures pour la timeline

## 📚 Références

- [Intel Quick Sync](https://www.intel.com/content/www/us/en/architecture-and-technology/quick-sync-video/quick-sync-video-general.html)
- [FFmpeg VAAPI](https://trac.ffmpeg.org/wiki/Hardware/VAAPI)
- [FFmpeg VideoToolbox](https://trac.ffmpeg.org/wiki/HWAccelIntro#VideoToolbox)
- [Synology DS718+ Specs](https://www.synology.com/en-us/products/DS718+) (Intel Celeron J3455 avec Quick Sync)













