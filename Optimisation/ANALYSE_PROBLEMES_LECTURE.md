# 🔍 ANALYSE APPROFONDIE - PROBLÈMES DE LECTURE LEON

## 📊 PROBLÈMES IDENTIFIÉS

### 🚨 CRITIQUE #1 : Buffer Management Inadéquat

**Localisation** : `components/SimpleVideoPlayer/SimpleVideoPlayer.tsx` (lignes ~520-540)

**Symptôme** :
- Lecture qui démarre trop tôt
- Vidéo qui freeze dès que le buffer est consommé
- Attente arbitraire de 30 secondes sans adaptation

**Code Problématique** :
```typescript
const minBufferSeconds = 30 // ❌ Valeur fixe, pas adaptatif
const bufferCheckInterval = setInterval(() => {
  if (video.buffered.length > 0) {
    const bufferedEnd = video.buffered.end(0)
    const bufferedStart = video.buffered.start(0)
    const bufferedDuration = bufferedEnd - bufferedStart
    
    if (bufferedDuration >= minBufferSeconds) {
      clearInterval(bufferCheckInterval)
      setBufferReady(true) // ⚠️ Débloque trop tôt
      setIsLoading(false)
      tryAutoplay()
    }
  }
}, 1000) // ❌ Check toutes les secondes = trop lent

// ❌ Timeout forcé après 30s même si buffer insuffisant
setTimeout(() => {
  clearInterval(bufferCheckInterval)
  setBufferReady(true)
  setIsLoading(false)
  tryAutoplay()
}, 30000)
```

**Impact** :
- UX dégradée : utilisateur voit un loader puis la vidéo freeze
- Pas de visibilité sur l'état réel du transcodage FFmpeg
- Timeout qui force la lecture même si FFmpeg est en retard

---

### 🚨 CRITIQUE #2 : Configuration HLS.js Sous-Optimale

**Localisation** : `components/SimpleVideoPlayer/SimpleVideoPlayer.tsx` (lignes ~380-395)

**Code Problématique** :
```typescript
const hls = new Hls({
  enableWorker: true,
  lowLatencyMode: false,
  backBufferLength: 90,        // ⚠️ Conserve 90s en arrière
  maxBufferLength: 300,         // ❌ Trop élevé pour streaming en temps réel
  maxMaxBufferLength: 600,      // ❌ 10 minutes = excessive
  maxBufferSize: 120 * 1000 * 1000, // ❌ 120MB = trop
  maxBufferHole: 0.5,
  manifestLoadingTimeOut: 60000,
  manifestLoadingMaxRetry: 6,
  manifestLoadingRetryDelay: 1000,
  levelLoadingTimeOut: 30000,
  levelLoadingMaxRetry: 4,
  levelLoadingRetryDelay: 1000,
  fragLoadingTimeOut: 30000,    // ❌ 30s pour charger un segment = trop long
  fragLoadingMaxRetry: 6,
  fragLoadingRetryDelay: 1000,
  startFragPrefetch: false      // ❌ Devrait être TRUE pour Netflix-like
})
```

**Problèmes** :
1. **Buffer trop agressif** : 600s max = 10 minutes de vidéo en RAM
2. **Pas de prefetch** : segments chargés à la demande = latence
3. **Timeouts trop longs** : 30s pour un fragment = user attend trop
4. **Pas d'adaptation dynamique** : paramètres fixes quelle que soit la connexion

---

### 🚨 CRITIQUE #3 : Manque de Communication FFmpeg ↔ Player

**Localisation** : Pas de bridge entre `/api/hls` et le lecteur

**Symptôme** :
- Le player ne sait pas où en est FFmpeg
- Pas de feedback sur le nombre de segments prêts
- Impossible de précharger intelligemment

**Code Manquant** :
- ❌ Pas d'endpoint pour connaître l'état du transcodage
- ❌ Pas de WebSocket pour push updates temps réel
- ❌ Pas de métadonnées sur les segments disponibles

