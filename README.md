# LEON - Médiathèque Personnelle / Personal Media Library

## 🇫🇷 Français

### Vue d'ensemble

**LEON** est une webapp minimaliste de médiathèque personnelle développée par **Pixel Poule**. Elle permet d'indexer, organiser et télécharger des films stockés sur pCloud avec une interface épurée noir/blanc/gris.

### Fonctionnalités

**Phase 1 (Actuelle) :**
- ✅ Indexation automatique des fichiers MP4 depuis pCloud
- ✅ Récupération automatique des métadonnées via TMDB API (jaquettes, synopsis, casting)
- ✅ Détection et association des sous-titres (.srt, .vtt)
- ✅ Interface de navigation avec grille de jaquettes
- ✅ Recherche instantanée avec debounce (300ms)
- ✅ Filtres par catégorie
- ✅ Page détail avec backdrop flou et informations complètes
- ✅ Système de file de téléchargement avec indicateur visuel (3 points animés)
- ✅ Design minimaliste radical (Pixel Poule)

**Phase 2 (À venir) :**
- 🔜 Authentification multi-utilisateurs (Supabase Auth)
- 🔜 Profils personnalisés
- 🔜 Historique de visionnage
- 🔜 Partage de bibliothèque avec amis

### Architecture

**Stack Technique :**
- **Frontend :** Next.js 14 (App Router)
- **Styling :** CSS pur avec variables (pas de Tailwind utilisé)
- **Base de données :** Supabase (PostgreSQL)
- **Stockage :** pCloud API
- **Métadonnées :** TMDB API
- **Typographie :** Nunito (Google Fonts - 200, 500, 800)

**Structure des dossiers :**
```
LEON/
├── app/                    # Pages Next.js (App Router)
│   ├── layout.tsx         # Layout global avec Nunito
│   ├── page.tsx           # Grille de films
│   ├── movie/[id]/        # Détail film
│   └── api/               # API Routes
│       ├── scan/          # Scan pCloud
│       ├── metadata/      # Refresh TMDB
│       └── download/      # Génération liens téléchargement
├── components/            # Composants React
│   ├── MediaCard.tsx
│   ├── MediaGrid.tsx
│   ├── SearchBar.tsx
│   ├── FilterBar.tsx
│   └── DownloadQueue.tsx
├── lib/                   # Wrappers API
│   ├── supabase.ts
│   ├── pcloud.ts
│   └── tmdb.ts
├── styles/
│   └── globals.css        # Design system complet
└── supabase/
    └── schema.sql         # Schéma base de données
```

### Installation

**Prérequis :**
- Node.js 18.17+
- Compte Supabase
- Compte pCloud avec Access Token
- API Key TMDB

**Étapes :**

```bash
# 1. Cloner le projet
git clone [url-du-repo]
cd LEON

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos clés API

# 4. Configurer Supabase
# - Créer un projet sur supabase.com
# - Exécuter le script supabase/schema.sql dans SQL Editor

# 5. Lancer en développement
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

### Configuration

**Variables d'environnement nécessaires :**

```env
# pCloud
PCLOUD_ACCESS_TOKEN=votre_token_pcloud
PCLOUD_MEDIA_FOLDER_ID=id_du_dossier

# TMDB
TMDB_API_KEY=votre_cle_tmdb

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_KEY=eyJxxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Comment obtenir les clés :**

