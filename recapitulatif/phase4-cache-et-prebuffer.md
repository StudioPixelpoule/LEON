# Phase 4 - Cache Intelligent & Préchargement

**Date** : 23 novembre 2025  
**Statut** : ✅ Terminé

## 🎯 Objectifs

Améliorer drastiquement les performances de lecture en :
1. **Cachant les segments transcodés** pour réutilisation
2. **Préchargeant intelligemment** les segments suivants
3. **Affichant le statut du buffer** pour debug/monitoring

## 📦 Implémentations

### 1. Système de Cache Intelligent

**Fichier** : `lib/segment-cache.ts`

**Fonctionnalités** :
- ✅ Cache sur disque des segments HLS transcodés (`/tmp/leon-segment-cache`)
- ✅ Clé de cache unique basée sur : filepath + audioTrack + segmentIndex + codec + résolution
- ✅ Organisation hiérarchique (sous-dossiers par hash)
- ✅ LRU (Least Recently Used) pour suppression intelligente
- ✅ Limite de taille configurable (10GB par défaut)
- ✅ Nettoyage automatique des segments > 7 jours
- ✅ Statistiques détaillées (taille, nombre de fichiers, etc.)

**API Routes** :
- `GET /api/cache/stats` - Récupérer les statistiques du cache
- `POST /api/cache/clear` - Vider le cache complètement

### 2. Intégration Cache dans HLS

**Fichier** : `app/api/hls/route.ts`

**Modifications** :
```typescript
// Import du cache
import { getCacheInstance } from '@/lib/segment-cache'

// Vérifier le cache AVANT de lire depuis sessionDir
const cachedPath = await cache.get({
  filepath,
  audioTrack,
  segmentIndex,
  videoCodec: hardware.encoder,
  resolution: '1080p'
})

if (cachedPath) {
  // Segment trouvé en cache !
  return new NextResponse(segmentData, {
    headers: {
      'X-Cache': 'HIT' // Header pour debug
    }
  })
}

// Sauvegarder en cache après transcodage
cache.set({ ... }, segmentPath).catch(err => { ... })
```

**Avantages** :
- Premier visionnage : transcodage normal
- Visionnages suivants : **segments servis instantanément depuis le cache**
- Économie massive de CPU et temps

### 3. Préchargement Intelligent

**Fichier** : `lib/segment-preloader.ts`

**Fonctionnalités** :
- ✅ Détection automatique du segment en cours
- ✅ Préchargement des N segments suivants (défaut: 3 = 6 secondes)
- ✅ Limitation des requêtes simultanées (défaut: 2)
- ✅ Nettoyage automatique des tâches anciennes
- ✅ Utilisation du cache navigateur

**Configuration** :
```typescript
const preloader = new SegmentPreloader({
  lookaheadSegments: 3, // Précharger 3 segments (6s à 2s/segment)
  maxConcurrent: 2 // 2 requêtes parallèles max
})
```

**Intégration Player** : `components/SimpleVideoPlayer/SimpleVideoPlayer.tsx`
```typescript
// Initialisation
const preloaderRef = useRef<SegmentPreloader | null>(null)

// Mise à jour à chaque timeupdate
const currentSegmentIndex = Math.floor(currentPos / 2) // Segments de 2s
preloaderRef.current.updateCurrentSegment(currentSegmentIndex)
```

### 4. Affichage Buffer Status

**Fichier** : `lib/hooks/useBufferStatus.ts`

**Hook React** :
```typescript
const { bufferStatus } = useBufferStatus(
  getFilepath(), 
  getAudioTrack(), 
  isPlaying && isRemuxing // Activer seulement pendant le HLS remuxing
)
```

**Affichage dans le player** :
- Position : Bas à droite (discret)
- Métriques affichées :
  - Vitesse de transcodage (ex: 2.3x)
  - Niveau du buffer (ex: 8.5s)
  - Avertissement si buffering nécessaire

**Style** : Minimaliste, monospace, fond semi-transparent avec blur

### 5. Adaptive Buffer (Phase 3)

**Fichier** : `app/api/buffer-status/route.ts`

**API Route** :
```typescript
GET /api/buffer-status?path=...&audio=...
```

Retourne le statut en temps réel du buffer adaptatif :
```json
{
  "sessionId": "...",
  "bufferStatus": {
    "needsBuffering": false,
    "currentSpeed": 2.3,
    "targetSpeed": 2.5,
    "bufferLevel": 8.5,
    "minBuffer": 5
  }
}
```

## 📊 Bénéfices Attendus

### Première lecture (cold start)
- Transcodage : ~5-10s avant démarrage
- Préchargement : Pas de buffering après démarrage

### Lectures suivantes (cache chaud)
- Segments servis instantanément depuis cache
- **Démarrage quasi-instantané** (< 1s)
- Pas de CPU utilisé (pas de transcodage)

### Expérience utilisateur
- Buffer status visible pour debug
- Pas d'interruptions pendant la lecture
- Changement de langue plus fluide

## 🧪 Tests à effectuer

1. **Cache** :
   - [ ] Premier visionnage d'un film → segments mis en cache
   - [ ] Second visionnage → vérifier `X-Cache: HIT` dans les headers
   - [ ] `/api/cache/stats` → vérifier la taille du cache

2. **Préchargement** :
   - [ ] Ouvrir les DevTools Network
   - [ ] Lancer un film
   - [ ] Observer les segments préchargés en avance

3. **Buffer Status** :
   - [ ] Vérifier l'affichage en bas à droite pendant le transcodage
   - [ ] Observer la vitesse de transcodage et le niveau du buffer

4. **Performance** :
   - [ ] Mesurer le temps de démarrage (1ère vs 2ème lecture)
   - [ ] Vérifier l'utilisation CPU (doit être nulle sur cache hit)

## 📁 Fichiers créés/modifiés

### Nouveaux fichiers
- `lib/segment-cache.ts` - Système de cache
- `lib/segment-preloader.ts` - Préchargement intelligent
- `lib/hooks/useBufferStatus.ts` - Hook React pour buffer status
- `app/api/cache/stats/route.ts` - API stats cache
- `app/api/cache/clear/route.ts` - API clear cache
- `app/api/buffer-status/route.ts` - API buffer status

### Fichiers modifiés
- `app/api/hls/route.ts` - Intégration cache
- `components/SimpleVideoPlayer/SimpleVideoPlayer.tsx` - Préchargement + affichage buffer
- `components/SimpleVideoPlayer/SimpleVideoPlayer.module.css` - Styles buffer status

## 🔧 Configuration

### Variables d'environnement
Aucune nouvelle variable requise. Tout est configuré en dur :
- Cache dir : `/tmp/leon-segment-cache`
- Max cache size : 10GB
- Max cache age : 7 jours
- Lookahead segments : 3
- Max concurrent preloads : 2

### Optimisations futures possibles
1. Rendre la taille du cache configurable via env
2. Implémenter un cache partagé Redis pour multi-instances
3. Précharger plus intelligemment selon la bande passante détectée
4. Compression des segments en cache (gzip)

## 🚀 Prochaines étapes

**Phase 5 - Déploiement NAS & Tests de charge** :
1. Déployer sur Synology NAS
2. Tester Intel Quick Sync vs VideoToolbox
3. Mesurer les gains de performance réels
4. Ajuster les paramètres de cache selon utilisation

---

**Conclusion Phase 4** : Cache et préchargement implémentés avec succès. L'expérience utilisateur devrait être significativement améliorée, surtout pour les visionnages répétés. 🎉