**Impact** :
- Le player devine quand lancer la lecture (= aléatoire)
- Pas d'optimisation basée sur l'avancement réel FFmpeg
- Impossible de faire du "buffer prédictif"

---

### 🚨 CRITIQUE #4 : Gestion d'Erreurs Brutale

**Localisation** : `components/SimpleVideoPlayer/SimpleVideoPlayer.tsx` (lignes ~590-615)

**Code Problématique** :
```typescript
case Hls.ErrorTypes.NETWORK_ERROR:
  console.log('🔄 Tentative de récupération réseau...')
  if (hls.loadLevel > 0 && hls.levels.length > 1) {
    hls.currentLevel = hls.loadLevel - 1 // ⚠️ Downgrade qualité
  } else {
    hls.startLoad() // ❌ Rechargement sans délai
  }
  break

default:
  // ❌ Rechargement COMPLET après 3s pour toute erreur fatale
  setTimeout(() => {
    hls.destroy()
    const newHls = new Hls({ /* ... config ... */ })
    hlsRef.current = newHls
    newHls.loadSource(currentVideoUrl.current)
    newHls.attachMedia(video)
  }, 3000)
  break
```

**Problèmes** :
1. **Pas de retry intelligent** : rechargement brutal au lieu de retry graduel
2. **Pas de distinction des erreurs** : même traitement pour timeout que pour 404
3. **Perte de contexte** : détruit HLS.js et repart de zéro = perte de buffer
4. **Pas de feedback utilisateur** : erreur silencieuse

---

### 🚨 CRITIQUE #5 : Segments HLS Trop Longs

**Localisation** : `/app/api/hls/route.ts` (ligne ~170)

**Code** :
```typescript
'-hls_time', '4', // ❌ Segments de 4 secondes
```

**Problème** :
- 4 secondes = bon compromis général
- Mais pour "Netflix-like", on préfère **2 secondes** pour :
  - Démarrage plus rapide (moins à attendre pour le 1er segment)
  - Seeking plus précis
  - Meilleure adaptabilité réseau

---

### 🚨 CRITIQUE #6 : Pas de Preload Stratégique

**Localisation** : `components/SimpleVideoPlayer/SimpleVideoPlayer.tsx`

**Manque** :
- ❌ Pas de preload du segment suivant pendant la lecture
- ❌ Pas de cache intelligent des segments déjà lus
- ❌ Pas de priorisation (ex: précharger les 10 premières secondes en priorité)

**Impact** :
- Latence au seeking (doit attendre le segment)
- Pauses fréquentes si connexion fluctue
- Pas de "smooth experience" comme Netflix

---

## 🎯 SOLUTIONS CONCRÈTES

### ✅ SOLUTION #1 : Buffer Management Intelligent

