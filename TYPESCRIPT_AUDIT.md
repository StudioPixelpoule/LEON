# Audit TypeScript — LEON
**Date** : 30 janvier 2026  
**Scope** : `app/api/**`, `lib/*.ts`, `components/**/*.tsx`, `types/media.ts`

---

## 📊 Résumé Exécutif

| Métrique | Nombre | Statut |
|----------|--------|--------|
| **Catch silencieux** | 4 | 🔴 À corriger |
| **Catch (error: any)** | 15 | 🟠 À améliorer |
| **Types `any` explicites** | ~64 | 🟠 À réduire |
| **Interfaces `types/media.ts` utilisées** | 0 | 🔴 Non utilisées |

---

## 🔴 Catch Silencieux (4)

**Criticité** : Haute — Erreurs ignorées silencieusement

| Fichier | Ligne | Contexte |
|---------|-------|----------|
| `app/api/hls/route.ts` | 566 | Lecture `audio_info.json` |
| `app/api/hls/seek/route.ts` | 180 | Gestion session seek |
| `lib/file-watcher.ts` | 693 | Fermeture watchers |
| `lib/ffmpeg-manager.ts` | 294 | Nettoyage processus |

**Recommandation** : Ajouter au minimum un log d'erreur :
```typescript
} catch (error) {
  console.error('[CONTEXT] Erreur silencieuse:', error)
}
```

---

## 🟠 Catch (error: any) (15)

**Criticité** : Moyenne — Typage faible des erreurs

### Répartition
- **app/api** : 7 occurrences
- **lib** : 7 occurrences  
- **components** : 1 occurrence

### Fichiers concernés
- `app/api/stream-audio/route.ts:363`
- `app/api/favorites/check/route.ts:52`
- `app/api/media/in-progress/route.ts:142`
- `app/api/admin/update-metadata/route.ts:144`
- `app/api/cache/clear/route.ts:28`
- `app/api/cache/stats/route.ts:28`
- `app/api/buffer-status/route.ts:34`
- `lib/segment-cache.ts` (5 occurrences)
- `lib/hooks/useNetworkResilience.ts:148`
- `lib/hooks/useBufferStatus.ts:53`
- `components/SimpleVideoPlayer/SimpleVideoPlayer.tsx:1220`

**Recommandation** : Utiliser `unknown` ou `Error` :
```typescript
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Erreur inconnue'
  console.error('[CONTEXT]', message)
}
```

---

## 🟠 Types `any` Explicites (~64)

**Criticité** : Moyenne — Perte de sécurité de type

### Catégories principales

#### 1. Données TMDB (API externes) — ~25 occurrences
**Fichiers** :
- `app/api/scan/route.ts` — `genres.map((g: any) => ...)`
- `app/api/scan-series/route.ts` — `genres.map((g: any) => ...)`
- `app/api/admin/update-metadata/route.ts` — `genres.map((g: any) => ...)`
- `app/api/admin/validate-media/route.ts` — `genres.map((g: any) => ...)`
- `app/api/admin/apply-correction/route.ts` — `genres.map((g: any) => ...)`

**Solution** : Utiliser `TMDBGenre` depuis `types/media.ts`

#### 2. Données FFprobe — ~10 occurrences
**Fichiers** :
- `lib/transcoding-service.ts` — `streams.filter((s: any) => ...)`
- `app/api/media-info/route.ts` — `audioInfo.map((track: any, ...)`

**Solution** : Utiliser `FFprobeStream` depuis `types/media.ts`

#### 3. Props composants — ~5 occurrences
**Fichiers** :
- `components/SeriesModal/SeriesModal.tsx:55` — `series: any`
- `components/Header/Header.tsx:23-24` — `series?: any[]`, `onSeriesClick?: (series: any) => void`
- `components/MovieModal/MovieModalWithTV.tsx:322` — `cast.map((actor: any, ...)`

**Solution** : Créer interfaces `SeriesModalProps`, `HeaderProps` avec types appropriés

#### 4. Données API internes — ~15 occurrences
**Fichiers** :
- `app/api/media/grouped/route.ts` — `movie_cast: any[]`, `director: any`, `subtitles: any`
- `app/api/media/in-progress/route.ts` — `mediaList: any[]`
- `app/api/series/list/route.ts` — `data: any[]`, `series.map((serie: any) => ...)`

**Solution** : Utiliser `GroupedMedia`, `CastMember`, `Director` depuis `types/media.ts`

