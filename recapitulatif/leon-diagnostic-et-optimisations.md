# LEON - Diagnostic et Optimisations

**Objectif** : Transformer LEON d'un prototype fonctionnel en une plateforme de streaming fluide, stable et optimisée, avec une expérience utilisateur comparable à Netflix.

**Contexte** : Le code actuel existe et fonctionne partiellement, mais présente des problèmes de performance et de stabilité qui doivent être résolus avant le déploiement sur le NAS de production.

---

## 1. PROBLÈMES IDENTIFIÉS À CORRIGER

### Problème #1 : Interruptions de lecture vidéo
**Symptôme** : La lecture vidéo se fige ou s'arrête quand la vitesse de lecture dépasse la capacité de transcodage en temps réel.

**Causes probables :**
- Pas de gestion de buffer anticipatif
- Transcodage qui ne suit pas le rythme de lecture
- Absence de fallback quand le transcodage prend du retard
- Segments HLS générés trop lentement

**Solutions à implémenter :**
```javascript
// Backend : Gestion du buffer adaptatif
class AdaptiveBuffer {
  constructor() {
    this.bufferTarget = 30; // secondes de buffer cible
    this.minBuffer = 10;     // buffer minimum avant pause
    this.maxBuffer = 60;     // buffer maximum
  }

  async monitorBuffer(transcoder, player) {
    const currentBuffer = await this.getBufferLevel(player);
    
    if (currentBuffer < this.minBuffer) {
      // Réduire la qualité temporairement pour rattraper
      await transcoder.reduceQuality();
    } else if (currentBuffer > this.bufferTarget) {
      // Revenir à la qualité optimale
      await transcoder.restoreQuality();
    }
  }

  // Pré-transcoder les segments à l'avance
  async prefetchSegments(currentSegment, count = 5) {
    const segments = [];
    for (let i = 1; i <= count; i++) {
      segments.push(this.transcodeSegment(currentSegment + i));
    }
    return Promise.all(segments);
  }
}
```

**Checklist de validation :**
- [ ] La lecture ne se fige jamais, même en avance rapide
- [ ] Le buffer se maintient entre 10-30 secondes
- [ ] Pas de rebuffering visible pendant la lecture normale
- [ ] Les seeking (sauts temporels) sont fluides (<2s)

---

### Problème #2 : Gestion de buffer inadéquate (attentes fixes 30s)
**Symptôme** : L'utilisateur doit attendre 30 secondes fixes avant que la lecture ne commence, indépendamment de la vitesse réseau ou de la capacité de transcodage.

**Causes probables :**
- Attente hardcodée au lieu d'être adaptative
- Pas de détection de la bande passante disponible
- Pas de pré-chargement intelligent

**Solutions à implémenter :**
```javascript
// Frontend : Détection de bande passante
class BandwidthDetector {
  async detectBandwidth() {
    const testFile = '/api/bandwidth-test'; // ~1MB
    const startTime = performance.now();
    
    await fetch(testFile);
    
    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000; // en secondes
    const bandwidthMbps = (1 * 8) / duration; // Mbps
    
    return bandwidthMbps;
  }

  getOptimalBufferSize(bandwidthMbps) {
    if (bandwidthMbps > 50) return 10; // 10s si excellente connexion
    if (bandwidthMbps > 20) return 15; // 15s si bonne connexion
    if (bandwidthMbps > 10) return 20; // 20s si connexion moyenne
    return 30; // 30s si connexion lente
  }
}

// Backend : Buffer adaptatif au démarrage
class StartupBuffer {
  async calculateInitialBuffer(videoInfo, userBandwidth) {
    const videoBitrate = videoInfo.bitrate; // Mbps
    const bufferRatio = userBandwidth / videoBitrate;
    
    if (bufferRatio > 3) return 5;  // Très rapide, buffer minimal
    if (bufferRatio > 2) return 10; // Rapide
    if (bufferRatio > 1.5) return 15; // Normal
    return 20; // Prudent pour connexions lentes
  }

  async startWithProgressiveBuffer(videoUrl, initialBuffer) {
    // Commencer dès que initialBuffer est atteint
    // Continuer à buffer en arrière-plan pendant la lecture
    return {
      startTime: initialBuffer,
      continueBuffering: true,
      targetBuffer: 30
    };
  }
}
```

