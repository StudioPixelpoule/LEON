# LEON - Médiathèque Personnelle

Une application de streaming vidéo auto-hébergée, développée par **Pixel Poule**.

---

## 🇫🇷 Français

### Vue d'ensemble

**LEON** est une webapp de médiathèque personnelle qui permet de :
- Streamer des films et séries depuis un NAS Synology
- Transcoder à la volée les fichiers MKV/AVI en HLS
- Pré-transcoder les médias pour un seek instantané
- Gérer les métadonnées automatiquement via TMDB
- Suivre sa progression de visionnage

### Fonctionnalités

#### Streaming Vidéo
- ✅ Transcodage HLS temps réel (FFmpeg)
- ✅ Pré-transcodage pour seek instantané
- ✅ Support des fichiers MKV, MP4, AVI, MOV
- ✅ Accélération matérielle Intel Quick Sync (VAAPI)
- ✅ Buffer adaptatif intelligent
- ✅ Reprise de lecture automatique

#### Films
- ✅ Scan automatique des fichiers
- ✅ Métadonnées TMDB (affiches, synopsis, casting)
- ✅ Recherche intelligente (titre, acteur, réalisateur, genre)
- ✅ Catégorisation par genre automatique
- ✅ Système de favoris

#### Séries TV
- ✅ Support complet des séries (saisons, épisodes)
- ✅ Lecture automatique de l'épisode suivant
- ✅ Progression par épisode
- ✅ Affiches par saison

#### Administration
- ✅ Panneau d'administration complet
- ✅ Gestion des affiches (films et séries)
- ✅ Gestion de la queue de transcodage
- ✅ Statistiques de visionnage
- ✅ Nettoyage des fichiers manquants

#### Déploiement
- ✅ CI/CD GitHub Actions
- ✅ Docker multi-stage optimisé
- ✅ Auto-update via Watchtower
- ✅ Healthchecks intégrés

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│   │   GitHub    │────▶│   GitHub    │────▶│  Watchtower │      │
│   │    Push     │     │   Actions   │     │  (Auto-Pull)│      │
│   └─────────────┘     └─────────────┘     └──────┬──────┘      │
│                              │                    │             │
│                              ▼                    ▼             │
│                       ┌─────────────┐     ┌─────────────┐      │
│                       │    GHCR     │     │  Synology   │      │
│                       │   (Image)   │────▶│    NAS      │      │
│                       └─────────────┘     └─────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATION                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                    Docker Container                      │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │  │
│   │  │   Next.js   │  │   FFmpeg    │  │  Intel VAAPI    │  │  │
│   │  │   (App)     │  │ (Transcode) │  │  (Hardware)     │  │  │
│   │  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │  │
│   │         │                │                   │           │  │
│   │         └────────────────┼───────────────────┘           │  │
│   │                          │                               │  │
│   │                          ▼                               │  │
│   │  ┌─────────────────────────────────────────────────┐    │  │
│   │  │                    Volumes                       │    │  │
│   │  │  /leon/media/films    - Films (lecture seule)   │    │  │
│   │  │  /leon/media/series   - Séries (lecture seule)  │    │  │
│   │  │  /leon/transcoded     - Pré-transcodés          │    │  │
│   │  │  /tmp/leon-hls        - Cache HLS temporaire    │    │  │
│   │  └─────────────────────────────────────────────────┘    │  │
│   └─────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                      Supabase                            │  │
│   │  - media (films)                                         │  │
│   │  - series                                                │  │
│   │  - episodes                                              │  │
│   │  - playback_positions                                    │  │
│   │  - favorites                                             │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | Next.js 14 (App Router) |
| Styling | CSS Modules (design minimaliste) |
| Base de données | Supabase (PostgreSQL) |
| Transcodage | FFmpeg avec VAAPI |
| Streaming | HLS (HTTP Live Streaming) |
| Métadonnées | TMDB API |
| CI/CD | GitHub Actions |
| Container | Docker |
| Auto-update | Watchtower |

### Structure des Dossiers

