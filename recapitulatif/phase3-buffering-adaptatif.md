# Phase 3 - Buffering Adaptatif Intelligent

## 🎯 Objectif
Implémenter un système de buffering adaptatif qui ajuste dynamiquement le buffer selon la vitesse de transcoding et les conditions réseau pour prévenir les interruptions de lecture.

## ✅ Implémentation

### 1. Système de Buffering Adaptatif
**Fichier** : `lib/adaptive-buffer.ts`

Classe `AdaptiveBuffer` qui :
- **Enregistre les métriques** de transcoding en temps réel (speed, fps, segments)
- **Analyse les tendances** (vitesse moyenne, ralentissement détecté)
- **Calcule le buffer disponible** (segments générés - segments consommés)
- **Détermine la stratégie optimale** selon les conditions

### 2. Stratégies de Buffering

#### 🚀 AGGRESSIVE (Transcoding rapide > 4x)
```typescript
{
  minBuffer: 2 segments,  // Buffer minimum
  targetBuffer: 3,        // Buffer cible
  maxBuffer: 5,           // Buffer maximum
  reason: "Transcoding rapide, buffer minimal"
}
```
- **Quand** : Transcoding très rapide, pas de ralentissement
- **Avantage** : Démarre instantanément, utilise moins de cache

#### ⚖️ BALANCED (Transcoding normal 2-4x)
```typescript
{
  minBuffer: 3 segments,
  targetBuffer: 5,
  maxBuffer: 8,
  reason: "Transcoding normal, buffer équilibré"
}
```
- **Quand** : Vitesse de transcoding standard
- **Avantage** : Équilibre entre réactivité et sécurité

#### 🛡️ CONSERVATIVE (Transcoding lent < 2x ou ralentissement)
```typescript
{
  minBuffer: 5 segments,
  targetBuffer: 10,
  maxBuffer: 15,
  reason: "Transcoding lent, buffer large"
}
```
- **Quand** : Transcoding lent ou ralentissement détecté
- **Avantage** : Prévient les interruptions sur machines lentes

### 3. Métriques Collectées

À partir des logs FFmpeg :
```
frame= 1024 fps= 82 q=-0.0 size=N/A time=00:00:42.66 bitrate=N/A speed=3.39x
```

Extraction :
- **frame** : Nombre de frames transcodées → calcul du nombre de segments
- **fps** : Frames par seconde (indicateur de performance)
- **speed** : Vitesse de transcoding (ex: 3.39x = 3.39 fois plus rapide que le temps réel)

### 4. Actions Recommandées

Le système recommande une action selon l'état du buffer :

- **`wait`** : Buffer critique (< minBuffer) → Le player doit attendre
- **`continue`** : Buffer OK (entre min et target) → Lecture normale
- **`prefetch`** : Buffer optimal (≥ target) → Précharger les segments suivants

### 5. Intégration Backend

#### Dans `app/api/hls/route.ts` :
- Parse les logs FFmpeg en temps réel
- Enregistre les métriques dans `AdaptiveBuffer`
- Affiche le statut toutes les 10 secondes
- Nettoie automatiquement à la fin de la session

#### Dans `lib/ffmpeg-manager.ts` :
- Nettoie les instances de buffer lors de `killSession()`
- Prévient les fuites mémoire

### 6. API de Statut

**Endpoint** : `GET /api/buffer-status?path=/video.mkv&audio=0`

**Réponse** :
```json
{
  "success": true,
  "sessionId": "...",
  "avgSpeed": "3.42x",
  "bufferAvailable": 5,
  "strategy": {
    "minBuffer": 3,
    "targetBuffer": 5,
    "maxBuffer": 8,
    "strategy": "balanced",
    "reason": "Transcoding normal (3.4x), buffer équilibré"
  },
  "isCritical": false,
  "recommendedAction": "continue"
}
```

## 📊 Fonctionnement

### Cycle de Buffering

```
1. FFmpeg démarre → Transcoding à vitesse variable
   ↓
2. Parse logs → Extraction métriques (speed, fps, frame)
   ↓
3. AdaptiveBuffer → Enregistre + Analyse tendances
   ↓
4. Détermination stratégie → aggressive | balanced | conservative
   ↓
5. Recommandation action → wait | continue | prefetch
   ↓
6. Player ajuste → Selon les recommandations
```