**Checklist de validation :**
- [ ] Le temps d'attente initial varie selon la connexion (5-20s max)
- [ ] La lecture commence dès qu'un buffer minimal est atteint
- [ ] Le buffering continue en arrière-plan pendant la lecture
- [ ] L'utilisateur voit une progression du buffer (barre de chargement)

---

### Problème #3 : Erreurs HTTP 500 sur sous-titres formats image (PGS, VOBSUB)
**Symptôme** : Les sous-titres au format image (PGS dans les MKV, VOBSUB dans les DVD) provoquent des erreurs serveur 500.

**Causes probables :**
- Tentative de conversion directe en WebVTT impossible (formats image vs texte)
- Pas de détection du type de sous-titre avant conversion
- Absence de fallback pour les formats non supportés

**Solutions à implémenter :**
```javascript
// Backend : Détection et gestion des sous-titres
class SubtitleHandler {
  async detectSubtitleFormat(videoPath, streamIndex) {
    const ffprobe = await this.runFFprobe(videoPath);
    const stream = ffprobe.streams[streamIndex];
    
    return {
      codec: stream.codec_name, // pgs, subrip, ass, vobsub, etc.
      type: this.getSubtitleType(stream.codec_name),
      language: stream.tags?.language || 'unknown'
    };
  }

  getSubtitleType(codec) {
    const imageBasedFormats = ['pgs', 'dvd_subtitle', 'dvb_subtitle', 'hdmv_pgs_subtitle'];
    const textBasedFormats = ['subrip', 'ass', 'ssa', 'mov_text', 'webvtt'];
    
    if (imageBasedFormats.includes(codec)) return 'image';
    if (textBasedFormats.includes(codec)) return 'text';
    return 'unknown';
  }

  async convertSubtitle(videoPath, streamIndex, subtitleInfo) {
    if (subtitleInfo.type === 'text') {
      // Conversion classique vers WebVTT
      return this.convertTextSubtitle(videoPath, streamIndex);
    } else if (subtitleInfo.type === 'image') {
      // OCR pour convertir image vers texte
      return this.convertImageSubtitleWithOCR(videoPath, streamIndex);
    } else {
      // Pas de sous-titres disponibles
      return null;
    }
  }

  async convertImageSubtitleWithOCR(videoPath, streamIndex) {
    // Utiliser Tesseract OCR pour extraire le texte des images
    // Note : processus gourmand, à mettre en cache
    try {
      const tempDir = await this.extractSubtitleImages(videoPath, streamIndex);
      const vttContent = await this.ocrImagesToVTT(tempDir);
      return vttContent;
    } catch (error) {
      // Si l'OCR échoue, retourner null (pas de sous-titres)
      console.error('OCR failed:', error);
      return null;
    }
  }

  async extractSubtitleImages(videoPath, streamIndex) {
    // Extraire les images PGS/VOBSUB avec FFmpeg
    const outputPattern = `/tmp/sub_${Date.now()}/image_%04d.png`;
    
    await this.runFFmpeg([
      '-i', videoPath,
      '-map', `0:${streamIndex}`,
      '-c:s', 'png',
      outputPattern
    ]);
    
    return path.dirname(outputPattern);
  }
}
```

**Alternative plus simple (recommandée pour v1) :**
```javascript
// Simplement ignorer les sous-titres image et n'afficher que les texte
class SubtitleHandlerSimple {
  async getAvailableSubtitles(videoPath) {
    const ffprobe = await this.runFFprobe(videoPath);
    const subtitles = [];
    
    for (const stream of ffprobe.streams) {
      if (stream.codec_type === 'subtitle') {
        const type = this.getSubtitleType(stream.codec_name);
        
        // Ne garder que les sous-titres texte
        if (type === 'text') {
          subtitles.push({
            index: stream.index,
            language: stream.tags?.language || 'unknown',
            codec: stream.codec_name
          });
        }
      }
    }
    
    return subtitles;
  }

  async convertToWebVTT(videoPath, streamIndex) {
    try {
      const outputPath = `/tmp/subtitle_${Date.now()}.vtt`;
      
      await this.runFFmpeg([
        '-i', videoPath,
        '-map', `0:${streamIndex}`,
        '-c:s', 'webvtt',
        outputPath
      ]);
      
      return fs.readFileSync(outputPath, 'utf8');
    } catch (error) {
      // Retourner une erreur 404 plutôt que 500
      throw new Error('SUBTITLE_NOT_AVAILABLE');
    }
  }
}
```

