# LEON - Spécifications Techniques Détaillées

## 📐 Architecture Globale

```
┌─────────────────────────────────────────────────────────────┐
│                         UTILISATEUR                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  NEXT.JS 14 (App Router)                     │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │  Pages UI  │  │  Components │  │    API Routes        │  │
│  │  (TSX)     │  │  (React)    │  │  - /api/scan         │  │
│  │            │  │             │  │  - /api/metadata     │  │
│  │            │  │             │  │  - /api/download     │  │
│  └────────────┘  └─────────────┘  └──────────────────────┘  │
└───────┬─────────────────┬────────────────────┬───────────────┘
        │                 │                    │
        ▼                 ▼                    ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
│   Supabase   │  │     TMDB     │  │       pCloud         │
│  (PostgreSQL)│  │      API     │  │    (Storage)         │
│              │  │              │  │                      │
│  - media     │  │  - Metadata  │  │  - Video files       │
│  - profiles  │  │  - Posters   │  │  - Subtitles         │
│  - downloads │  │  - Backdrops │  │  - Download links    │
└──────────────┘  └──────────────┘  └──────────────────────┘
```

---

## 🎯 Flux de Données

### 1. Indexation (Scan)

```
┌──────────────────────────────────────────────────────────────┐
│                      POST /api/scan                           │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  listFolder(pCloud)  │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ filterVideoFiles()   │
                 └──────────┬───────────┘
                            │
                ┌───────────▼────────────┐
                │  POUR CHAQUE FICHIER   │
                │  (batch de 100)        │
                └───────────┬────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌────────────────┐  ┌───────────────┐
│ parseFileName │  │ searchMovie()  │  │ findSubtitles │
└───────┬───────┘  └────────┬───────┘  └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  getMovieDetails()   │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ INSERT INTO media    │
                 │    (Supabase)        │
                 └──────────────────────┘
```

### 2. Navigation & Recherche

```
┌──────────────────────────────────────────────────────────────┐
│                    Page d'accueil (/)                         │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  useEffect() mount   │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  SELECT * FROM media │
                 │      (Supabase)      │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │   setMedia(data)     │
                 └──────────┬───────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌────────────────┐  ┌───────────────┐
│ SearchBar     │  │  FilterBar     │  │  MediaGrid    │
│ (debounce)    │  │                │  │               │
└───────┬───────┘  └────────┬───────┘  └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ filteredMedia state  │
                 └──────────────────────┘
```

### 3. Téléchargement

```
┌──────────────────────────────────────────────────────────────┐
│              Click "Télécharger" sur fiche film               │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ POST /api/download   │
                 │  { mediaId }         │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ SELECT media WHERE   │
                 │   id = mediaId       │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ getDownloadLink()    │
                 │   (pCloud API)       │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ Return temporary URL │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  Browser downloads   │
                 │      via <a>         │
                 └──────────────────────┘
```

---

## 🗄️ Schéma de Base de Données (Détaillé)

### Table: `media`

| Colonne | Type | Description | Exemple |
|---------|------|-------------|---------|
| `id` | UUID | Identifiant unique | `550e8400-e29b-41d4-a716-446655440000` |
| `pcloud_fileid` | TEXT | ID pCloud du fichier | `d12345678` |
| `title` | TEXT | Titre en français | `Le Parrain` |
| `original_title` | TEXT | Titre original | `The Godfather` |
| `year` | INTEGER | Année de sortie | `1972` |
| `duration` | INTEGER | Durée en minutes | `175` |
| `file_size` | BIGINT | Taille en bytes | `2147483648` (2GB) |
| `quality` | TEXT | Qualité vidéo | `1080p` |
| `tmdb_id` | INTEGER | ID TMDB | `238` |
| `poster_url` | TEXT | URL jaquette | `https://image.tmdb.org/t/p/w500/...` |
| `backdrop_url` | TEXT | URL backdrop | `https://image.tmdb.org/t/p/original/...` |
| `overview` | TEXT | Synopsis | `L'histoire de la famille Corleone...` |
| `genres` | TEXT[] | Array de genres | `["Crime", "Drame"]` |
| `cast` | JSONB | Casting complet | `[{"name": "Marlon Brando", ...}]` |
| `subtitles` | JSONB | Sous-titres | `{"FR": {"fileid": "...", "name": "..."}}` |
| `created_at` | TIMESTAMP | Date création | `2025-10-06 20:00:00+00` |
| `updated_at` | TIMESTAMP | Date MAJ | `2025-10-06 20:00:00+00` |

### Index de Performance

```sql
-- Recherche par titre
CREATE INDEX idx_media_title ON media(title);
CREATE INDEX idx_media_title_trgm ON media USING GIN(title gin_trgm_ops);

-- Filtres
CREATE INDEX idx_media_year ON media(year);
CREATE INDEX idx_media_genres ON media USING GIN(genres);

-- Lookups
CREATE INDEX idx_media_tmdb_id ON media(tmdb_id);

-- Tri chronologique
CREATE INDEX idx_media_created_at ON media(created_at DESC);
```