**Nouveau code** :
```typescript
// 🧠 Stratégie adaptative basée sur l'état réel FFmpeg
const INITIAL_BUFFER_TARGET = 10 // Démarrage rapide
const SAFE_BUFFER_TARGET = 20    // Buffer confortable
const SEGMENT_DURATION = 2       // Durée d'un segment HLS

const [bufferStatus, setBufferStatus] = useState({
  ready: false,
  bufferedSeconds: 0,
  targetSeconds: INITIAL_BUFFER_TARGET,
  ffmpegProgress: 0 // Pourcentage de transcodage FFmpeg
})

// 📊 Vérifier l'état du transcodage FFmpeg
const checkFFmpegProgress = async () => {
  try {
    const res = await fetch(`/api/hls/status?path=${encodeURIComponent(filepath)}`)
    const data = await res.json()
    return {
      segmentsReady: data.segmentsReady,
      totalSegments: data.totalSegments,
      isComplete: data.isComplete
    }
  } catch (err) {
    console.warn('Impossible de récupérer l\'état FFmpeg')
    return null
  }
}

// 🚀 Buffer check optimisé (check toutes les 250ms au lieu de 1s)
useEffect(() => {
  if (!videoRef.current || bufferStatus.ready) return
  
  const video = videoRef.current
  let checkCount = 0
  
  const bufferInterval = setInterval(async () => {
    checkCount++
    
    // Check buffer local
    let bufferedSeconds = 0
    if (video.buffered.length > 0) {
      bufferedSeconds = video.buffered.end(0) - video.buffered.start(0)
    }
    
    // Check état FFmpeg (toutes les 2 secondes seulement)
    let ffmpegState = null
    if (checkCount % 8 === 0) { // 8 * 250ms = 2s
      ffmpegState = await checkFFmpegProgress()
    }
    
    // 🧠 Décision intelligente
    const canStart = (
      bufferedSeconds >= INITIAL_BUFFER_TARGET || // Minimum 10s
      (ffmpegState?.segmentsReady >= 10) ||        // Ou 10 segments prêts
      (ffmpegState?.isComplete && bufferedSeconds >= 5) // Ou vidéo complète + 5s
    )
    
    if (canStart) {
      clearInterval(bufferInterval)
      setBufferStatus({ 
        ready: true, 
        bufferedSeconds,
        targetSeconds: SAFE_BUFFER_TARGET,
        ffmpegProgress: ffmpegState?.segmentsReady || 0
      })
      setIsLoading(false)
      tryAutoplay()
    }
    
    // 🚨 Timeout de sécurité: 60s au lieu de 30s
    if (checkCount >= 240) { // 240 * 250ms = 60s
      clearInterval(bufferInterval)
      console.warn('⏰ Timeout buffer, lancement forcé')
      setBufferStatus({ ready: true, bufferedSeconds, targetSeconds: 5, ffmpegProgress: 0 })
      setIsLoading(false)
      tryAutoplay()
    }
  }, 250) // ✅ Check rapide (4x par seconde)
  
  return () => clearInterval(bufferInterval)
}, [videoRef.current, bufferStatus.ready])
```

---

### ✅ SOLUTION #2 : Configuration HLS.js Optimisée Netflix-Style

**Nouveau code** :
```typescript
const hlsConfig = {
  // 🎯 Performance & Rapidité
  enableWorker: true,
  lowLatencyMode: false, // true = pour live, false = pour VOD
  
  // 📦 Buffer Management Optimisé
  backBufferLength: 30,              // ✅ 30s en arrière (au lieu de 90)
  maxBufferLength: 60,               // ✅ 1 minute ahead (au lieu de 5 min)
  maxMaxBufferLength: 120,           // ✅ 2 minutes max (au lieu de 10 min)
  maxBufferSize: 30 * 1000 * 1000,  // ✅ 30MB (au lieu de 120MB)
  maxBufferHole: 0.3,                // ✅ Tolérance 300ms (au lieu de 500ms)
  
  // 🚀 Prefetch & Chargement Proactif
  startFragPrefetch: true,           // ✅ ACTIVER prefetch
  progressive: true,                 // ✅ Lecture progressive pendant téléchargement
  
  // ⏱️ Timeouts Agressifs
  manifestLoadingTimeOut: 10000,     // ✅ 10s pour manifest (au lieu de 60s)
  manifestLoadingMaxRetry: 3,        // ✅ 3 essais (au lieu de 6)
  manifestLoadingRetryDelay: 500,    // ✅ 500ms entre essais (au lieu de 1s)
  
  levelLoadingTimeOut: 10000,        // ✅ 10s pour level
  levelLoadingMaxRetry: 3,
  levelLoadingRetryDelay: 500,
  
  fragLoadingTimeOut: 10000,         // ✅ 10s pour fragment (au lieu de 30s)
  fragLoadingMaxRetry: 4,            // ✅ 4 essais
  fragLoadingRetryDelay: 300,        // ✅ 300ms entre essais
  
  // 🎬 Démarrage Optimisé
  startLevel: -1,                    // Auto-select qualité optimale
  capLevelToPlayerSize: true,        // Adapter à la taille du player
  
  // 🔄 Recovery & Erreurs
  liveSyncDurationCount: 3,
  liveMaxLatencyDurationCount: 10,
  
  // 📊 Debug (désactiver en production)
  debug: false,
  
  // 🎯 ABR (Adaptive Bitrate) - pour futur multi-qualité
  abrEwmaDefaultEstimate: 500000,    // Estimation initiale 500kbps
  abrBandWidthFactor: 0.95,          // Marge de sécurité 5%
  abrBandWidthUpFactor: 0.7          // Upgrade si bande passante > 70%
}

const hls = new Hls(hlsConfig)
```