**Checklist de validation :**
- [ ] Les sous-titres texte (SRT, ASS) fonctionnent parfaitement
- [ ] Les sous-titres image (PGS, VOBSUB) sont soit convertis par OCR, soit ignorés proprement
- [ ] Aucune erreur 500 sur les routes de sous-titres
- [ ] L'interface indique clairement quand les sous-titres ne sont pas disponibles
- [ ] Le cache des sous-titres convertis fonctionne

---

## 2. OPTIMISATIONS CRITIQUES

### Optimisation #1 : Accélération matérielle Intel Quick Sync
**Objectif** : Utiliser le GPU intégré du NAS pour transcoder 3-4x plus vite qu'en CPU seul.

**Configuration FFmpeg avec VAAPI :**
```javascript
// Backend : Classe de transcodage avec accélération matérielle
class HardwareTranscoder {
  constructor() {
    this.hwDevice = '/dev/dri/renderD128';
    this.vaApiEnabled = this.checkVAAPIAvailable();
  }

  async checkVAAPIAvailable() {
    try {
      await this.runFFmpeg(['-hwaccels']);
      // Vérifier si 'vaapi' est dans la sortie
      return true;
    } catch {
      return false;
    }
  }

  getTranscodeCommand(inputPath, outputPath, options = {}) {
    const baseCmd = [
      '-hwaccel', 'vaapi',
      '-hwaccel_device', this.hwDevice,
      '-hwaccel_output_format', 'vaapi',
      '-i', inputPath
    ];

    // Filtres avec accélération matérielle
    const filters = [
      'format=nv12|vaapi',
      'hwupload',
      `scale_vaapi=w=${options.width || 1920}:h=${options.height || 1080}`
    ];

    const encodeCmd = [
      '-vf', filters.join(','),
      '-c:v', 'h264_vaapi',
      '-b:v', options.bitrate || '5M',
      '-maxrate', options.maxrate || '6M',
      '-bufsize', options.bufsize || '12M',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-f', 'hls',
      '-hls_time', '4',
      '-hls_list_size', '0',
      '-hls_segment_filename', `${outputPath}/segment_%03d.ts`,
      `${outputPath}/playlist.m3u8`
    ];

    return [...baseCmd, ...encodeCmd];
  }

  // Fallback sur CPU si VAAPI échoue
  async transcode(inputPath, outputPath, options = {}) {
    if (this.vaApiEnabled) {
      try {
        return await this.transcodeWithVAAPI(inputPath, outputPath, options);
      } catch (error) {
        console.warn('VAAPI failed, falling back to CPU:', error);
        return await this.transcodeWithCPU(inputPath, outputPath, options);
      }
    }
    
    return await this.transcodeWithCPU(inputPath, outputPath, options);
  }
}
```

**Profils de qualité adaptatifs :**
```javascript
const QUALITY_PROFILES = {
  '1080p': {
    width: 1920,
    height: 1080,
    bitrate: '5M',
    maxrate: '6M',
    bufsize: '12M'
  },
  '720p': {
    width: 1280,
    height: 720,
    bitrate: '3M',
    maxrate: '4M',
    bufsize: '8M'
  },
  '480p': {
    width: 854,
    height: 480,
    bitrate: '1.5M',
    maxrate: '2M',
    bufsize: '4M'
  }
};

class AdaptiveQuality {
  selectProfile(networkSpeed, cpuLoad) {
    if (networkSpeed > 20 && cpuLoad < 70) return '1080p';
    if (networkSpeed > 10 && cpuLoad < 80) return '720p';
    return '480p';
  }
}
```

**Checklist de validation :**
- [ ] Le transcodage utilise le GPU (vérifier avec `intel_gpu_top`)
- [ ] La charge CPU reste sous 50% pendant le transcodage
- [ ] Le transcodage est 3-4x plus rapide qu'avant
- [ ] Fallback CPU fonctionne si VAAPI échoue
- [ ] Profils de qualité s'adaptent automatiquement

