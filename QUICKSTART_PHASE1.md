# 🚀 Quick Start - Phase 1 Stabilisation

## ✅ Ce qui a été fait

La **Phase 1 - Stabilisation** est terminée. Le code est maintenant :
- ✅ Robuste (plus d'erreurs 500 non gérées)
- ✅ Traçable (logs structurés avec timestamps)
- ✅ Résilient (retry automatique sur erreurs transitoires)
- ✅ User-friendly (messages d'erreur clairs)

---

## 🧪 Comment Tester

### 1. Démarrer LEON

```bash
cd /Users/lionelvernay/Documents/Cursor/LEON
npm install  # Si première fois
npm run dev
```

LEON sera accessible sur `http://localhost:3000`

---

### 2. Test Rapide : Sous-titres PGS (le bug principal)

**Avant Phase 1 :**
- ❌ Erreur 500 sur les sous-titres image (PGS, VOBSUB)

**Après Phase 1 :**
- ✅ Erreur 415 propre avec message clair
- ✅ Fallback automatique vers sous-titres externes
- ✅ Téléchargement auto depuis OpenSubtitles si disponibles

**Comment tester :**
1. Ouvre un film avec sous-titres PGS (typique des Blu-ray)
2. Active les sous-titres dans le lecteur
3. Observe la console serveur

**Logs attendus :**
```
[2025-11-23T...] [SUBTITLES] Requête extraction { track: '2', filepath: 'movie.mkv' }
[2025-11-23T...] [SUBTITLES] 📝 Codec détecté: hdmv_pgs_subtitle (type: subtitle)
[2025-11-23T...] [SUBTITLES] ⚠️ Format image-based détecté
[2025-11-23T...] [SUBTITLES] 🔍 Recherche sous-titres externes
```

---

### 3. Test Logs Structurés

**Lance n'importe quel film et observe la console :**

Tu devrais voir des logs comme ça :
```
[2025-11-23T15:42:13.456Z] [HLS] Requête { file: 'movie.mkv', segment: 'playlist' }
[2025-11-23T15:42:13.789Z] [HLS] ✅ Fichier trouvé: 4.5GB
[2025-11-23T15:42:14.123Z] [HLS] 🎬 Démarrage transcodage
[2025-11-23T15:42:14.456Z] [FFMPEG] 📝 Enregistrement session { pid: '12345' }
[2025-11-23T15:42:14.789Z] [HLS] 🚀 Lancement FFmpeg
[2025-11-23T15:42:17.123Z] [HLS] ✅ Playlist prêt après 2.3s
```

**Format :** `[ISO_TIMESTAMP] [CONTEXT] emoji Message { data }`

---

### 4. Tests Complets (optionnel)

Voir le guide détaillé : `PHASE1_STABILISATION_TESTS.md`

**7 tests à effectuer :**
- Sous-titres PGS/VOBSUB
- Fichier vidéo corrompu
- Transcodage HLS normal
- Sous-titres texte (SRT/ASS)
- Multiples lectures simultanées
- Fichiers avec caractères spéciaux (accents)
- Timeout de transcodage

---

## 📊 Fichiers Modifiés

| Fichier | Changement |
|---------|------------|
| `lib/error-handler.ts` | ✨ **NOUVEAU** - Gestion centralisée des erreurs |
| `app/api/subtitles/route.ts` | ✅ Logs structurés + fallback PGS |
| `lib/ffmpeg-manager.ts` | ✅ Logs structurés + retry |
| `app/api/hls/route.ts` | ✅ Logs structurés + ErrorHandler |

**Total :** +339 lignes de code

---

## 🔍 Vérifications Rapides

### ✅ Pas d'erreurs de compilation

```bash
npm run build
```

Devrait compiler sans erreur.

### ✅ Pas d'erreurs ESLint

```bash
npm run lint
```

Devrait passer sans erreur (ou seulement warnings mineurs).

### ✅ Types TypeScript OK

Les fichiers sont tous typés correctement (pas de `any` non justifiés).

---

## 🐛 Si Problème

### Erreur "Cannot find module '@/lib/error-handler'"

**Solution :**
```bash
# Vérifier que le fichier existe
ls lib/error-handler.ts

# Si absent, le recréer depuis recapitulatif/phase1-stabilisation-complete.md
```

### FFmpeg introuvable

**Solution macOS :**
```bash
brew install ffmpeg
```

### Port 3000 déjà utilisé

**Solution :**
```bash
# Tuer le processus sur le port 3000
lsof -ti:3000 | xargs kill -9

# Ou utiliser un autre port
PORT=3001 npm run dev
```

---

## 📚 Documentation

- `PHASE1_STABILISATION_TESTS.md` - Guide de tests complet
- `recapitulatif/phase1-stabilisation-complete.md` - Récapitulatif détaillé
- `recapitulatif/leon-diagnostic-et-optimisations.md` - Diagnostic initial

---

## ✅ Checklist Validation

- [ ] LEON démarre sans erreur (`npm run dev`)
- [ ] Les logs structurés apparaissent dans la console
- [ ] Un film se lit correctement
- [ ] Les sous-titres PGS ne causent PAS d'erreur 500
- [ ] Les messages d'erreur sont clairs (pas de stack traces brutes)

---

## 🚀 Prochaines Étapes

Une fois la Phase 1 validée :

### Phase 2 : Performance
- Cache intelligent (segments, métadonnées, sous-titres)
- Intel Quick Sync (VAAPI) pour le NAS
- Profils de qualité adaptatifs

### Phase 3 : Fluidité
- Détection bande passante
- Buffer adaptatif (exit les 30s fixes)
- Pré-chargement anticipatif

---

**Besoin d'aide ?**

Consulte `PHASE1_STABILISATION_TESTS.md` pour les tests détaillés, ou `recapitulatif/phase1-stabilisation-complete.md` pour le récapitulatif technique.

**Ready to test!** 🎬