---

### ✅ SOLUTION #3 : API Status FFmpeg

**Nouveau fichier** : `/app/api/hls/status/route.ts`

```typescript
/**
 * API: État du transcodage HLS
 * GET /api/hls/status?path=/video.mkv
 * Retourne l'avancement temps réel du transcodage FFmpeg
 */

import { NextRequest, NextResponse } from 'next/server'
import { readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'

const HLS_TEMP_DIR = '/tmp/leon-hls'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const filepath = searchParams.get('path')
  
  if (!filepath) {
    return NextResponse.json({ error: 'path manquant' }, { status: 400 })
  }
  
  try {
    // Générer le hash de la session (même logique que /api/hls)
    const sessionHash = crypto
      .createHash('md5')
      .update(filepath)
      .digest('hex')
    
    const sessionDir = path.join(HLS_TEMP_DIR, sessionHash)
    
    // Vérifier si la session existe
    if (!existsSync(sessionDir)) {
      return NextResponse.json({
        exists: false,
        segmentsReady: 0,
        totalSegments: 0,
        isComplete: false,
        message: 'Transcodage non démarré'
      })
    }
    
    // Lister les segments .ts disponibles
    const files = await readdir(sessionDir)
    const segments = files.filter(f => f.endsWith('.ts'))
    const hasPlaylist = files.includes('playlist.m3u8')
    
    // Vérifier si le transcodage est terminé (présence d'un fichier .done)
    const isComplete = files.includes('.done')
    
    // Estimer le nombre total de segments (si disponible)
    let totalSegments = 0
    if (hasPlaylist) {
      const playlistPath = path.join(sessionDir, 'playlist.m3u8')
      const playlistContent = await readFile(playlistPath, 'utf-8')
      const segmentLines = playlistContent.split('\n').filter(line => line.endsWith('.ts'))
      totalSegments = segmentLines.length
    }
    
    return NextResponse.json({
      exists: true,
      segmentsReady: segments.length,
      totalSegments: totalSegments || segments.length,
      isComplete,
      hasPlaylist,
      progress: totalSegments > 0 ? (segments.length / totalSegments) * 100 : 0,
      sessionDir
    })
    
  } catch (error) {
    console.error('Erreur status FFmpeg:', error)
    return NextResponse.json({ 
      error: 'Erreur lors de la vérification du status',
      exists: false,
      segmentsReady: 0
    }, { status: 500 })
  }
}
```

**Modification dans** `/app/api/hls/route.ts` :
```typescript
// Après le spawn de FFmpeg, créer un fichier .done quand c'est terminé
ffmpeg.on('close', async (code) => {
  if (code === 0) {
    // Créer un fichier .done pour indiquer que c'est terminé
    await writeFile(path.join(sessionDir, '.done'), '')
    console.log('✅ Transcodage terminé')
  }
})
```

---

### ✅ SOLUTION #4 : Gestion d'Erreurs Intelligente