---

### Optimisation #2 : Cache intelligent
**Objectif** : Réduire la charge de transcodage en mettant en cache les segments déjà générés.

**Stratégie de cache multi-niveaux :**
```javascript
class CacheManager {
  constructor(cacheDir) {
    this.cacheDir = cacheDir; // /volume1/docker/leon/cache/
    this.maxCacheSize = 50 * 1024 * 1024 * 1024; // 50GB
    this.ttl = 7 * 24 * 60 * 60 * 1000; // 7 jours
  }

  // Niveau 1 : Cache des segments HLS
  async getCachedSegment(videoId, quality, segmentIndex) {
    const cachePath = this.getSegmentCachePath(videoId, quality, segmentIndex);
    
    if (await this.exists(cachePath)) {
      await this.updateAccessTime(cachePath);
      return cachePath;
    }
    
    return null;
  }

  async cacheSegment(videoId, quality, segmentIndex, data) {
    await this.ensureCacheSpace();
    const cachePath = this.getSegmentCachePath(videoId, quality, segmentIndex);
    await fs.writeFile(cachePath, data);
  }

  // Niveau 2 : Cache des métadonnées vidéo (FFprobe)
  async getCachedMetadata(videoPath) {
    const hash = this.hashPath(videoPath);
    const cachePath = path.join(this.cacheDir, 'metadata', `${hash}.json`);
    
    if (await this.exists(cachePath)) {
      const metadata = JSON.parse(await fs.readFile(cachePath, 'utf8'));
      
      // Vérifier que le fichier n'a pas changé
      const stats = await fs.stat(videoPath);
      if (metadata.mtime === stats.mtime.getTime()) {
        return metadata.data;
      }
    }
    
    return null;
  }

  // Niveau 3 : Cache des sous-titres convertis
  async getCachedSubtitle(videoPath, streamIndex) {
    const hash = this.hashPath(videoPath);
    const cachePath = path.join(this.cacheDir, 'subtitles', `${hash}_${streamIndex}.vtt`);
    
    if (await this.exists(cachePath)) {
      return fs.readFile(cachePath, 'utf8');
    }
    
    return null;
  }

  // Nettoyage automatique (LRU - Least Recently Used)
  async ensureCacheSpace() {
    const currentSize = await this.getCacheSize();
    
    if (currentSize > this.maxCacheSize) {
      const files = await this.getAllCachedFiles();
      
      // Trier par date de dernier accès
      files.sort((a, b) => a.atime - b.atime);
      
      // Supprimer les plus vieux jusqu'à libérer 20% d'espace
      const targetSize = this.maxCacheSize * 0.8;
      let freedSpace = 0;
      
      for (const file of files) {
        if (currentSize - freedSpace < targetSize) break;
        
        await fs.unlink(file.path);
        freedSpace += file.size;
      }
    }
  }

  // Nettoyage des fichiers expirés
  async cleanExpired() {
    const files = await this.getAllCachedFiles();
    const now = Date.now();
    
    for (const file of files) {
      if (now - file.atime > this.ttl) {
        await fs.unlink(file.path);
      }
    }
  }
}
```

**Checklist de validation :**
- [ ] Les segments déjà transcodés sont servis depuis le cache (<10ms)
- [ ] Le cache ne dépasse jamais 50GB
- [ ] Les vieux fichiers sont supprimés automatiquement (LRU)
- [ ] Les métadonnées FFprobe sont mises en cache
- [ ] Les sous-titres convertis sont mis en cache

---

### Optimisation #3 : Gestion des erreurs et resilience
**Objectif** : Le système ne doit jamais crasher. Toute erreur doit être gérée gracieusement.

