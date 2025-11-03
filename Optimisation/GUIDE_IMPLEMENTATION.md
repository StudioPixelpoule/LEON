# 🚀 GUIDE D'IMPLÉMENTATION - OPTIMISATION LECTURE NETFLIX-LIKE

## 📋 PRÉREQUIS

- [ ] Backup du projet actuel
- [ ] Environnement de test fonctionnel
- [ ] Accès à un fichier vidéo de test (MKV ou AVI)
- [ ] Console navigateur ouverte pour vérifier les logs

---

## 🎯 PHASE 1 : QUICK WINS (30 minutes)

### ✅ Étape 1.1 : Optimiser les segments HLS

**Fichier** : `app/api/hls/route.ts`

1. Chercher la ligne contenant `-hls_time`
2. Remplacer :
   ```typescript
   '-hls_time', '4',
   ```
   par :
   ```typescript
   '-hls_time', '2',  // Segments de 2s pour démarrage plus rapide
   '-hls_list_size', '0',
   '-hls_flags', 'independent_segments+temp_file',
   ```

**Test** :
```bash
# Lancer une vidéo, vérifier les segments
ls -lh /tmp/leon-hls/<session>/
# Doit montrer des segments de ~2s
```

---

### ✅ Étape 1.2 : Activer le prefetch HLS.js

**Fichier** : `components/SimpleVideoPlayer/SimpleVideoPlayer.tsx`

1. Chercher la configuration HLS (ligne ~380)
2. Modifier :
   ```typescript
   startFragPrefetch: false  // ❌ AVANT
   ```
   par :
   ```typescript
   startFragPrefetch: true   // ✅ APRÈS
   ```

**Test** :
```bash
# Ouvrir Console → Network
# Vérifier que les segments sont préchargés avant d'être lus
```

---

### ✅ Étape 1.3 : Réduire le buffer max

**Fichier** : `components/SimpleVideoPlayer/SimpleVideoPlayer.tsx`

1. Chercher la configuration HLS
2. Modifier :
   ```typescript
   maxBufferLength: 300,      // ❌ AVANT (5 minutes)
   maxMaxBufferLength: 600,   // ❌ AVANT (10 minutes)
   ```
   par :
   ```typescript
   maxBufferLength: 60,       // ✅ APRÈS (1 minute)
   maxMaxBufferLength: 120,   // ✅ APRÈS (2 minutes)
   ```

**Test** :
```bash
# Ouvrir Console → Memory
# Vérifier que l'usage RAM est réduit (~30MB au lieu de 120MB)
```

---

## 🧠 PHASE 2 : BUFFER MANAGEMENT INTELLIGENT (1 heure)

### ✅ Étape 2.1 : Créer l'API de status FFmpeg

**Action** : Créer le fichier `app/api/hls/status/route.ts`

1. Créer le répertoire :
   ```bash
   mkdir -p app/api/hls/status
   ```

2. Copier le contenu depuis `api_hls_status_route.ts` (fourni)

3. Tester l'endpoint :
   ```bash
   # Démarrer une vidéo, puis :
   curl "http://localhost:3000/api/hls/status?path=/chemin/video.mkv"
   # Doit retourner JSON avec segmentsReady, totalSegments, etc.
   ```

---

### ✅ Étape 2.2 : Ajouter le marker `.done` dans FFmpeg

**Fichier** : `app/api/hls/route.ts`

1. Chercher `ffmpeg.on('close', ...)`
2. Ajouter l'import manquant en haut du fichier :
   ```typescript
   import { writeFile } from 'fs/promises'
   ```

3. Modifier le handler :
   ```typescript
   ffmpeg.on('close', async (code) => {
     if (code === 0) {
       console.log('✅ Transcodage terminé')
       
       // ✅ AJOUTER CETTE LIGNE
       try {
         await writeFile(path.join(sessionDir, '.done'), '')
         console.log('📝 Marker .done créé')
       } catch (err) {
         console.warn('⚠️ Erreur création marker:', err)
       }
     }
     ffmpegManager.removeSession(sessionHash)
   })
   ```

**Test** :
```bash
# Lancer une vidéo jusqu'au bout
ls -la /tmp/leon-hls/<session>/
# Doit contenir un fichier .done
```

---

### ✅ Étape 2.3 : Implémenter le buffer check adaptatif

**Fichier** : `components/SimpleVideoPlayer/SimpleVideoPlayer.tsx`

**Option A : Remplacement complet (recommandé)**

1. Sauvegarder l'ancien fichier :
   ```bash
   cp components/SimpleVideoPlayer/SimpleVideoPlayer.tsx components/SimpleVideoPlayer/SimpleVideoPlayer.tsx.backup
   ```

