# Architecture du Système Vidéo LEON

## Vue d'ensemble
Le système vidéo de LEON est conçu pour offrir une expérience de streaming similaire à Netflix, avec support des formats MKV, AVI et MP4.

## Composants Principaux

### 1. Lecteur Vidéo
**Fichier**: `/components/SimpleVideoPlayer/SimpleVideoPlayer.tsx`
- Lecteur HTML5 natif avec interface Netflix
- Support HLS pour MKV/AVI (transcodage)
- Lecture directe pour MP4
- Fonctionnalités:
  - Changement de piste audio dynamique
  - Sous-titres extraits en temps réel
  - Timeline interactive avec preview
  - Contrôles clavier complets
  - Mode plein écran
  - Gestion du volume

### 2. APIs de Streaming

#### `/api/hls` - Transcodage HLS
- **Utilisation**: MKV et AVI uniquement
- **Méthode**: GET
- **Paramètres**:
  - `path`: Chemin du fichier
  - `playlist`: Pour obtenir le .m3u8
  - `segment`: Pour obtenir un segment spécifique
  - `audio`: Index de la piste audio (optionnel)
- **Optimisations**:
  - Hardware acceleration (VideoToolbox sur Mac)
  - Segments de 4 secondes pour démarrage rapide
  - Cache des sessions actives

#### `/api/stream` - Streaming Direct
- **Utilisation**: MP4 uniquement
- **Méthode**: GET
- **Paramètres**:
  - `path`: Chemin du fichier
- **Features**: Support des range requests pour seeking

#### `/api/media-info` - Informations Média
- **Utilisation**: Récupération des pistes audio/sous-titres
- **Méthode**: GET
- **Retourne**: Liste des pistes avec langues et codecs

#### `/api/subtitles` - Extraction Sous-titres
- **Utilisation**: Extraction et conversion en WebVTT
- **Méthode**: GET
- **Paramètres**:
  - `path`: Chemin du fichier
  - `track`: Index de la piste de sous-titres

#### `/api/video-duration` - Durée Vidéo
- **Utilisation**: Obtenir la durée exacte via ffprobe
- **Méthode**: GET
- **Retourne**: Durée en secondes et formatée

#### `/api/proxy-image` - Proxy Images TMDB
- **Utilisation**: Contourner les restrictions CORS
- **Méthode**: GET
- **Cache**: Images mises en cache côté client

### 3. Gestionnaire FFmpeg
**Fichier**: `/lib/ffmpeg-manager.ts`
- Gestion centralisée des processus FFmpeg
- Limite: 2 processus simultanés maximum
- Nettoyage automatique:
  - Sessions inactives > 5 minutes
  - Timeout après 30 minutes
  - Détection des processus orphelins
- Health check et monitoring

#### APIs de Gestion FFmpeg

##### `/api/cleanup` 
- **POST**: Nettoie tous les processus et le cache
- **GET**: Health check du système

##### `/api/ffmpeg-sessions`
- **GET**: État des sessions actives
- **DELETE**: Tue une session spécifique ou nettoie les orphelins

## Flux de Lecture

### Pour un fichier MKV/AVI:
1. Le client appelle `/api/hls?path=...&playlist=true`
2. FFmpeg démarre le transcodage en arrière-plan
3. Les segments HLS sont générés progressivement
4. Le lecteur charge le playlist.m3u8 et commence la lecture
5. Les segments suivants sont préchargés automatiquement

### Pour un fichier MP4:
1. Le client appelle `/api/stream?path=...`
2. Le serveur stream directement le fichier
3. Support natif du seeking via range requests

## Optimisations Performances

### Transcodage
- **Hardware Acceleration**: Utilisation du GPU (VideoToolbox)
- **Bitrate Adaptatif**: 3000k video, 192k audio
- **Segments Courts**: 4 secondes pour démarrage rapide
- **Multi-threading**: Utilisation de tous les cores CPU

### Cache
- **Répertoire**: `/tmp/leon-hls`
- **Structure**: Un dossier par session (hash MD5)
- **Nettoyage**: Automatique après fermeture du lecteur

### Limites
- **Processus FFmpeg**: Maximum 2 simultanés
- **Timeout Session**: 30 minutes maximum
- **Inactivité**: Nettoyage après 5 minutes

## Raccourcis Clavier

- **Espace/K**: Play/Pause
- **F**: Plein écran
- **M**: Mute/Unmute
- **↑/↓**: Volume +/- 10%
- **←/→**: Reculer/Avancer 10s
- **J/L**: Reculer/Avancer 10s
- **S**: Ouvrir menu paramètres
- **Échap**: Fermer menu ou quitter plein écran
- **Double-clic**: Plein écran

## Gestion d'Erreurs

### Erreurs Courantes
1. **Fichier non trouvé**: Vérifier que pCloud Drive est monté
2. **Codec non supporté**: Force le réencodage en AAC pour l'audio
3. **Processus FFmpeg bloqué**: Utiliser `/api/cleanup` pour nettoyer
4. **CORS images TMDB**: Utilisation du proxy `/api/proxy-image`

### Monitoring
- Endpoint santé: `GET /api/cleanup`
- Sessions actives: `GET /api/ffmpeg-sessions`
- Logs détaillés dans la console serveur

## Maintenance

### Nettoyage Manuel
```bash
# Tuer tous les processus FFmpeg
curl -X POST http://localhost:3000/api/cleanup

# Vérifier l'état du système
curl http://localhost:3000/api/ffmpeg-sessions
```

### Debug
- Les logs FFmpeg sont ignorés par défaut
- Pour debug: modifier `stdio: 'ignore'` en `stdio: 'inherit'` dans `/api/hls`
- Cache HLS visible dans `/tmp/leon-hls`

## Technologies Utilisées
- **Next.js 14**: Framework React avec App Router
- **FFmpeg**: Transcodage vidéo
- **FFprobe**: Analyse des métadonnées
- **HLS.js**: Non utilisé (support natif Safari préféré)
- **React Hooks**: État et cycle de vie
- **CSS Modules**: Styles scopés