**Wrapper de resilience pour FFmpeg :**
```javascript
class ResilientFFmpeg {
  async runWithRetry(command, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.runFFmpeg(command);
      } catch (error) {
        console.error(`FFmpeg attempt ${i + 1} failed:`, error);
        
        if (i === maxRetries - 1) {
          // Dernière tentative échouée, envoyer une erreur utilisateur friendly
          throw new UserFriendlyError('VIDEO_PROCESSING_FAILED', {
            originalError: error,
            suggestion: 'Please try a different video or contact support'
          });
        }
        
        // Attendre avant de réessayer (exponential backoff)
        await this.sleep(Math.pow(2, i) * 1000);
      }
    }
  }

  async handleTranscodeError(error, videoPath) {
    // Diagnostiquer le type d'erreur
    if (error.message.includes('Invalid data found')) {
      return {
        type: 'CORRUPTED_FILE',
        message: 'The video file appears to be corrupted',
        recoverable: false
      };
    }
    
    if (error.message.includes('No space left')) {
      return {
        type: 'NO_SPACE',
        message: 'Server storage is full',
        recoverable: true,
        action: 'clean_cache'
      };
    }
    
    if (error.message.includes('codec')) {
      return {
        type: 'UNSUPPORTED_CODEC',
        message: 'Video codec not supported',
        recoverable: true,
        action: 'try_cpu_fallback'
      };
    }
    
    return {
      type: 'UNKNOWN',
      message: 'An unexpected error occurred',
      recoverable: false
    };
  }
}
```

**Gestion des erreurs côté frontend :**
```javascript
// Frontend : User-friendly error handling
class ErrorHandler {
  handleStreamingError(error, videoInfo) {
    switch(error.type) {
      case 'NETWORK_ERROR':
        return this.showRetryDialog('Network connection lost. Retry?');
      
      case 'VIDEO_PROCESSING_FAILED':
        return this.showErrorMessage(
          'Unable to play this video',
          'The video format may not be compatible. Try another video.'
        );
      
      case 'BUFFER_STALL':
        return this.showLoadingIndicator('Buffering...');
      
      case 'SUBTITLE_NOT_AVAILABLE':
        return this.disableSubtitleButton('Subtitles unavailable for this video');
      
      default:
        return this.showGenericError();
    }
  }

  async autoRecover(error) {
    // Tentatives de récupération automatique
    if (error.recoverable) {
      switch(error.action) {
        case 'retry':
          return await this.retryPlayback();
        
        case 'reduce_quality':
          return await this.switchToLowerQuality();
        
        case 'reload_player':
          return await this.reloadPlayer();
      }
    }
  }
}
```

**Checklist de validation :**
- [ ] Aucune erreur 500 non gérée
- [ ] Toutes les erreurs ont des messages utilisateur clairs
- [ ] Les erreurs transitoires sont retentées automatiquement
- [ ] Le player se remet d'une perte réseau temporaire
- [ ] Les logs d'erreur sont détaillés pour le debug

---

### Optimisation #4 : Monitoring et télémétrie
**Objectif** : Savoir en temps réel ce qui se passe sur le serveur et détecter les problèmes avant qu'ils n'impactent l'utilisateur.

**Système de monitoring :**
```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      transcoding: [],
      network: [],
      cache: [],
      errors: []
    };
  }

  recordTranscodeMetric(videoId, quality, duration, method) {
    this.metrics.transcoding.push({
      timestamp: Date.now(),
      videoId,
      quality,
      duration, // ms
      method, // 'vaapi' ou 'cpu'
      success: true
    });
  }

  recordError(context, error) {
    this.metrics.errors.push({
      timestamp: Date.now(),
      context,
      error: error.message,
      stack: error.stack
    });
  }

  getHealthStatus() {
    const recentErrors = this.getRecentErrors(5 * 60 * 1000); // 5 minutes
    const avgTranscodeTime = this.getAverageTranscodeTime();
    const cacheHitRate = this.getCacheHitRate();
    
    return {
      status: recentErrors.length > 10 ? 'unhealthy' : 'healthy',
      metrics: {
        errorRate: recentErrors.length,
        avgTranscodeTime,
        cacheHitRate,
        cpuUsage: await this.getCPUUsage(),
        memoryUsage: await this.getMemoryUsage()
      }
    };
  }

  // Endpoint pour Prometheus ou autre système de monitoring
  getPrometheusMetrics() {
    return `
# HELP leon_transcode_duration_seconds Time to transcode video segments
# TYPE leon_transcode_duration_seconds histogram
leon_transcode_duration_seconds_bucket{method="vaapi",le="1"} 150
leon_transcode_duration_seconds_bucket{method="vaapi",le="2"} 280
leon_transcode_duration_seconds_bucket{method="cpu",le="5"} 50

