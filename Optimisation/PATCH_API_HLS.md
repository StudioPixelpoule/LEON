# 🔧 PATCH POUR /app/api/hls/route.ts

## Modifications à apporter :

### 1. ✅ Changer la durée des segments de 4s → 2s

**Ligne ~170** (chercher `-hls_time`)

```typescript
// ❌ AVANT
'-hls_time', '4',

// ✅ APRÈS
'-hls_time', '2',  // Segments de 2s pour démarrage plus rapide
```

---

### 2. ✅ Optimiser les flags HLS

**Ligne ~171** (ajouter après `-hls_time`)

```typescript
// ✅ AJOUTER CES LIGNES
'-hls_list_size', '0',                           // Garder tous les segments dans manifest
'-hls_flags', 'independent_segments+temp_file',  // Générer segments indépendants
'-hls_segment_type', 'mpegts',                   // Format MPEG-TS explicite
```

---

### 3. ✅ Ajouter un marker de fin de transcodage

**Ligne ~220** (dans le `ffmpeg.on('close', ...)`)

```typescript
// ❌ AVANT
ffmpeg.on('close', (code) => {
  if (code === 0) {
    console.log(`✅ Transcodage terminé pour ${filepath}`)
  } else {
    console.error(`❌ Erreur transcodage (code ${code})`)
  }
  
  // Nettoyer la session active
  ffmpegManager.removeSession(sessionHash)
})

// ✅ APRÈS
ffmpeg.on('close', async (code) => {
  if (code === 0) {
    console.log(`✅ Transcodage terminé pour ${filepath}`)
    
    // 🎯 CRÉER UN MARKER DE FIN
    try {
      await writeFile(path.join(sessionDir, '.done'), '')
      console.log('📝 Marker .done créé')
    } catch (err) {
      console.warn('⚠️ Impossible de créer le marker .done:', err)
    }
  } else {
    console.error(`❌ Erreur transcodage (code ${code})`)
  }
  
  // Nettoyer la session active
  ffmpegManager.removeSession(sessionHash)
})
```

---

### 4. ✅ Ajouter un log de progression

**Ligne ~200** (dans le spawn de FFmpeg, avant `.on('close')`)

```typescript
// ✅ AJOUTER CETTE SECTION
let segmentCount = 0

ffmpeg.stdout?.on('data', (data) => {
  const output = data.toString()
  
  // Détecter la génération de segments
  if (output.includes('Opening') && output.includes('.ts')) {
    segmentCount++
    if (segmentCount % 10 === 0) {
      console.log(`📦 ${segmentCount} segments générés...`)
    }
  }
})

ffmpeg.stderr?.on('data', (data) => {
  const error = data.toString()
  
  // Logger uniquement les erreurs critiques
  if (error.includes('error') || error.includes('Error')) {
    console.error('⚠️ FFmpeg stderr:', error)
  }
})
```

---

### 5. ✅ Optimiser le preset FFmpeg

**Ligne ~165** (chercher `-preset`)

```typescript
// ❌ AVANT
'-preset', 'ultrafast',

// ✅ APRÈS
'-preset', 'veryfast',  // Meilleur compromis qualité/vitesse
'-tune', 'zerolatency', // Optimiser pour streaming faible latence
```

---

### 6. ✅ Améliorer la gestion du cache

**Ligne ~140** (avant le spawn de FFmpeg)

```typescript
// ✅ AJOUTER CETTE SECTION
// 🧹 Nettoyer les vieux segments si la session existe déjà
if (existsSync(sessionDir)) {
  const existingFiles = await readdir(sessionDir)
  
  // Vérifier si le transcodage est déjà terminé
  if (existingFiles.includes('.done')) {
    console.log('✅ Transcodage déjà terminé, réutilisation du cache')
    // Pas besoin de retranscoder, servir directement
  } else {
    console.log('🔄 Transcodage en cours ou incomplet, nettoyage...')
    // Nettoyer les segments partiels
    await rm(sessionDir, { recursive: true, force: true })
    await mkdir(sessionDir, { recursive: true })
  }
} else {
  await mkdir(sessionDir, { recursive: true })
}
```

---

## 📋 RÉSUMÉ DES CHANGEMENTS