#### 5. Utilitaires — ~9 occurrences
**Fichiers** :
- `lib/genreClassification.ts:196` — `Array<{ genre: string; movies: any[] }>`
- `lib/error-handler.ts:13,121,145` — `technicalDetails?: any`, `additionalData?: any`

**Solution** : Typer avec interfaces spécifiques ou `Record<string, unknown>`

---

## 🔴 Interfaces `types/media.ts` Non Utilisées

**Criticité** : Haute — Code dupliqué et incohérent

### Interfaces disponibles mais non importées

| Interface | Usage potentiel | Fichiers concernés |
|-----------|-----------------|-------------------|
| `TMDBGenre` | ✅ 25+ occurrences | `app/api/scan/**`, `app/api/admin/**` |
| `TMDBCastMember` | ✅ 5+ occurrences | `components/MovieModal/**`, `app/api/admin/**` |
| `TMDBCrewMember` | ✅ 3+ occurrences | `app/api/admin/**` |
| `FFprobeStream` | ✅ 10+ occurrences | `lib/transcoding-service.ts`, `app/api/media-info/**` |
| `GroupedMedia` | ✅ Déjà utilisé | `app/api/media/grouped/route.ts` (mais pas importé) |
| `CastMember` | ✅ 5+ occurrences | `app/api/admin/**`, `components/**` |
| `Director` | ✅ 3+ occurrences | `app/api/admin/**` |
| `SubtitleInfo` | ✅ 2+ occurrences | `app/api/media-info/**` |

### Constat
- **0 import** de `types/media.ts` trouvé dans tout le projet
- Types redéfinis localement ou utilisés comme `any`
- Perte de cohérence et de réutilisabilité

**Recommandation** : Migration progressive vers les interfaces centralisées

---

## 🎯 Plan d'Action Priorisé

### Phase 1 : Critiques (Semaine 1)
1. ✅ Corriger les 4 catch silencieux
2. ✅ Remplacer les `catch (error: any)` par `catch (error: unknown)`
3. ✅ Importer et utiliser `TMDBGenre` dans les API routes

### Phase 2 : Importantes (Semaine 2)
4. ✅ Typer les props composants (`SeriesModal`, `Header`)
5. ✅ Utiliser `FFprobeStream` dans `transcoding-service.ts`
6. ✅ Utiliser `CastMember`, `Director` dans les API admin

### Phase 3 : Améliorations (Semaine 3)
7. ✅ Typer les données API internes (`GroupedMedia`, etc.)
8. ✅ Remplacer les `any` utilitaires par types spécifiques
9. ✅ Audit final et vérification `tsc --noEmit`

---

## 📈 Qualité Globale du Typage

### Score Actuel : **65/100**

| Critère | Score | Commentaire |
|---------|-------|-------------|
| Absence de `any` | 40/30 | Trop de `any` explicites |
| Gestion d'erreurs | 15/20 | Catch silencieux présents |
| Réutilisation types | 5/20 | Interfaces non utilisées |
| Cohérence | 5/15 | Types redéfinis localement |
| Documentation | 0/15 | Pas de JSDoc sur types |

### Score Cible : **85/100**

**Objectifs** :
- Réduire les `any` à < 10 occurrences (justifiées)
- Éliminer tous les catch silencieux
- Utiliser 80%+ des interfaces de `types/media.ts`
- 0 erreur `tsc --noEmit`

---

## 🔍 Erreurs TypeScript Compilateur

**Résultat** : `tsc --noEmit` retourne **8 erreurs**

### Erreurs critiques
1. `lib/supabase.ts` — Types manquants depuis `database.types` (Media, Profile, etc.)
2. `components/MovieModal/MovieModal.tsx` — Paramètres implicites `any`
3. `app/api/favorites/route.ts` — Conversion de type douteuse

**Action immédiate** : Régénérer les types Supabase et corriger les erreurs de compilation.

---

## 📝 Notes

- Les `any` dans les données TMDB sont acceptables temporairement (API externe), mais devraient utiliser les interfaces `types/media.ts`
- Les catch silencieux dans le nettoyage (watchers, processus) peuvent être justifiés, mais devraient au minimum logger
- Le fichier `types/media.ts` est bien structuré mais **complètement ignoré** par le codebase

---

**Prochaine étape recommandée** : Migration progressive vers les interfaces centralisées, en commençant par les API routes qui manipulent les données TMDB.