# HELP leon_cache_hit_rate Cache hit rate percentage
# TYPE leon_cache_hit_rate gauge
leon_cache_hit_rate ${this.getCacheHitRate()}

# HELP leon_active_streams Number of active streams
# TYPE leon_active_streams gauge
leon_active_streams ${this.getActiveStreamCount()}
    `.trim();
  }
}
```

**Dashboard de monitoring (optionnel mais recommandé) :**
```javascript
// Endpoint API pour le dashboard admin
app.get('/api/admin/metrics', async (req, res) => {
  const monitor = new PerformanceMonitor();
  
  res.json({
    health: await monitor.getHealthStatus(),
    streams: {
      active: monitor.getActiveStreamCount(),
      last24h: monitor.getStreamCount(24 * 60 * 60 * 1000)
    },
    cache: {
      size: await monitor.getCacheSize(),
      hitRate: monitor.getCacheHitRate(),
      files: await monitor.getCachedFileCount()
    },
    transcoding: {
      queue: monitor.getTranscodeQueueLength(),
      avgDuration: monitor.getAverageTranscodeTime(),
      method: monitor.getMostUsedMethod() // 'vaapi' ou 'cpu'
    },
    errors: {
      last24h: monitor.getRecentErrors(24 * 60 * 60 * 1000),
      byType: monitor.getErrorsByType()
    }
  });
});
```

**Checklist de validation :**
- [ ] Les métriques de performance sont enregistrées
- [ ] Un endpoint `/api/health` retourne le statut du serveur
- [ ] Les erreurs sont loggées avec contexte complet
- [ ] Dashboard admin accessible pour voir les stats en temps réel

---

## 3. ARCHITECTURE OPTIMALE

### Structure recommandée
```
leon/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── stream.js       # Endpoints streaming
│   │   │   │   ├── metadata.js     # Métadonnées des vidéos
│   │   │   │   ├── subtitles.js    # Gestion sous-titres
│   │   │   │   └── admin.js        # Dashboard admin
│   │   │   └── middleware/
│   │   │       ├── auth.js          # Authentification (optionnel)
│   │   │       ├── rateLimit.js     # Limitation de débit
│   │   │       └── errorHandler.js  # Gestion erreurs globale
│   │   ├── services/
│   │   │   ├── transcoder/
│   │   │   │   ├── HardwareTranscoder.js
│   │   │   │   ├── AdaptiveBuffer.js
│   │   │   │   └── QualityProfiles.js
│   │   │   ├── cache/
│   │   │   │   ├── CacheManager.js
│   │   │   │   └── CacheCleaner.js
│   │   │   ├── subtitles/
│   │   │   │   └── SubtitleHandler.js
│   │   │   └── monitoring/
│   │   │       └── PerformanceMonitor.js
│   │   ├── utils/
│   │   │   ├── ffmpeg.js
│   │   │   ├── ffprobe.js
│   │   │   └── fileSystem.js
│   │   └── config/
│   │       └── index.js              # Configuration centralisée
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Player/
│   │   │   │   ├── VideoPlayer.jsx
│   │   │   │   ├── Controls.jsx
│   │   │   │   ├── SubtitleSelector.jsx
│   │   │   │   └── QualitySelector.jsx
│   │   │   ├── Library/
│   │   │   │   ├── MovieGrid.jsx
│   │   │   │   └── MovieCard.jsx
│   │   │   └── Admin/
│   │   │       └── Dashboard.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── player.js
│   │   │   └── errorHandler.js
│   │   └── utils/
│   │       ├── bandwidth.js
│   │       └── hls.js
│   ├── Dockerfile
│   └── package.json
│
└── docker-compose.yml
```

---

## 4. PLAN D'IMPLÉMENTATION PAR PHASES

### Phase 1 : Stabilisation (Priorité CRITIQUE)
**Durée estimée** : 2-3 heures

**Objectifs :**
- [ ] Corriger les erreurs 500 sur les sous-titres
- [ ] Implémenter la gestion d'erreur robuste
- [ ] Ajouter des logs détaillés partout
- [ ] Tester que le système ne crash jamais