| Changement | Impact | Priorité |
|------------|--------|----------|
| Segments 2s au lieu de 4s | Démarrage 50% plus rapide | 🔴 CRITIQUE |
| Marker `.done` | Détection fin de transcodage | 🔴 CRITIQUE |
| Flags HLS optimisés | Meilleure compatibilité | 🟠 IMPORTANT |
| Preset `veryfast` | Meilleur compromis qualité/vitesse | 🟡 RECOMMANDÉ |
| Logs de progression | Debug facilité | 🟢 NICE TO HAVE |
| Réutilisation cache | Évite transcodage duplicate | 🟠 IMPORTANT |

---

## 🧪 TESTS APRÈS MODIFICATIONS

1. **Démarrage rapide** :
   ```bash
   # Lancer une vidéo, mesurer le temps jusqu'au 1er frame
   # Objectif : < 15 secondes
   ```

2. **Vérifier la création du marker** :
   ```bash
   ls -la /tmp/leon-hls/<session_hash>/
   # Doit contenir un fichier .done à la fin
   ```

3. **Vérifier la durée des segments** :
   ```bash
   cat /tmp/leon-hls/<session_hash>/playlist.m3u8 | grep EXTINF
   # Doit afficher ~2.0 secondes par segment
   ```

4. **Tester le cache** :
   ```bash
   # Lancer la même vidéo 2 fois
   # La 2ème fois doit être instantanée (réutilisation)
   ```

---

## 🔍 EXEMPLE DE CODE COMPLET (Extrait)

```typescript
// Spawn FFmpeg avec toutes les optimisations
const ffmpeg = spawn('ffmpeg', [
  '-i', filepath,
  '-c:v', 'h264',
  '-preset', 'veryfast',          // ✅ Optimisé
  '-tune', 'zerolatency',         // ✅ Nouveau
  '-b:v', '3000k',
  '-maxrate', '3000k',
  '-bufsize', '6000k',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-ar', '48000',
  '-ac', '2',
  '-map', '0:v:0',
  '-map', `0:a:${audioTrack}`,
  '-f', 'hls',
  '-hls_time', '2',                              // ✅ Modifié 4s → 2s
  '-hls_list_size', '0',                         // ✅ Nouveau
  '-hls_flags', 'independent_segments+temp_file', // ✅ Nouveau
  '-hls_segment_type', 'mpegts',                 // ✅ Nouveau
  '-hls_segment_filename', path.join(sessionDir, 'segment%d.ts'),
  path.join(sessionDir, 'playlist.m3u8')
], {
  stdio: ['ignore', 'pipe', 'pipe']  // ✅ Capturer stdout/stderr
})

// ✅ Logger progression
let segmentCount = 0
ffmpeg.stdout?.on('data', (data) => {
  const output = data.toString()
  if (output.includes('Opening') && output.includes('.ts')) {
    segmentCount++
    if (segmentCount % 10 === 0) {
      console.log(`📦 ${segmentCount} segments générés`)
    }
  }
})

// ✅ Marker de fin
ffmpeg.on('close', async (code) => {
  if (code === 0) {
    console.log('✅ Transcodage terminé')
    await writeFile(path.join(sessionDir, '.done'), '')
  }
  ffmpegManager.removeSession(sessionHash)
})
```

---

## ⚠️ POINTS D'ATTENTION

1. **Import manquants** : Ajouter `writeFile` si pas déjà importé :
   ```typescript
   import { writeFile, readdir, rm } from 'fs/promises'
   ```

2. **Gestion des erreurs** : Wrapper les `writeFile` dans des try/catch

3. **Compatibilité** : Tester sur Safari + Chrome

4. **Performance** : Monitorer l'usage CPU avec `top -p $(pgrep ffmpeg)`

---

## 🎯 RÉSULTAT ATTENDU

Après ces modifications, le flux de lecture devrait ressembler à :

```
[Client] Demande vidéo
    ↓
[Server] Démarre FFmpeg (segments 2s)
    ↓ (2-4 secondes)
[Client] 3-5 segments prêts → Lecture démarre
    ↓
[Client] Lecture fluide pendant que FFmpeg continue
    ↓
[Server] Transcodage terminé → Crée .done
    ↓
[Client] Peut seeking sans latence
```

**Temps de démarrage** : 10-15s au lieu de 30s+ ✅