2. Remplacer par le contenu de `SimpleVideoPlayer_OPTIMIZED.tsx` (fourni)

**Option B : Modification manuelle**

1. Chercher la section "Attente de 30s de buffer minimum"
2. Remplacer tout le `setInterval` par le nouveau code (voir `SimpleVideoPlayer_OPTIMIZED.tsx` lignes 90-170)

**Test** :
```bash
# Lancer une vidéo
# Console doit afficher :
# "📊 Buffer: X.Xs | FFmpeg: Y segments"
# Toutes les 250ms au lieu de 1s
```

---

## 🛡️ PHASE 3 : GESTION D'ERREURS INTELLIGENTE (45 minutes)

### ✅ Étape 3.1 : Implémenter le retry graduel

**Fichier** : `components/SimpleVideoPlayer/SimpleVideoPlayer.tsx`

1. Ajouter les states en haut du composant :
   ```typescript
   const [retryCount, setRetryCount] = useState(0)
   const MAX_RETRIES = 3
   const RETRY_DELAYS = [1000, 3000, 5000]
   ```

2. Chercher `hls.on(Hls.Events.ERROR, ...)`

3. Remplacer le handler complet par celui dans `SimpleVideoPlayer_OPTIMIZED.tsx` (lignes 190-260)

**Test** :
```bash
# Simuler une erreur réseau :
# - Démarrer une vidéo
# - Couper le WiFi pendant 5 secondes
# - Rétablir le WiFi
# → La vidéo doit reprendre automatiquement
```

---

### ✅ Étape 3.2 : Ajouter les states d'erreur utilisateur

**Fichier** : `components/SimpleVideoPlayer/SimpleVideoPlayer.tsx`

1. Ajouter le state :
   ```typescript
   const [error, setError] = useState<string | null>(null)
   ```

2. Ajouter l'overlay d'erreur dans le JSX :
   ```typescript
   {error && (
     <div className="error-overlay">
       <p>{error}</p>
       <button onClick={() => window.location.reload()}>
         Recharger
       </button>
     </div>
   )}
   ```

3. Ajouter le CSS :
   ```css
   .error-overlay {
     position: absolute;
     top: 0;
     left: 0;
     right: 0;
     bottom: 0;
     background: rgba(0, 0, 0, 0.9);
     display: flex;
     flex-direction: column;
     align-items: center;
     justify-content: center;
     color: white;
     z-index: 1000;
   }
   
   .error-overlay p {
     margin-bottom: 20px;
     font-size: 18px;
   }
   
   .error-overlay button {
     padding: 10px 20px;
     background: white;
     color: black;
     border: none;
     border-radius: 4px;
     cursor: pointer;
   }
   ```

**Test** :
```bash
# Simuler une erreur fatale (ex: fichier introuvable)
# Doit afficher un message clair + bouton Recharger
```

---

## 🎨 PHASE 4 : POLISH UX (30 minutes)

### ✅ Étape 4.1 : Améliorer le loader

**Fichier** : `components/SimpleVideoPlayer/SimpleVideoPlayer.tsx`

1. Modifier l'overlay de loading pour afficher la progression :
   ```typescript
   {isLoading && (
     <div className="loading-overlay">
       <div className="spinner"></div>
       <p>Préparation de la vidéo...</p>
       {bufferStatus.bufferedSeconds > 0 && (
         <p className="buffer-info">
           Buffer: {bufferStatus.bufferedSeconds.toFixed(1)}s / {BUFFER_CONFIG.INITIAL_TARGET}s
         </p>
       )}
       {bufferStatus.ffmpegSegments > 0 && (
         <p className="ffmpeg-info">
           {bufferStatus.ffmpegSegments} segments prêts
         </p>
       )}
     </div>
   )}
   ```

2. Ajouter le CSS :
   ```css
   .buffer-info, .ffmpeg-info {
     margin-top: 10px;
     font-size: 14px;
     opacity: 0.7;
   }
   ```

**Test** :
```bash
# Lancer une vidéo
# Doit afficher la progression du buffer en temps réel
```

---

### ✅ Étape 4.2 : Ajouter un indicateur de buffer visuel

**Fichier** : `components/SimpleVideoPlayer/SimpleVideoPlayer.tsx`

1. Ajouter un élément de buffer dans la timeline :
   ```typescript
   // Dans le JSX, au niveau de la timeline
   <div className="buffer-bar" style={{
     width: `${(bufferedSeconds / duration) * 100}%`
   }}></div>
   ```

2. Ajouter le CSS :
   ```css
   .buffer-bar {
     position: absolute;
     top: 0;
     left: 0;
     height: 100%;
     background: rgba(255, 255, 255, 0.3);
     pointer-events: none;
     z-index: 1;
   }
   ```