**Actions :**
1. Détecter le type de sous-titre avant conversion
2. Ignorer proprement les sous-titres image (ou implémenter OCR)
3. Wrapper tous les appels FFmpeg avec try/catch
4. Retourner des erreurs HTTP appropriées (404, 422, 500 avec message clair)
5. Tester avec plusieurs types de vidéos (MKV, MP4, AVI)

---

### Phase 2 : Performance (Priorité HAUTE)
**Durée estimée** : 3-4 heures

**Objectifs :**
- [ ] Implémenter l'accélération matérielle VAAPI
- [ ] Mettre en place le cache intelligent
- [ ] Optimiser les profils de qualité
- [ ] Réduire la charge CPU de 70% → 30%

**Actions :**
1. Configurer FFmpeg avec VAAPI
2. Créer les profils de qualité (1080p, 720p, 480p)
3. Implémenter le CacheManager
4. Tester la charge CPU avec `intel_gpu_top` et `htop`
5. Valider que le transcodage est 3x plus rapide

---

### Phase 3 : Fluidité (Priorité HAUTE)
**Durée estimée** : 3-4 heures

**Objectifs :**
- [ ] Implémenter le buffer adaptatif
- [ ] Supprimer l'attente fixe de 30s
- [ ] Ajouter le pré-chargement intelligent
- [ ] Obtenir une expérience fluide type Netflix

**Actions :**
1. Implémenter BandwidthDetector (frontend)
2. Implémenter AdaptiveBuffer (backend)
3. Calculer le buffer initial dynamiquement
4. Pré-transcoder les segments suivants
5. Tester avec différentes vitesses réseau simulées

---

### Phase 4 : Monitoring (Priorité MOYENNE)
**Durée estimée** : 2 heures

**Objectifs :**
- [ ] Ajouter la télémétrie
- [ ] Créer un dashboard admin simple
- [ ] Endpoint de health check
- [ ] Logs structurés

**Actions :**
1. Implémenter PerformanceMonitor
2. Créer l'endpoint `/api/admin/metrics`
3. Créer l'endpoint `/api/health`
4. Afficher les stats dans un dashboard React simple

---

### Phase 5 : Polish & UX (Priorité BASSE)
**Durée estimée** : 2-3 heures

**Objectifs :**
- [ ] Messages d'erreur user-friendly
- [ ] Indicateurs de chargement élégants
- [ ] Transitions fluides
- [ ] Récupération automatique des erreurs

**Actions :**
1. Améliorer les messages d'erreur frontend
2. Ajouter des animations de chargement
3. Implémenter l'auto-recovery pour erreurs transitoires
4. Tests utilisateur final

---

## 5. TESTS DE VALIDATION

### Checklist de tests complets

**Tests de streaming :**
- [ ] Lecture normale d'un film (1080p, 2h)
- [ ] Seeking (saut temporel) : avant, arrière, milieu
- [ ] Avance rapide (10s, 30s, 1min)
- [ ] Pause prolongée (5min) puis reprise
- [ ] Changement de qualité en cours de lecture
- [ ] Lecture de plusieurs films consécutifs

**Tests de sous-titres :**
- [ ] Vidéo avec sous-titres SRT (texte)
- [ ] Vidéo avec sous-titres ASS (texte)
- [ ] Vidéo avec sous-titres PGS (image) → doit ignorer proprement
- [ ] Vidéo sans sous-titres → ne doit pas crasher
- [ ] Changement de langue de sous-titres en cours de lecture

**Tests de performance :**
- [ ] Transcodage utilise GPU (< 50% CPU)
- [ ] Cache fonctionne (segments servis en <10ms la 2e fois)
- [ ] Pas de memory leak (RAM stable après 2h de lecture)
- [ ] Plusieurs utilisateurs simultanés (3-4 streams)

**Tests de résilience :**
- [ ] Coupure réseau temporaire (30s) → récupération auto
- [ ] Vidéo corrompue → erreur claire, pas de crash
- [ ] Disque plein → message clair, nettoyage cache
- [ ] Redémarrage serveur → les streams se reconnectent

**Tests de formats :**
- [ ] MP4 H.264
- [ ] MKV H.265
- [ ] AVI Xvid
- [ ] MOV ProRes (si applicable)
- [ ] Fichiers 4K (devrait downscale)