**Nouveau code** :
```typescript
// 🛡️ Système de retry graduel au lieu de destroy brutal
const [retryCount, setRetryCount] = useState(0)
const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 3000, 5000] // Délais progressifs

hls.on(Hls.Events.ERROR, (event, data) => {
  console.error('❌ Erreur HLS:', data)
  
  if (data.fatal) {
    switch(data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        console.log('🔄 Erreur réseau, tentative de récupération...')
        
        if (retryCount < MAX_RETRIES) {
          // 🎯 Retry graduel sans détruire HLS
          const delay = RETRY_DELAYS[retryCount] || 5000
          console.log(`⏳ Retry ${retryCount + 1}/${MAX_RETRIES} dans ${delay}ms`)
          
          setTimeout(() => {
            if (data.details === 'manifestLoadError') {
              hls.loadSource(currentVideoUrl.current) // Recharger manifest
            } else {
              hls.startLoad() // Reprendre chargement
            }
            setRetryCount(prev => prev + 1)
          }, delay)
        } else {
          // ❌ Échec après MAX_RETRIES
          console.error('💀 Échec définitif après 3 tentatives')
          setError('Impossible de charger la vidéo. Vérifiez votre connexion.')
          setIsLoading(false)
        }
        break
        
      case Hls.ErrorTypes.MEDIA_ERROR:
        console.log('🔄 Erreur média, tentative de récupération...')
        if (retryCount < MAX_RETRIES) {
          hls.recoverMediaError() // Tentative de récupération native
          setRetryCount(prev => prev + 1)
        } else {
          console.log('🔄 Rechargement complet du lecteur...')
          // Seulement maintenant on détruit et recrée
          reloadPlayer()
        }
        break
        
      default:
        console.log('❌ Erreur fatale non gérée')
        setError(`Erreur de lecture: ${data.details}`)
        setIsLoading(false)
        break
    }
  } else if (data.details === 'bufferStalledError') {
    console.log('⏳ Buffer en attente, pas critique')
    // Pas d'action, juste logger
  }
})

// 🔄 Fonction de rechargement complet (dernier recours)
const reloadPlayer = useCallback(() => {
  if (!videoRef.current || !hlsRef.current) return
  
  const currentTime = videoRef.current.currentTime
  const wasPlaying = !videoRef.current.paused
  
  // Détruire proprement
  hlsRef.current.destroy()
  
  // Recréer HLS avec config optimisée
  const newHls = new Hls(hlsConfig)
  hlsRef.current = newHls
  
  newHls.loadSource(currentVideoUrl.current)
  newHls.attachMedia(videoRef.current)
  
  // Restaurer la position
  newHls.on(Hls.Events.MANIFEST_PARSED, () => {
    videoRef.current!.currentTime = currentTime
    if (wasPlaying) {
      videoRef.current!.play()
    }
  })
  
  setRetryCount(0) // Reset compteur
}, [videoRef.current, hlsRef.current])
```

---

### ✅ SOLUTION #5 : Segments HLS Optimisés

**Modification dans** `/app/api/hls/route.ts` :
```typescript
// Changer de 4s à 2s pour meilleure réactivité
'-hls_time', '2', // ✅ Segments de 2 secondes (Netflix-like)
'-hls_list_size', '0', // Garder tous les segments dans le manifest
'-hls_flags', 'independent_segments+temp_file', // Flags optimisés
```

---

### ✅ SOLUTION #6 : Preload Stratégique

**Nouveau code** :
```typescript
// 🚀 Préchargement intelligent des segments suivants
useEffect(() => {
  if (!videoRef.current || !hlsRef.current) return
  
  const video = videoRef.current
  const hls = hlsRef.current
  
  // 📊 Surveiller la position de lecture
  const handleTimeUpdate = () => {
    if (!video.buffered.length) return
    
    const currentTime = video.currentTime
    const bufferedEnd = video.buffered.end(video.buffered.length - 1)
    const bufferAhead = bufferedEnd - currentTime
    
    // 🎯 Si moins de 10s de buffer devant, précharger plus
    if (bufferAhead < 10 && bufferAhead > 0) {
      console.log(`⚠️ Buffer faible: ${bufferAhead.toFixed(1)}s, préchargement...`)
      // HLS.js va automatiquement charger plus si startFragPrefetch: true
    }
    
    // 📈 Logger l'état du buffer pour debug
    console.log(`📊 Buffer: ${bufferAhead.toFixed(1)}s devant | Position: ${currentTime.toFixed(1)}s`)
  }
  
  video.addEventListener('timeupdate', handleTimeUpdate)
  
  return () => video.removeEventListener('timeupdate', handleTimeUpdate)
}, [videoRef.current, hlsRef.current])

// 🎯 Précharger les 3 prochains segments au démarrage
hls.on(Hls.Events.MANIFEST_PARSED, () => {
  console.log('📦 Manifest parsé, préchargement des 3 premiers segments...')
  hls.startLoad(0) // Commencer à charger depuis le début
})
```

