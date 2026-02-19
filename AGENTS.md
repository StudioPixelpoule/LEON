# LEON — Configuration Cursor

**Version** : 1.1.0  
**Date** : 19 février 2026  
**Projet** : LEON — Plateforme de streaming personnelle

---

## Vue d'Ensemble

Configuration Cursor professionnelle pour le projet LEON avec :

- **7 Rules** : Standards de code automatiques
- **7 Agents** : Assistants IA spécialisés
- **3 Commands** : Workflows automatisés

---

## Stack Technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| UI | React | 18.3.1 |
| Typage | TypeScript | 5.3.3 |
| Database | Supabase (PostgreSQL) | - |
| Streaming | HLS.js | 1.6.13 |
| Transcodage | FFmpeg | VAAPI/QSV |
| Monitoring | Sentry | 10.27.0 |
| Container | Docker | Multi-stage |

---

## Structure du Projet

```
LEON/
├── app/                          # Next.js App Router
│   ├── api/                      # 63 endpoints API
│   ├── admin/                    # Panneau administration
│   ├── films/                    # Catalogue films
│   ├── series/                   # Catalogue séries
│   └── ma-liste/                 # Favoris utilisateur
├── components/                   # Composants React
│   ├── SimpleVideoPlayer/        # Lecteur HLS principal
│   └── [20+ composants]
├── lib/                          # Services et utilitaires
│   ├── transcoding-service.ts    # Pré-transcodage (1847 lignes)
│   ├── ffmpeg-manager.ts         # Singleton FFmpeg (452 lignes)
│   ├── hardware-detection.ts     # Détection GPU/CPU
│   ├── hls-config.ts             # Configuration HLS
│   ├── media-recognition/        # Identification TMDB
│   └── hooks/                    # Hooks React
├── contexts/                     # AuthContext, etc.
├── types/                        # Types TypeScript
├── supabase/                     # Migrations SQL
└── .cursor/                      # Configuration Cursor
    ├── rules/                    # 7 fichiers .mdc
    ├── agents/                   # 7 fichiers .md
    └── commands/                 # 3 fichiers .md
```

---

## Rules (7)

| Rule | Description | Application |
|------|-------------|-------------|
| **core-standards.mdc** | Philosophie et standards LEON | Toujours |
| **code-quality.mdc** | TypeScript, conventions, imports | Toujours |
| **nextjs-patterns.mdc** | App Router, Server/Client Components | `app/**`, `*.tsx` |
| **supabase-patterns.mdc** | Clients, queries, RLS | `lib/supabase*` |
| **ffmpeg-streaming.mdc** | FFmpeg, HLS.js, transcodage | `lib/*ffmpeg*`, `api/hls/**` |
| **api-routes.mdc** | Structure routes API | `app/api/**` |
| **security.mdc** | Auth, RLS, validation, secrets | Toujours |

---

## Agents (7)

### Développement

| Agent | Usage | Invocation |
|-------|-------|------------|
| **@architect** | Planifier features, architecture | `@architect` |
| **@developer** | Implémenter code | `@developer` |
| **@debugger** | Diagnostiquer et corriger bugs | `@debugger` |

### Spécialiste

| Agent | Usage | Invocation |
|-------|-------|------------|
| **@streaming-specialist** | FFmpeg, HLS.js, performance | `@streaming-specialist` |

### Documentation

| Agent | Usage | Invocation |
|-------|-------|------------|
| **@docs** | Synchroniser Hub Notion, Journal, Suivi des tâches | `@docs` |

### Qualité

| Agent | Usage | Invocation |
|-------|-------|------------|
| **@qa-tester** | Tests, validation, checklists | `@qa-tester` |
| **@security-auditor** | Audit sécurité, RLS | `@security-auditor` |

---

## Commands (3)

| Command | Description | Usage |
|---------|-------------|-------|
| **/review** | Revue de code avant PR | Avant chaque merge |
| **/audit** | Audit qualité complet | Périodiquement |
| **/transcode** | Debug streaming/transcodage | Problèmes vidéo |

---

## Workflows Recommandés

### Nouvelle Fonctionnalité

```
1. @architect        → Planifier l'approche
2. @developer        → Implémenter le code
3. @qa-tester        → Valider et tester
4. /review           → Revue avant PR
5. @docs             → Mettre à jour Hub Notion + Journal + Tâches
```

### Problème de Streaming

```
1. /transcode        → Diagnostic rapide
2. @streaming-specialist → Analyse approfondie
3. @debugger         → Correction ciblée
4. @qa-tester        → Test de non-régression
5. @docs             → Mettre à jour Roadmap & Suivi
```

### Avant Déploiement

```
1. /audit            → Audit qualité complet
2. @security-auditor → Vérification sécurité
3. /review           → Revue finale
4. @docs             → Vérifier cohérence Hub ↔ code
```

### Suivi Projet

```
1. @docs             → Créer/mettre à jour tâches dans "Suivi des tâches"
2. @docs             → Ajouter entrée Journal de Développement
3. @docs             → Synchroniser Roadmap avec l'état actuel
```

---

## Règles Critiques

### Toujours

- Lire les rules avant de coder
- Vérifier auth avant opérations sensibles
- Logger avec préfixes : `[PLAYER]`, `[TRANSCODE]`, `[API]`, `[DB]`
- Types explicites, pas de `any`
- Gestion des erreurs explicite

### Jamais

- `console.log` sans préfixe en production
- `@ts-ignore` sans justification
- Catch silencieux `} catch (e) { /* */ }`
- Secrets côté client
- Bypass RLS sans raison

---

## Commandes NPM

```bash
npm run dev          # Développement
npm run build        # Build production
npm run lint         # ESLint
npm run gen:types    # Régénérer types Supabase
```

---

## Variables d'Environnement

Voir `.env.example` pour la liste complète.

**Publiques** (côté client) :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SENTRY_DSN`

**Secrètes** (côté serveur uniquement) :
- `SUPABASE_SERVICE_ROLE_KEY`
- `TMDB_API_KEY`
- `OPENSUBTITLES_API_KEY`

---

## Ressources

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [HLS.js](https://github.com/video-dev/hls.js)
- [FFmpeg](https://ffmpeg.org/documentation.html)
- [TMDB API](https://developer.themoviedb.org/docs)

---

**Maintenu par** : Pixel Poule  
**Repository** : [github.com/StudioPixelpoule/LEON](https://github.com/StudioPixelpoule/LEON)