1. **pCloud :** Se connecter à pCloud → Paramètres → Security → App Access Token
2. **TMDB :** Créer un compte sur [themoviedb.org](https://www.themoviedb.org) → Settings → API
3. **Supabase :** Créer un projet sur [supabase.com](https://supabase.com) → Settings → API

### Utilisation

**Premier scan :**

```bash
# Déclencher l'indexation initiale
curl -X POST http://localhost:3000/api/scan
```

L'API va :
1. Scanner votre dossier pCloud configuré
2. Extraire les métadonnées des noms de fichiers
3. Rechercher les informations sur TMDB
4. Détecter les sous-titres associés
5. Tout indexer dans Supabase

**Parcourir la bibliothèque :**
- Ouvrir `http://localhost:3000`
- Utiliser la barre de recherche (debounce 300ms)
- Filtrer par catégorie
- Cliquer sur une jaquette pour voir les détails

**Télécharger un film :**
- Ouvrir la fiche détaillée
- Cliquer sur "Télécharger" ou "Ajouter à la file"
- Suivre la progression dans la file flottante (en bas à droite)

### Déploiement

**Phase 1 - Local uniquement :**
Installation sur MacBook Air M1 avec pCloud synchronisé localement.

**Phase 2 - Production (Vercel) :**

```bash
# 1. Installer Vercel CLI
npm i -g vercel

# 2. Déployer
vercel

# 3. Configurer les variables d'environnement sur Vercel
vercel env add PCLOUD_ACCESS_TOKEN
vercel env add TMDB_API_KEY
# ... (toutes les autres variables)

# 4. Redéployer avec les nouvelles variables
vercel --prod
```

**Optimisations MacBook Air M1 :**
- Cache navigateur limité à 500MB
- Téléchargements par chunks de 50MB
- Maximum 3 téléchargements simultanés
- Indexation incrémentale (100 films/batch)

### Design System

**Palette stricte :**
- Noir : `#000000`
- Blanc : `#FFFFFF`
- Gris (6 nuances) : `#F5F5F5` à `#525252`
- Rouge : `#DC2626` (uniquement pour suppression)

**Animations :**
- Boutons : `translateY(-2px)` au hover
- Cards : `translateY(-8px)` au hover
- Durée : 150-200ms max
- Loader : 3 points animés (pulse)

**Typographie :**
- Font : Nunito (Google Fonts)
- Poids : 200 (thin), 500 (regular), 800 (bold)
- Hiérarchie : 3-4 tailles maximum

### Critères de succès

✅ Interface épurée sans fioriture  
✅ Chargement instantané des jaquettes (Next/Image)  
✅ Téléchargement en arrière-plan fluide  
✅ Respect strict du design system  
✅ Animations subtiles < 200ms  
✅ Responsive parfait mobile/desktop  
✅ Authenticité Pixel Poule

---

## 🇬🇧 English

### Overview

**LEON** is a minimalist personal media library webapp developed by **Pixel Poule**. It indexes, organizes, and downloads movies stored on pCloud with a clean black/white/gray interface.

### Features

**Phase 1 (Current):**
- ✅ Automatic MP4 file indexing from pCloud
- ✅ Automatic metadata fetching via TMDB API (posters, synopsis, cast)
- ✅ Subtitle detection and association (.srt, .vtt)
- ✅ Navigation interface with poster grid
- ✅ Instant search with 300ms debounce
- ✅ Category filters
- ✅ Detail page with blurred backdrop and complete information
- ✅ Download queue system with visual indicator (3 animated dots)
- ✅ Radical minimalist design (Pixel Poule)

**Phase 2 (Coming):**
- 🔜 Multi-user authentication (Supabase Auth)
- 🔜 Personal profiles
- 🔜 Viewing history
- 🔜 Library sharing with friends

### Architecture

**Tech Stack:**
- **Frontend:** Next.js 14 (App Router)
- **Styling:** Pure CSS with variables (Tailwind not used)
- **Database:** Supabase (PostgreSQL)
- **Storage:** pCloud API
- **Metadata:** TMDB API
- **Typography:** Nunito (Google Fonts - 200, 500, 800)

### Installation

**Requirements:**
- Node.js 18.17+
- Supabase account
- pCloud account with Access Token
- TMDB API Key

**Steps:**

```bash
# 1. Clone the project
git clone [repo-url]
cd LEON

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your API keys

# 4. Setup Supabase
# - Create a project on supabase.com
# - Run supabase/schema.sql in SQL Editor

# 5. Start development server
npm run dev
```

Application will be available at `http://localhost:3000`

### Usage

**Initial scan:**

```bash
# Trigger initial indexing
curl -X POST http://localhost:3000/api/scan
```

The API will:
1. Scan your configured pCloud folder
2. Extract metadata from filenames
3. Search for information on TMDB
4. Detect associated subtitles
5. Index everything in Supabase

**Browse library:**
- Open `http://localhost:3000`
- Use search bar (300ms debounce)
- Filter by category
- Click on a poster to see details

**Download a movie:**
- Open detail page
- Click "Download" or "Add to queue"
- Track progress in floating queue (bottom right)

### Deployment

**Phase 1 - Local only:**
Installation on MacBook Air M1 with locally synced pCloud.

**Phase 2 - Production (Vercel):**

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel

# 3. Configure environment variables on Vercel
vercel env add PCLOUD_ACCESS_TOKEN
vercel env add TMDB_API_KEY
# ... (all other variables)

# 4. Redeploy with new variables
vercel --prod
```

### Design System

**Strict Palette:**
- Black: `#000000`
- White: `#FFFFFF`
- Gray (6 shades): `#F5F5F5` to `#525252`
- Red: `#DC2626` (deletion only)

**Animations:**
- Buttons: `translateY(-2px)` on hover
- Cards: `translateY(-8px)` on hover
- Duration: 150-200ms max
- Loader: 3 animated dots (pulse)

**Typography:**
- Font: Nunito (Google Fonts)
- Weights: 200 (thin), 500 (regular), 800 (bold)
- Hierarchy: 3-4 sizes maximum

---

## 📄 Licence

© 2025 Pixel Poule - Usage personnel uniquement