```
LEON/
├── app/                          # Pages Next.js (App Router)
│   ├── api/                      # API Routes
│   │   ├── hls/                  # Streaming HLS
│   │   ├── scan/                 # Scan des films
│   │   ├── scan-series/          # Scan des séries
│   │   ├── transcode/            # Gestion transcodage
│   │   ├── media/                # API médias
│   │   ├── series/               # API séries
│   │   ├── playback-position/    # Sauvegarde progression
│   │   └── admin/                # API administration
│   ├── films/                    # Page catalogue films
│   ├── series/                   # Page catalogue séries
│   └── admin/                    # Panneau d'administration
├── components/                   # Composants React
│   ├── SimpleVideoPlayer/        # Lecteur vidéo HLS
│   ├── MovieModal/               # Modal détail film
│   ├── SeriesModal/              # Modal détail série
│   ├── ContinueWatchingRow/      # Carrousel "Continuer"
│   └── Header/                   # Navigation
├── lib/                          # Services et utilitaires
│   ├── transcoding-service.ts    # Service de transcodage
│   ├── ffmpeg-manager.ts         # Gestion FFmpeg
│   ├── supabase.ts               # Client Supabase
│   └── tmdb.ts                   # Client TMDB
├── supabase/
│   └── migrations/               # Migrations SQL
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI/CD GitHub Actions
├── Dockerfile                    # Image Docker multi-stage
└── docker-compose.nas.yml        # Config pour NAS Synology
```

### Installation

#### Prérequis

- NAS Synology avec Docker
- Compte GitHub (pour CI/CD)
- Compte Supabase
- API Key TMDB

#### 1. Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Exécuter les migrations SQL dans `supabase/migrations/`
3. Noter les clés API

#### 2. Configuration GitHub

1. Fork ou cloner le repository
2. Ajouter les secrets dans **Settings > Secrets and variables > Actions** :

| Secret | Description |
|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme Supabase |

#### 3. Configuration du NAS

```bash
# Créer la structure de dossiers
mkdir -p /volume1/docker/leon/media/films
mkdir -p /volume1/docker/leon/media/series
mkdir -p /volume1/docker/leon/transcoded
mkdir -p /volume1/docker/leon/cache

# Copier les fichiers de configuration
scp docker-compose.nas.yml user@nas:/volume1/docker/leon/docker-compose.yml
scp .env.example user@nas:/volume1/docker/leon/.env

# Éditer le fichier .env sur le NAS
ssh user@nas
cd /volume1/docker/leon
vi .env
```

#### 4. Variables d'Environnement (.env)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# TMDB
TMDB_API_KEY=votre_cle_tmdb

# OpenSubtitles (optionnel)
OPENSUBTITLES_API_KEY=votre_cle
OPENSUBTITLES_USERNAME=votre_user
OPENSUBTITLES_PASSWORD=votre_pass

# Sentry (optionnel)
SENTRY_DSN=https://xxx@sentry.io/xxx
```

#### 5. Authentification GitHub Container Registry

```bash
# Sur le NAS, se connecter à ghcr.io
docker login ghcr.io -u VotreUsername -p ghp_VotreToken

# Le token doit avoir les scopes: read:packages, write:packages
```

#### 6. Lancement

```bash
cd /volume1/docker/leon
sudo docker compose up -d
```

L'application sera accessible sur `http://NAS_IP:3000`

### Utilisation

#### Premier Scan

1. Copier vos films dans `/volume1/docker/leon/media/films/`
2. Copier vos séries dans `/volume1/docker/leon/media/series/`
3. Accéder à `http://NAS_IP:3000/admin`
4. Cliquer sur **"Scanner les films"** et **"Scanner les séries"**

#### Structure des Fichiers

**Films :**
```
/media/films/
├── Avatar (2009).mkv
├── Inception.2010.1080p.mkv
└── The Matrix.mkv
```

**Séries :**
```
/media/series/
└── Breaking Bad/
    ├── Season 1/
    │   ├── Breaking Bad S01E01.mkv
    │   └── Breaking Bad S01E02.mkv
    └── Season 2/
        └── Breaking Bad S02E01.mkv
```

#### Pré-transcodage

Pour un seek instantané, pré-transcoder les films populaires :
1. Aller dans **Admin > Pré-transcodage**
2. **Démarrer** le transcodage automatique
3. Les films sont transcodés par ordre de date d'ajout

### Déploiement CI/CD

Le déploiement est entièrement automatisé :

1. **Push sur `main`** → GitHub Actions build l'image Docker
2. **Image poussée** vers GitHub Container Registry (`ghcr.io`)
3. **Watchtower** (sur le NAS) détecte la nouvelle image
4. **Auto-update** du container (< 5 minutes)

#### Forcer une mise à jour manuelle

