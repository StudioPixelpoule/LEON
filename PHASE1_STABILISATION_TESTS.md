# Phase 1 - Stabilisation : Guide de Tests

## ✅ Améliorations Implémentées

### 1. Gestion robuste des sous-titres
- ✅ Détection étendue des formats image (PGS, VOBSUB, DVB, XSUB)
- ✅ Fallback automatique vers sous-titres externes
- ✅ Téléchargement auto depuis OpenSubtitles
- ✅ Messages d'erreur clairs (415 au lieu de 500)
- ✅ Logs structurés avec timestamps

### 2. ErrorHandler centralisé
- ✅ Classe `UserFriendlyError` avec messages user-friendly
- ✅ Catalogue complet des codes d'erreur
- ✅ Parsing intelligent des erreurs FFmpeg
- ✅ Système de retry automatique

### 3. FFmpegManager amélioré
- ✅ Logs structurés avec timestamps et contexte
- ✅ Méthode `runFFmpegWithRetry()` avec retry automatique
- ✅ Gestion propre des sessions (SIGTERM puis SIGKILL)
- ✅ Meilleure traçabilité des processus

### 4. API HLS optimisée
- ✅ Logs structurés partout
- ✅ Gestion d'erreurs avec ErrorHandler
- ✅ Capture stderr pour diagnostic
- ✅ Timeouts avec messages clairs

---

## 🧪 Checklist de Tests Manuels

### Test 1 : Sous-titres PGS/VOBSUB (formats image)

**Objectif :** Vérifier qu'aucune erreur 500 n'apparaît avec des sous-titres image

**Étapes :**
```bash
# 1. Trouver un film avec sous-titres PGS (typique des Blu-ray)
# Exemple : The.Dark.Knight.2008.1080p.BluRay.x264.mkv

# 2. Démarrer LEON
npm run dev

# 3. Ouvrir le film dans le lecteur

# 4. Tenter d'activer les sous-titres
```

**Résultat attendu :**
- ❌ **PAS** d'erreur 500
- ✅ Message clair : "Format de sous-titre image non supporté"
- ✅ Fallback automatique vers sous-titres externes (si disponibles)
- ✅ Téléchargement auto depuis OpenSubtitles (si disponibles)
- ✅ Logs structurés visibles dans la console

**Logs attendus :**
```
[2025-11-23T...] [SUBTITLES] Requête extraction { track: '2', filepath: 'movie.mkv' }
[2025-11-23T...] [SUBTITLES] 📝 Codec détecté: hdmv_pgs_subtitle (type: subtitle)
[2025-11-23T...] [SUBTITLES] ⚠️ Format image-based détecté { codec: 'hdmv_pgs_subtitle', action: 'fallback...' }
[2025-11-23T...] [SUBTITLES] 🔍 Recherche sous-titres externes
```

---

### Test 2 : Fichier vidéo corrompu

**Objectif :** Vérifier la gestion des fichiers invalides

**Étapes :**
```bash
# 1. Créer un fichier corrompu
dd if=/dev/urandom of=/tmp/corrupt.mkv bs=1M count=10

# 2. Tenter de lire via l'API
curl "http://localhost:3000/api/hls?path=/tmp/corrupt.mkv"
```

**Résultat attendu :**
- ✅ Erreur 422 (Unprocessable Entity)
- ✅ Message : "Le fichier vidéo est corrompu ou invalide"
- ✅ Logs avec détails techniques

---

### Test 3 : Transcodage HLS normal

**Objectif :** Vérifier que le transcodage fonctionne toujours

**Étapes :**
```bash
# 1. Lire un film valide (MP4, MKV, AVI)
# Ouvrir dans le navigateur

# 2. Observer les logs
```

**Résultat attendu :**
```
[2025-11-23T...] [HLS] Requête { file: 'movie.mkv', segment: 'playlist', audioTrack: '0' }
[2025-11-23T...] [HLS] ✅ Fichier trouvé: 4.5GB
[2025-11-23T...] [HLS] 🎬 Démarrage transcodage { file: 'movie.mkv', audioTrack: '0' }
[2025-11-23T...] [FFMPEG] 📝 Enregistrement session { sessionId: '...', pid: '12345' }
[2025-11-23T...] [HLS] 🚀 Lancement FFmpeg
[2025-11-23T...] [HLS] ✅ FFmpeg démarré (PID: 12345)
[2025-11-23T...] [HLS] ⏳ Attente génération segments...
[2025-11-23T...] [HLS] ✅ Playlist prêt après 3.5s
[2025-11-23T...] [HLS] ✅ Playlist servi (3587ms)
```

---

### Test 4 : Sous-titres texte (SRT, ASS)

**Objectif :** Vérifier que les sous-titres texte fonctionnent toujours

**Étapes :**
```bash
# 1. Film avec sous-titres SRT ou ASS intégrés
# 2. Activer les sous-titres dans le lecteur
```

