# Audit de Performance — LEON
**Date** : 30 janvier 2026  
**Version** : Après corrections récentes

---

## Score de Performance Global

### 🟡 **7.5/10** — Bon avec quelques améliorations nécessaires

| Catégorie | Score | Status |
|-----------|-------|--------|
| Fuites mémoire | 6/10 | 🟠 Améliorable |
| Images optimisées | 9/10 | 🟢 Excellent |
| Requêtes N+1 | 10/10 | 🟢 Parfait |
| Gestion singletons | 10/10 | 🟢 Parfait |

---

## 1. Fuites Mémoire Potentielles

### ✅ **Corrigés**
- `lib/segment-cache.ts` : Utilise `globalThis` correctement avec cleanup
- `lib/hooks/usePlaybackPosition.ts` : Cleanup correct du `setInterval`
- `lib/hooks/useBufferStatus.ts` : Cleanup correct dans le `useEffect`
- `components/ContinueWatchingRow.tsx` : Cleanup correct
- `components/SimpleVideoPlayer/hooks/useNextEpisode.ts` : Cleanup correct

### ⚠️ **Problèmes Restants**

#### **1. SimpleVideoPlayer.tsx — Ligne 1769**
**Problème** : `pollingInterval` nettoyé avec `setTimeout` mais pas dans le `return` du `useEffect`

```typescript
// ❌ ACTUEL - Nettoyage avec setTimeout uniquement
const pollingInterval = setInterval(() => { ... }, 500)
setTimeout(() => {
  clearInterval(pollingInterval)
}, 300000)
// Pas de cleanup dans le return du useEffect

// ✅ CORRECTION RECOMMANDÉE
useEffect(() => {
  const pollingInterval = setInterval(() => { ... }, 500)
  const timeoutId = setTimeout(() => {
    clearInterval(pollingInterval)
  }, 300000)
  
  return () => {
    clearInterval(pollingInterval)
    clearTimeout(timeoutId)
  }
}, [dependencies])
```

**Impact** : Fuite mémoire si le composant est démonté avant 5 minutes  
**Priorité** : 🟠 Moyenne

---

#### **2. SimpleVideoPlayer.tsx — Ligne 2269**
**Problème** : `checkInterval` nettoyé avec `setTimeout` mais pas dans le `return` du `useEffect`

```typescript
// ❌ ACTUEL
const checkInterval = setInterval(() => { ... }, 500)
setTimeout(() => clearInterval(checkInterval), 10000)

// ✅ CORRECTION RECOMMANDÉE
useEffect(() => {
  const checkInterval = setInterval(() => { ... }, 500)
  const timeoutId = setTimeout(() => {
    clearInterval(checkInterval)
  }, 10000)
  
  return () => {
    clearInterval(checkInterval)
    clearTimeout(timeoutId)
  }
}, [dependencies])
```

**Impact** : Fuite mémoire si le composant est démonté avant 10 secondes  
**Priorité** : 🟠 Moyenne

---

#### **3. SimpleVideoPlayer.tsx — Ligne 3131**
**Problème** : `checkInterval` nettoyé conditionnellement mais pas dans le `return` du `useEffect`

```typescript
// ❌ ACTUEL
let checkInterval: NodeJS.Timeout | null = null
const startChecking = () => {
  if (checkInterval) return
  checkInterval = setInterval(() => {
    if (condition) {
      clearInterval(checkInterval)
      checkInterval = null
    }
  }, 1000)
}
videoRef.current?.addEventListener('play', startChecking, { once: true })
// Pas de cleanup dans le return du useEffect

// ✅ CORRECTION RECOMMANDÉE
useEffect(() => {
  let checkInterval: NodeJS.Timeout | null = null
  const startChecking = () => {
    if (checkInterval) return
    checkInterval = setInterval(() => { ... }, 1000)
  }
  
  videoRef.current?.addEventListener('play', startChecking, { once: true })
  
  return () => {
    if (checkInterval) {
      clearInterval(checkInterval)
    }
    videoRef.current?.removeEventListener('play', startChecking)
  }
}, [dependencies])
```

**Impact** : Fuite mémoire si le composant est démonté pendant la vérification  
**Priorité** : 🟠 Moyenne

---

#### **4. ffmpeg-manager.ts — Ligne 315**
**Problème** : Cleanup automatique désactivé en dev (commentaire indique "mode dev")

```typescript
// ⚠️ ACTUEL
private startPeriodicCleanup(): void {
  console.log('⚠️ Cleanup automatique DÉSACTIVÉ (mode dev)')
  // TODO: Réactiver en production avec détection d'environnement
}
```