---

## 📈 RÉSULTATS ATTENDUS

### Avant Optimisation
- ⏳ Attente arbitraire de 30s
- 🐌 Démarrage lent et imprévisible
- ❌ Pauses fréquentes pendant la lecture
- 🔄 Rechargements complets brutaux
- 💾 Consommation RAM excessive (600s buffer)

### Après Optimisation
- ✅ Démarrage en 10-15s maximum (au lieu de 30s)
- ✅ Lecture fluide sans interruption
- ✅ Retry intelligent sans perte de contexte
- ✅ Consommation RAM réduite de 80% (60s buffer au lieu de 600s)
- ✅ UX "Netflix-like" : impression de streaming instantané

---

## 🎯 PLAN D'IMPLÉMENTATION PRIORITAIRE

### Phase 1 : Quick Wins (30 min)
1. ✅ Changer segments HLS de 4s → 2s
2. ✅ Activer `startFragPrefetch: true`
3. ✅ Réduire `maxBufferLength` de 300 → 60s

### Phase 2 : Buffer Management (1h)
1. ✅ Implémenter buffer check adaptatif (250ms)
2. ✅ Ajouter logique de décision intelligente
3. ✅ Augmenter timeout à 60s

### Phase 3 : API Status (1h)
1. ✅ Créer `/api/hls/status/route.ts`
2. ✅ Ajouter fichier `.done` dans FFmpeg
3. ✅ Intégrer check status dans le player

### Phase 4 : Gestion Erreurs (45 min)
1. ✅ Implémenter retry graduel
2. ✅ Ajouter states d'erreur utilisateur
3. ✅ Logger détaillé pour debug

### Phase 5 : Polish UX (30 min)
1. ✅ Ajouter indicateur de buffer visuel
2. ✅ Améliorer loader (pourcentage)
3. ✅ Messages d'erreur explicites

---

## 🧪 TESTS À EFFECTUER

### Scénarios Critiques
1. **Connexion lente** : Simuler 1 Mbps, vérifier fluidité
2. **Connexion intermittente** : Couper/rétablir, vérifier recovery
3. **Seeking agressif** : Sauter toutes les 5s, vérifier réactivité
4. **Changement audio dynamique** : Vérifier continuité
5. **Multi-tabs** : Ouvrir 3 vidéos, vérifier limite FFmpeg (2 max)

### Métriques à Mesurer
- **Time to First Frame** : < 15s
- **Rebuffering Ratio** : < 1%
- **Startup Latency** : < 10s
- **RAM Usage** : < 200MB par vidéo
- **CPU Usage FFmpeg** : < 150% (1.5 core)

---

## 🎬 CONCLUSION

Les problèmes actuels viennent de **3 facteurs principaux** :

1. **Buffer management arbitraire** : décisions basées sur du timing fixe au lieu de l'état réel
2. **Configuration HLS.js générique** : pas optimisée pour le use case spécifique
3. **Manque de communication FFmpeg ↔ Player** : aucune visibilité sur l'avancement

Les solutions proposées transformeront l'expérience de **"ça rame"** vers **"c'est fluide"**, en adoptant les meilleures pratiques de Netflix/YouTube :
- Démarrage rapide avec buffer minimal intelligent
- Préchargement proactif
- Retry sans perte de contexte
- Feedback utilisateur transparent

**Prochaine étape** : Implémentation phase par phase avec tests continus.