**Résultat attendu :**
- ✅ Sous-titres affichés correctement
- ✅ Logs montrant l'extraction réussie
```
[2025-11-23T...] [SUBTITLES] 📝 Extraction sous-titres { stream: '2', codec: 'subrip' }
[2025-11-23T...] [SUBTITLES] ✅ Extraction réussie { duration: '245ms', size: '15420 caractères' }
```

---

### Test 5 : Multiples lectures simultanées

**Objectif :** Vérifier la gestion de plusieurs sessions FFmpeg

**Étapes :**
```bash
# 1. Ouvrir 3 films différents en parallèle
# 2. Observer les logs et les ressources système
```

**Résultat attendu :**
- ✅ Les 3 films se lisent (avec possibilité de mise en buffer)
- ✅ Limite de 2 processus respectée (config MAX_CONCURRENT_PROCESSES)
- ✅ Les plus vieux processus sont tués automatiquement si limite atteinte

**Logs attendus :**
```
[...] [FFMPEG] ⚠️ Limite de processus atteinte (2), nettoyage...
[...] [FFMPEG] 🔪 Arrêt session { sessionId: '...', duration: '45.3s' }
```

---

### Test 6 : Fichiers avec caractères spéciaux

**Objectif :** Vérifier la gestion Unicode (é, à, ñ, etc.)

**Étapes :**
```bash
# 1. Film avec nom : "Le Père Noël est une Ordure (1982).mkv"
# 2. Tenter de lire
```

**Résultat attendu :**
- ✅ Fichier trouvé et lu correctement
- ✅ Normalisation NFD appliquée

---

### Test 7 : Timeout de transcodage

**Objectif :** Vérifier la gestion des transcodages qui prennent trop de temps

**Étapes :**
```bash
# 1. Simuler un fichier très lourd ou problématique
# (ou temporairement réduire maxWaitSeconds à 5s dans le code)

# 2. Observer le comportement après timeout
```

**Résultat attendu :**
- ✅ Erreur 503 (Service Unavailable)
- ✅ Message : "Le traitement a pris trop de temps"
- ✅ Header `Retry-After: 10`

---

## 🔍 Vérification des Logs

### Format attendu des logs

Tous les logs doivent maintenant suivre ce format :
```
[ISO_TIMESTAMP] [CONTEXT] emoji Message { data }
```

**Exemples :**
```
[2025-11-23T15:42:13.456Z] [HLS] 🎬 Démarrage transcodage { file: 'movie.mkv', audioTrack: '0' }
[2025-11-23T15:42:15.123Z] [SUBTITLES] ✅ Extraction réussie { duration: '245ms', size: '15420 caractères' }
[2025-11-23T15:42:18.789Z] [FFMPEG] 🔪 Arrêt session { sessionId: '...', pid: 12345, duration: '5.3s' }
```

### Contextes utilisés
- `[HLS]` : Routes /api/hls
- `[SUBTITLES]` : Routes /api/subtitles
- `[FFMPEG]` : Gestionnaire ffmpeg-manager
- `[STREAM]` : Routes /api/stream (si modifié)

---

## 🎯 Critères de Validation

La Phase 1 est **RÉUSSIE** si :

- [ ] Aucune erreur 500 sur les sous-titres PGS/VOBSUB
- [ ] Messages d'erreur clairs et cohérents partout
- [ ] Logs structurés avec timestamps sur toutes les routes critiques
- [ ] Fichiers corrompus gérés gracieusement (422, pas de crash)
- [ ] Transcodage normal fonctionne toujours
- [ ] Sous-titres texte fonctionnent toujours
- [ ] Multiples sessions gérées correctement
- [ ] Caractères Unicode gérés (fichiers avec accents)

---

## 📊 Rapport de Tests

**À remplir après les tests :**

| Test | Statut | Notes |
|------|--------|-------|
| 1. Sous-titres PGS | ⬜ | |
| 2. Fichier corrompu | ⬜ | |
| 3. Transcodage HLS | ⬜ | |
| 4. Sous-titres SRT/ASS | ⬜ | |
| 5. Lectures simultanées | ⬜ | |
| 6. Caractères spéciaux | ⬜ | |
| 7. Timeout | ⬜ | |

**Légende :** ✅ Réussi | ❌ Échoué | ⚠️ Partiel

---

## 🐛 Problèmes Connus

Aucun problème connu actuellement.

Si tu découvres des bugs pendant les tests, les documenter ici.

---

## 📝 Prochaines Étapes

Une fois la Phase 1 validée :

**Phase 2 : Performance** (3-4h)
- Implémenter cache intelligent (segments, métadonnées)
- Configurer VAAPI pour Intel Quick Sync (NAS Synology)
- Profils de qualité adaptatifs

**Phase 3 : Fluidité** (3-4h)
- Détection bande passante
- Buffer adaptatif dynamique
- Pré-chargement anticipatif

---

**Date de création :** 23 novembre 2025
**Statut :** Prêt pour tests