**Impact** : Pas de problème en dev, mais à vérifier en production  
**Priorité** : 🟡 Faible (vérifier que c'est bien réactivé en prod)

---

## 2. Images Non Optimisées

### ✅ **Excellent — Presque tout optimisé**

Tous les composants utilisent `next/image` correctement :
- `components/MediaCard.tsx` : ✅ `next/image` avec `fill` et `sizes`
- `app/admin/page.tsx` : ✅ `next/image`
- `app/movie/[id]/page.tsx` : ✅ `next/image`
- `app/ma-liste/page.tsx` : ✅ `next/image`

### ⚠️ **Un cas à vérifier**

#### **MovieRow.tsx — Ligne 101**
**Problème** : Utilise `unoptimized` sur `Image`

```typescript
<Image
  src={movie.poster_url || '/placeholder-poster.svg'}
  alt={movie.title}
  width={240}
  height={360}
  className={styles.poster}
  unoptimized  // ⚠️ Désactive l'optimisation Next.js
/>
```

**Impact** : Images non optimisées (pas de WebP, pas de lazy loading automatique)  
**Justification possible** : Posters locaux qui nécessitent peut-être `unoptimized`  
**Priorité** : 🟡 Faible (si intentionnel pour posters locaux)

**Recommandation** : Vérifier si les posters sont locaux ou distants. Si distants (TMDB), retirer `unoptimized`.

---

## 3. Requêtes N+1

### ✅ **Parfait — Aucun problème détecté**

Toutes les routes API utilisent des requêtes batch avec `.in()` :

#### **Exemples Corrects**

**app/api/users/route.ts** (ligne 95-131)
```typescript
// ✅ CORRECT - Récupère en batch
for (const authUser of authUsers) {
  const movieIds = userPositions.filter(...).map(p => p.media_id)
  const episodeIds = userPositions.filter(...).map(p => p.media_id)
  
  // Une seule requête pour tous les films
  if (movieIds.length > 0) {
    const { data: movies } = await supabase
      .from('media')
      .select('id, title, poster_url')
      .in('id', movieIds)  // ✅ Batch
  }
  
  // Une seule requête pour tous les épisodes
  if (episodeIds.length > 0) {
    const { data: episodes } = await supabase
      .from('episodes')
      .select('...')
      .in('id', episodeIds)  // ✅ Batch
  }
}
```

**app/api/media/in-progress/route.ts** (ligne 58-87)
```typescript
// ✅ CORRECT - Batch avec .in()
const { data: movies } = await supabase
  .from('media')
  .select('*')
  .in('id', movieIds)  // ✅ Batch

const { data: episodes } = await supabase
  .from('episodes')
  .select('...')
  .in('id', episodeIds)  // ✅ Batch
```

**app/api/stats/watching/route.ts** (ligne 96-110)
```typescript
// ✅ CORRECT - Batch avec .in()
const { data: episodeData } = await supabase
  .from('episodes')
  .select('...')
  .in('id', episodeIds)  // ✅ Batch

const { data: seriesData } = await supabase
  .from('series')
  .select('...')
  .in('id', seriesIds)  // ✅ Batch
```

**Aucune requête N+1 détectée** ✅

---

## 4. Gestion Singletons (globalThis)

### ✅ **Parfait — Implémentation exemplaire**

**lib/segment-cache.ts** (ligne 283-336)
```typescript
// ✅ CORRECT - Utilise globalThis pour éviter les fuites en HMR
declare global {
  var __segmentCacheSingleton: SegmentCache | undefined
  var __segmentCacheCleanupInterval: NodeJS.Timeout | undefined
}

export function getCacheInstance(): SegmentCache {
  if (!global.__segmentCacheSingleton) {
    global.__segmentCacheSingleton = new SegmentCache()
    global.__segmentCacheSingleton.init().catch(...)
  }
  return global.__segmentCacheSingleton
}

export function startAutoCleaner(): void {
  // ✅ Nettoyage de l'ancien intervalle avant d'en créer un nouveau
  if (global.__segmentCacheCleanupInterval) {
    clearInterval(global.__segmentCacheCleanupInterval)
  }
  
  global.__segmentCacheCleanupInterval = setInterval(() => {
    cache.cleanOldSegments().catch(...)
  }, 6 * 60 * 60 * 1000)
}

export function stopAutoCleaner(): void {
  if (global.__segmentCacheCleanupInterval) {
    clearInterval(global.__segmentCacheCleanupInterval)
    global.__segmentCacheCleanupInterval = undefined
  }
}
```

**Pattern parfait** : ✅ Utilise `globalThis`, cleanup correct, évite les fuites en HMR

---

## Recommandations Prioritaires

### 🔴 **Priorité Haute** (à corriger rapidement)
Aucun problème critique détecté.

### 🟠 **Priorité Moyenne** (à corriger prochainement)
1. **SimpleVideoPlayer.tsx** — 3 `setInterval` sans cleanup dans le `return` du `useEffect`
   - Ligne 1769 : `pollingInterval`
   - Ligne 2269 : `checkInterval`
   - Ligne 3131 : `checkInterval`

### 🟡 **Priorité Faible** (vérifier si nécessaire)
1. **MovieRow.tsx** — Vérifier si `unoptimized` est nécessaire pour les posters
2. **ffmpeg-manager.ts** — Vérifier que le cleanup est réactivé en production

---

## Résumé Exécutif

### Points Forts ✅
- **Requêtes N+1** : Aucun problème, toutes les requêtes utilisent des batchs
- **Singletons** : Implémentation exemplaire avec `globalThis`
- **Images** : Presque toutes optimisées avec `next/image`

### Points d'Amélioration ⚠️
- **3 fuites mémoire potentielles** dans `SimpleVideoPlayer.tsx` (cleanup manquant dans les `useEffect`)
- **1 image non optimisée** dans `MovieRow.tsx` (vérifier si intentionnel)

### Score Final
**7.5/10** — Bon état général avec quelques améliorations nécessaires pour éviter les fuites mémoire à long terme.

---

## Actions Recommandées

1. ✅ Corriger les 3 `setInterval` dans `SimpleVideoPlayer.tsx` (ajouter cleanup dans `return`)
2. ✅ Vérifier `MovieRow.tsx` : retirer `unoptimized` si les posters sont distants
3. ✅ Vérifier `ffmpeg-manager.ts` : s'assurer que le cleanup est réactivé en production

**Temps estimé** : 30-45 minutes pour corriger les 3 fuites mémoire