---

## 6. VARIABLES D'ENVIRONNEMENT

### Configuration recommandée
```bash
# docker-compose.yml ou .env
NODE_ENV=production

# Chemins
MEDIA_PATH=/app/media/films
CACHE_PATH=/app/cache
CONFIG_PATH=/app/config

# Transcodage
ENABLE_HARDWARE_ACCEL=true
VAAPI_DEVICE=/dev/dri/renderD128
DEFAULT_QUALITY=1080p
MAX_CONCURRENT_TRANSCODES=4

# Cache
CACHE_MAX_SIZE=50GB
CACHE_TTL=7d
CACHE_CLEANUP_INTERVAL=1h

# Buffer
DEFAULT_BUFFER_SIZE=15s
MIN_BUFFER_SIZE=10s
MAX_BUFFER_SIZE=60s

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090

# Logs
LOG_LEVEL=info
LOG_FORMAT=json
```

---

## 7. INDICATEURS DE SUCCÈS

Le projet sera considéré comme "parfaitement fonctionnel, optimisé et fluide" quand :

### Performance
- [ ] Charge CPU < 40% pendant streaming 1080p
- [ ] Temps de démarrage vidéo < 10s
- [ ] Cache hit rate > 60% après 1 semaine d'utilisation
- [ ] Support de 3-4 streams simultanés sans dégradation

### Stabilité
- [ ] Zéro crash sur 48h de tests continus
- [ ] Tous les formats vidéo courants lisibles
- [ ] Gestion gracieuse de 100% des erreurs
- [ ] Logs clairs et traçables

### Expérience utilisateur
- [ ] Aucune interruption de lecture (0 rebuffering)
- [ ] Seeking instantané (< 2s)
- [ ] Interface réactive (< 100ms)
- [ ] Messages d'erreur compréhensibles

### Maintenabilité
- [ ] Code documenté et structuré
- [ ] Tests automatisés en place
- [ ] Monitoring fonctionnel
- [ ] Déploiement reproductible

---

## 8. RESSOURCES TECHNIQUES

### Documentation FFmpeg
- VAAPI : https://trac.ffmpeg.org/wiki/Hardware/VAAPI
- HLS : https://trac.ffmpeg.org/wiki/EncodingForStreamingSites
- Filters : https://ffmpeg.org/ffmpeg-filters.html

### Librairies utiles
- **fluent-ffmpeg** : Wrapper Node.js pour FFmpeg
- **hls.js** : Player HLS côté frontend
- **video.js** : Player vidéo complet avec plugins
- **sharp** : Traitement d'images (thumbnails)
- **tesseract.js** : OCR pour sous-titres image (optionnel)

### Outils de monitoring
- **node-exporter** : Métriques système
- **grafana** : Dashboards (optionnel)
- **winston** : Logging structuré

---

**Dernière mise à jour** : 22 novembre 2025, 17:30 EST  
**Statut** : Prêt pour diagnostic et optimisation avec Cursor

---

## INSTRUCTIONS POUR CURSOR

1. **Analyse du code existant**
   - Identifier les composants qui correspondent aux problèmes décrits
   - Repérer les parties du code qui gèrent le transcodage, les sous-titres, le buffering
   - Lister les dépendances actuelles

2. **Priorisation**
   - Commencer par la Phase 1 (Stabilisation) pour éviter les crashs
   - Puis Phase 2 (Performance) pour l'accélération matérielle
   - Puis Phase 3 (Fluidité) pour l'expérience utilisateur

3. **Implémentation**
   - Suivre les exemples de code fournis
   - Adapter à l'architecture existante
   - Maintenir la cohérence du style de code
   - Documenter les changements importants

4. **Validation**
   - Tester chaque phase indépendamment
   - Utiliser les checklists de validation
   - Mesurer les améliorations (benchmarks avant/après)

5. **Questions à poser si besoin**
   - Quelle est la structure exacte du code actuel ?
   - Y a-t-il des contraintes techniques non mentionnées ?
   - Quel est le niveau de priorité de chaque optimisation ?
   - Faut-il garder la rétrocompatibilité avec d'anciens browsers ?