```bash
sudo docker compose pull
sudo docker compose up -d
```

### API Endpoints

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/health` | GET | Healthcheck |
| `/api/scan` | POST | Scanner les films |
| `/api/scan-series` | POST | Scanner les séries |
| `/api/hls` | GET | Streaming HLS |
| `/api/transcode` | GET/POST | Gestion transcodage |
| `/api/playback-position` | GET/POST/DELETE | Position de lecture |
| `/api/media/grouped` | GET | Liste des médias |
| `/api/series/list` | GET | Liste des séries |

### Maintenance

#### Logs

```bash
# Logs du container
sudo docker logs leon --tail 100

# Logs en temps réel
sudo docker logs leon -f
```

#### Nettoyage

```bash
# Nettoyer le cache HLS
sudo rm -rf /volume1/docker/leon/cache/*

# Nettoyer les transcodages incomplets
curl -X POST http://localhost:3000/api/transcode -d '{"action":"cleanup-incomplete"}'
```

#### Redémarrage

```bash
sudo docker compose restart leon
```

---

## 🇬🇧 English

### Overview

**LEON** is a self-hosted personal media library webapp that allows you to:
- Stream movies and TV series from a Synology NAS
- Transcode MKV/AVI files to HLS on-the-fly
- Pre-transcode media for instant seeking
- Automatically manage metadata via TMDB
- Track your viewing progress

### Features

#### Video Streaming
- ✅ Real-time HLS transcoding (FFmpeg)
- ✅ Pre-transcoding for instant seek
- ✅ MKV, MP4, AVI, MOV file support
- ✅ Intel Quick Sync hardware acceleration (VAAPI)
- ✅ Intelligent adaptive buffering
- ✅ Automatic playback resume

#### Movies
- ✅ Automatic file scanning
- ✅ TMDB metadata (posters, synopsis, cast)
- ✅ Smart search (title, actor, director, genre)
- ✅ Automatic genre categorization
- ✅ Favorites system

#### TV Series
- ✅ Full series support (seasons, episodes)
- ✅ Auto-play next episode
- ✅ Per-episode progress tracking
- ✅ Season posters

#### Administration
- ✅ Complete admin panel
- ✅ Poster management (movies and series)
- ✅ Transcoding queue management
- ✅ Viewing statistics
- ✅ Missing files cleanup

#### Deployment
- ✅ GitHub Actions CI/CD
- ✅ Optimized multi-stage Docker
- ✅ Auto-update via Watchtower
- ✅ Built-in healthchecks

### Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14 (App Router) |
| Styling | CSS Modules (minimalist design) |
| Database | Supabase (PostgreSQL) |
| Transcoding | FFmpeg with VAAPI |
| Streaming | HLS (HTTP Live Streaming) |
| Metadata | TMDB API |
| CI/CD | GitHub Actions |
| Container | Docker |
| Auto-update | Watchtower |

### Installation

#### Prerequisites

- Synology NAS with Docker
- GitHub account (for CI/CD)
- Supabase account
- TMDB API Key

#### Quick Start

1. **Setup Supabase**: Create project, run migrations
2. **Configure GitHub Secrets**: Add Supabase keys
3. **Setup NAS**: Create folders, copy docker-compose.yml
4. **Configure .env**: Add all API keys
5. **Login to ghcr.io**: `docker login ghcr.io`
6. **Launch**: `sudo docker compose up -d`

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# TMDB
TMDB_API_KEY=your_tmdb_key

# OpenSubtitles (optional)
OPENSUBTITLES_API_KEY=your_key
OPENSUBTITLES_USERNAME=your_user
OPENSUBTITLES_PASSWORD=your_pass
```

### CI/CD Workflow

1. **Push to `main`** → GitHub Actions builds Docker image
2. **Image pushed** to GitHub Container Registry (`ghcr.io`)
3. **Watchtower** (on NAS) detects new image
4. **Auto-update** container (< 5 minutes)

### API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Healthcheck |
| `/api/scan` | POST | Scan movies |
| `/api/scan-series` | POST | Scan TV series |
| `/api/hls` | GET | HLS streaming |
| `/api/transcode` | GET/POST | Transcoding management |
| `/api/playback-position` | GET/POST/DELETE | Playback position |
| `/api/media/grouped` | GET | List media |
| `/api/series/list` | GET | List series |

---

## 📄 Licence

© 2025 Pixel Poule - Usage personnel uniquement / Personal use only