---

## 🧪 PHASE 5 : TESTS COMPLETS (30 minutes)

### ✅ Test 1 : Démarrage rapide

```bash
# 1. Lancer une vidéo MKV de 2h
# 2. Chronométrer le temps jusqu'au 1er frame
# Objectif : < 15 secondes
# Résultat : _____s
```

---

### ✅ Test 2 : Lecture fluide

```bash
# 1. Lancer une vidéo
# 2. Laisser jouer pendant 5 minutes
# 3. Compter le nombre de pauses/buffering
# Objectif : 0 pause
# Résultat : _____ pauses
```

---

### ✅ Test 3 : Seeking

```bash
# 1. Lancer une vidéo
# 2. Faire 10 sauts de 30 secondes en avant
# 3. Mesurer le temps de réponse à chaque saut
# Objectif : < 2 secondes par saut
# Résultat : moyenne _____s
```

---

### ✅ Test 4 : Récupération d'erreur

```bash
# 1. Lancer une vidéo
# 2. Couper le WiFi pendant 10 secondes
# 3. Rétablir le WiFi
# Objectif : Reprise automatique sans rechargement
# Résultat : ✅ / ❌
```

---

### ✅ Test 5 : Changement de piste audio

```bash
# 1. Lancer une vidéo multi-audio
# 2. Changer de piste audio 3 fois
# 3. Vérifier la continuité de lecture
# Objectif : Changement fluide sans interruption
# Résultat : ✅ / ❌
```

---

### ✅ Test 6 : Multi-tabs

```bash
# 1. Ouvrir 3 vidéos dans 3 onglets
# 2. Vérifier le nombre de processus FFmpeg
# Objectif : Max 2 processus simultanés (limite du manager)
# Résultat : _____ processus
```

---

## 📊 CHECKLIST FINALE

- [ ] Segments HLS passés de 4s à 2s
- [ ] Prefetch HLS.js activé
- [ ] Buffer max réduit (60s au lieu de 300s)
- [ ] API `/api/hls/status` fonctionnelle
- [ ] Marker `.done` créé en fin de transcodage
- [ ] Buffer check adaptatif (250ms)
- [ ] Retry graduel implémenté (3 tentatives)
- [ ] Messages d'erreur utilisateur clairs
- [ ] Loader avec progression du buffer
- [ ] Indicateur de buffer visuel

---

## 🎯 MÉTRIQUES AVANT/APRÈS

| Métrique | Avant | Après | Amélioration |
|----------|-------|-------|--------------|
| Time to First Frame | 30-45s | 10-15s | **-50 à -75%** |
| Rebuffering pendant lecture | 5-10% | < 1% | **-90%** |
| Consommation RAM | 120MB | 30MB | **-75%** |
| Récupération d'erreur | Rechargement complet | Retry intelligent | **Expérience fluide** |
| Seeking latency | 5-10s | 1-2s | **-70%** |

---

## 🐛 TROUBLESHOOTING

### Problème : "Cannot read property 'buffered' of null"

**Solution** :
```typescript
// Ajouter un guard
if (!videoRef.current) return
```

---

### Problème : API `/api/hls/status` retourne 404

**Solution** :
```bash
# Vérifier la structure des dossiers
ls -la app/api/hls/
# Doit contenir : route.ts ET status/route.ts

# Si manquant :
mkdir -p app/api/hls/status
```

---

### Problème : Segments toujours à 4s

**Solution** :
```bash
# Nettoyer le cache FFmpeg
rm -rf /tmp/leon-hls/*

# Relancer la vidéo
```

---

### Problème : HLS.js ne charge pas

**Solution** :
```typescript
// Vérifier l'import
import Hls from 'hls.js'

// Vérifier le support
if (!Hls.isSupported()) {
  console.error('HLS.js non supporté')
}
```

---

## 📞 SUPPORT

Si problème persistant :

1. **Vérifier les logs navigateur** : Console → Filtrer "HLS"
2. **Vérifier les logs serveur** : Terminal Next.js
3. **Vérifier FFmpeg** : `ps aux | grep ffmpeg`
4. **Vérifier le cache** : `ls -lh /tmp/leon-hls/`

---

## 🎉 RÉSULTAT FINAL

Une fois toutes les phases implémentées, l'expérience de lecture devrait être :

✅ **Démarrage rapide** : 10-15s maximum  
✅ **Lecture fluide** : Aucune interruption  
✅ **Seeking réactif** : < 2s de latence  
✅ **Récupération intelligente** : Pas de rechargement brutal  
✅ **Feedback utilisateur** : Progression visible  

**Bref : Une expérience Netflix-like ! 🎬**