---

## 🎨 Design System Complet

### Palette de Couleurs

```css
:root {
  /* Noir absolu */
  --color-black: #000000;
  
  /* Blanc pur */
  --color-white: #FFFFFF;
  
  /* Gris clairs (backgrounds) */
  --color-gray-100: #F5F5F5;  /* Background cards */
  --color-gray-200: #E5E5E5;  /* Borders subtle */
  
  /* Gris moyens (UI elements) */
  --color-gray-300: #D4D4D4;  /* Borders active */
  --color-gray-400: #A3A3A3;  /* Placeholders */
  
  /* Gris foncés (text) */
  --color-gray-500: #737373;  /* Text secondary */
  --color-gray-600: #525252;  /* Text tertiary */
  
  /* Rouge (suppression uniquement) */
  --color-red: #DC2626;
}
```

### Typographie

```css
/* Font Family */
font-family: 'Nunito', system-ui, -apple-system, sans-serif;

/* Poids */
--font-weight-thin: 200;      /* Métadonnées, descriptions */
--font-weight-regular: 500;   /* Corps de texte */
--font-weight-bold: 800;      /* Titres, boutons */

/* Tailles */
--font-size-xs: 0.75rem;      /* 12px - Petites infos */
--font-size-sm: 0.875rem;     /* 14px - Métadonnées */
--font-size-base: 1rem;       /* 16px - Corps */
--font-size-lg: 1.125rem;     /* 18px - Sous-titres */
--font-size-xl: 1.5rem;       /* 24px - Titres H2 */
--font-size-2xl: 2rem;        /* 32px - Titres H1 */
--font-size-3xl: 2.5rem;      /* 40px - Hero titles */
```

### Espacements

```css
--spacing-xs: 0.5rem;   /*  8px - Gap minimal */
--spacing-sm: 1rem;     /* 16px - Padding inputs */
--spacing-md: 1.5rem;   /* 24px - Padding cards */
--spacing-lg: 2rem;     /* 32px - Sections */
--spacing-xl: 3rem;     /* 48px - Grandes sections */
--spacing-2xl: 4rem;    /* 64px - Hero sections */
```

### Animations

```css
/* Transitions */
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-normal: 200ms cubic-bezier(0.4, 0, 0.2, 1);

/* Transforms */
/* Boutons */ transform: translateY(-2px);
/* Cards */   transform: translateY(-8px);
/* Items */   transform: translateX(4px);
/* Icons */   transform: scale(1.1);
```

---

## 🔒 Sécurité & Performance

### Row Level Security (RLS)

```sql
-- Phase 1: Lecture publique
CREATE POLICY "Media lisible par tous" 
  ON media FOR SELECT 
  USING (true);

-- Phase 2: Restriction par utilisateur
CREATE POLICY "Media lisible par users autorisés" 
  ON media FOR SELECT 
  USING (
    auth.uid() IN (
      SELECT user_id FROM authorized_users 
      WHERE media_id = media.id
    )
  );
```

### Optimisations Performance

1. **Images** : Next/Image avec lazy loading
2. **API Calls** : Debounce 300ms sur la recherche
3. **Batching** : Indexation par lots de 100
4. **Cache** : Limite 500MB navigateur
5. **Downloads** : Maximum 3 simultanés, chunks de 50MB

### Variables d'Environnement

```env
# Sécurité: JAMAIS commit ces fichiers
.env
.env.local
.env.production

# Utiliser .env.example comme template
# Stocker les secrets dans Vercel/Railway en prod
```

---

## 📱 Responsive Design

### Breakpoints

```css
/* Mobile first */
@media (min-width: 768px)  { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1440px) { /* Large desktop */ }
```

### Grid Responsive

```css
.mediaGrid {
  display: grid;
  
  /* Mobile: 2 colonnes */
  grid-template-columns: repeat(2, 1fr);
  
  /* Tablet: 3-4 colonnes */
  @media (min-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
  
  /* Desktop: 4-5 colonnes */
  @media (min-width: 1024px) {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
}
```

---

## 🚀 Roadmap Phase 2

### Authentification

- [ ] Email/password avec Supabase Auth
- [ ] Magic links
- [ ] Pages: `/login`, `/register`, `/forgot-password`
- [ ] Protected routes avec middleware

### Multi-utilisateurs

- [ ] Table `profiles`
- [ ] Table `authorized_users`
- [ ] Invitation par email
- [ ] Gestion des permissions

### Historique

- [ ] Table `downloads` peuplée
- [ ] Vue "Mes téléchargements"
- [ ] Statistiques par utilisateur

### Features Avancées

- [ ] Watchlist / Favoris
- [ ] Notes et critiques
- [ ] Recommandations basées sur l'historique
- [ ] Séries TV (en plus des films)

---

© 2025 Pixel Poule - LEON