### Exemple de Logs

```
[HLS] ⏱️ frame= 346 fps= 69 q=-0.0 size=N/A time=00:00:14.38 speed=2.86x
[BUFFER] 📊 Statut: {
  avgSpeed: '2.92x',
  bufferAvailable: 7,
  strategy: {
    minBuffer: 3,
    targetBuffer: 5,
    maxBuffer: 8,
    strategy: 'balanced',
    reason: 'Transcoding normal (2.9x), buffer équilibré'
  },
  isCritical: false,
  recommendedAction: 'prefetch'
}
```

## 🚀 Bénéfices

### 1. Prévention des Interruptions
- **Détection proactive** des ralentissements
- **Ajustement automatique** du buffer avant que le problème n'apparaisse
- **Stratégie conservative** appliquée dès les premiers signes

### 2. Optimisation des Ressources
- **Buffer minimal** quand le transcoding est rapide (économie cache)
- **Buffer large** uniquement quand nécessaire
- **Nettoyage automatique** des métriques anciennes

### 3. Expérience Utilisateur
- **Démarrage rapide** avec stratégie aggressive sur machines puissantes
- **Lecture fluide** sans interruption sur machines lentes
- **Adaptation dynamique** aux conditions changeantes

### 4. Monitoring
- **Visibilité temps réel** du statut du buffer
- **Logs structurés** pour debug et analyse
- **API de statut** pour intégration frontend

## 🔧 Configuration

### Paramètres Ajustables

Dans `lib/adaptive-buffer.ts` :

```typescript
// Historique des métriques
maxMetricsHistory = 20  // Garder 20 mesures

// Seuils de vitesse
speed >= 4.0   → Aggressive
speed >= 2.0   → Balanced
speed < 2.0    → Conservative

// Estimation segments
48 frames = 1 segment (2s @ 24fps)
```

### Personnalisation des Stratégies

Modifier les valeurs de buffer dans `getBufferStrategy()` :

```typescript
// Exemple : Buffer plus agressif
if (avgSpeed >= 4.0) {
  return {
    minBuffer: 1,      // Au lieu de 2
    targetBuffer: 2,   // Au lieu de 3
    maxBuffer: 3,      // Au lieu de 5
    strategy: 'aggressive',
    reason: "Ultra-rapide"
  }
}
```

## 🧪 Tests

### Test Manuel

1. **Lancer LEON** : `npm run dev`
2. **Ouvrir un film** qui transcode (ex: MKV HEVC)
3. **Observer les logs** :
   ```
   [HLS] ⏱️ frame=... fps=... speed=...
   [BUFFER] 📊 Statut: { avgSpeed: '3.4x', strategy: 'balanced', ... }
   ```
4. **Interroger l'API** :
   ```bash
   curl "http://localhost:3000/api/buffer-status?path=/video.mkv&audio=0"
   ```

### Scénarios à Tester

1. **Machine puissante (macOS M1/M2)** :
   - Devrait afficher stratégie `aggressive`
   - Speed > 4x attendu

2. **Machine standard** :
   - Devrait afficher stratégie `balanced`
   - Speed 2-4x attendu

3. **Machine lente ou CPU encodage** :
   - Devrait afficher stratégie `conservative`
   - Speed < 2x attendu

4. **Ralentissement simulé** :
   - Tuer temporairement FFmpeg
   - Relancer → devrait détecter le ralentissement

## 📝 Prochaines Étapes (Phase 4)

### Intégration Frontend
- Interroger `/api/buffer-status` toutes les 5 secondes
- Afficher un indicateur de buffer dans le player
- Adapter le comportement selon `recommendedAction`
- Implémenter le préchargement intelligent

### Cache Intelligent
- Sauvegarder segments transcodés sur disque
- Réutiliser segments si même film + même qualité
- Nettoyage automatique des vieux segments

### Analytics
- Historique des performances par film
- Détection des films "problématiques"
- Suggestions d'optimisation

## 📚 Références

- [HLS Adaptive Streaming](https://developer.apple.com/streaming/)
- [FFmpeg Progress Parsing](https://trac.ffmpeg.org/wiki/FFmpeg%20FAQ#ProgressBar)
- [Buffer Management Best Practices](https://www.cloudflare.com/learning/video/what-is-buffering/)












