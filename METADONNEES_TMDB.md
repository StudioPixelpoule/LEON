# 🎬 Système de Métadonnées TMDB Complet - LEON

## ✅ **Implémentation Terminée**

Le système de récupération des métadonnées TMDB est maintenant **100% opérationnel** avec toutes les informations enrichies.

---

## 📊 Métadonnées Récupérées

### Informations de Base
✅ **Titre** (français + original)  
✅ **Année** de sortie  
✅ **Durée** formatée (ex: "2h 15min")  
✅ **Synopsis** complet en français  
✅ **Tagline** (phrase d'accroche)  
✅ **Note TMDB** sur 10 avec nombre de votes  
✅ **Genres** (liste complète)  

### Visuels
✅ **Poster** haute résolution (w500)  
✅ **Backdrop** ultra HD (w1280)  
✅ **Photos acteurs** (w185)  

### Équipe
✅ **Réalisateur** avec photo  
✅ **Top 10 acteurs** avec rôles et photos  
✅ **Scénaristes** (disponible via helper)  

### Extras
✅ **Bande-annonce** YouTube (lien direct)  
✅ **Plateformes de streaming** Canada (Netflix, Prime Video, etc.)  
✅ **Date de sortie** complète  
✅ **Budget/Revenue** (disponible mais non affiché)  

---

## 🗂️ Structure de la Base de Données

### Table `media` Mise à Jour

```sql
CREATE TABLE media (
  id UUID PRIMARY KEY,
  pcloud_fileid TEXT UNIQUE NOT NULL,
  
  -- Infos de base
  title TEXT NOT NULL,
  original_title TEXT,
  year INTEGER,
  
  -- Durée
  duration INTEGER,                    -- Minutes brutes
  formatted_runtime TEXT,              -- Format "2h 15min"
  
  -- Fichier
  file_size BIGINT,
  quality TEXT,
  
  -- TMDB
  tmdb_id INTEGER,
  poster_url TEXT,
  backdrop_url TEXT,
  overview TEXT,
  
  -- Classification
  genres TEXT[],                       -- Array: ["Action", "Thriller"]
  rating DECIMAL(3,1),                 -- Note TMDB sur 10
  vote_count INTEGER,
  tagline TEXT,
  release_date TIMESTAMP,
  
  -- Équipe (JSONB)
  director JSONB,                      -- {name, profileUrl}
  cast JSONB,                          -- [{name, character, profileUrl}]
  
  -- Extras
  trailer_url TEXT,                    -- YouTube
  watch_providers JSONB,               -- {streaming[], rent[], buy[]}
  subtitles JSONB,                     -- Sous-titres
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Nouveaux Index

```sql
-- Tri par note
CREATE INDEX idx_media_rating ON media(rating DESC);

-- Tri par date de sortie
CREATE INDEX idx_media_release_date ON media(release_date DESC);

-- Recherche par réalisateur
CREATE INDEX idx_media_director ON media USING GIN((director->>'name'));
```

---

## 📁 Nouveaux Fichiers Créés

### 1. **`lib/tmdb.ts`** (étendu)
- Types complets pour toutes les métadonnées TMDB
- Helpers pour formatage (`formatRuntime`, `getMainCast`, `getDirector`, `getMainTrailer`)
- Support multi-tailles d'images (w92 → w1280 → original)
- URLs YouTube automatiques

### 2. **`lib/media-processing/metadataProcessor.ts`**
- Processing complet des données TMDB
- Enrichissement avec calculs (note arrondie, durée formatée)
- Extraction des plateformes de streaming Canada
- Sauvegarde optimisée en Supabase

### 3. **`app/movie/[id]/page.tsx`** (mis à jour)
- Affichage complet des métadonnées
- Hero avec backdrop flou Pixel Poule
- Section casting avec grilles
- Lien bande-annonce YouTube
- Design 100% conforme .cursorrules

### 4. **`app/movie/[id]/page.module.css`**
- Styles Pixel Poule complets
- Responsive mobile-first
- Animations translateY(-2px) et translateX(4px)
- Backdrop overlay gradient blanc

---

## 🎨 Design Page Détail

### Hero Section

```
┌──────────────────────────────────────────────────┐
│  BACKDROP FLOU (w1280)                           │
│  └─ Overlay gradient blanc ───────────────────┐  │
│                                                │  │
│  ┌────────┐  ┌────────────────────────────────┤  │
│  │        │  │                                 │  │
│  │ POSTER │  │  TITRE (3rem, bold)             │  │
│  │ 300x   │  │  Titre original (italic, thin)  │  │
│  │ 450px  │  │  "Tagline" (italic, thin)       │  │
│  │        │  │                                 │  │
│  │ Border │  │  2024 · 2h 15min · Action      │  │
│  │ 1px    │  │                                 │  │
│  │        │  │  ★ 8.5/10 (12,345 votes)       │  │
│  │        │  │  Réalisation : Christopher...  │  │
│  │        │  │                                 │  │
│  └────────┘  │  Synopsis                       │  │
│              │  Lorem ipsum dolor sit amet...  │  │
│              │                                 │  │
│              │  [Télécharger] [Ajouter file]   │  │
│              │  Sous-titres: [FR ▼]           │  │
│              └─────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Casting Grid

```
┌─────────────────────────────────────────────────┐
│  Distribution                                    │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────┐│
│  │ ┌────┐       │  │ ┌────┐       │  │  ...   ││
│  │ │ 80x│ Actor │  │ │ 80x│ Actor │  │        ││
│  │ │120 │ Name  │  │ │120 │ Name  │  │        ││
│  │ │    │       │  │ │    │       │  │        ││
│  │ └────┘ Role  │  │ └────┘ Role  │  │        ││
│  │  (italic)    │  │  (italic)    │  │        ││
│  └──────────────┘  └──────────────┘  └────────┘│
│  → Hover: translateX(4px)                       │
└─────────────────────────────────────────────────┘
```

---

## 🔌 Utilisation

### 1. Récupération Automatique (Scan)

Le système de scan intègre automatiquement les métadonnées :

```typescript
// Dans app/api/scan/route.ts
const movieDetails = await getMovieDetails(movieMatch.tmdbId)

// Toutes les métadonnées sont sauvegardées automatiquement :
await supabase.from('media').insert({
  // ... toutes les nouvelles colonnes
  formatted_runtime: formatRuntime(movieDetails.runtime),
  rating: movieDetails.vote_average,
  director: getDirector(movieDetails.credits),
  cast: getMainCast(movieDetails.credits, 10),
  trailer_url: getYouTubeUrl(getMainTrailer(movieDetails.videos).key),
  // ...
})
```

### 2. Processing Manuel

Pour enrichir un film spécifique :

```typescript
import { processMovieMetadata, saveMovieMetadata } from '@/lib/media-processing/metadataProcessor'

// 1. Traiter les métadonnées
const metadata = await processMovieMetadata(tmdbId)

// 2. Sauvegarder
await saveMovieMetadata(fileId, metadata, { size, quality })
```

### 3. Récupération Enrichie

Pour afficher un film :

```typescript
import { getEnrichedMovie } from '@/lib/media-processing/metadataProcessor'

const movie = await getEnrichedMovie(mediaId)

// Accès direct à toutes les métadonnées :
console.log(movie.formatted_runtime)  // "2h 15min"
console.log(movie.rating)             // 8.5
console.log(movie.director.name)      // "Christopher Nolan"
console.log(movie.cast[0].name)       // "Leonardo DiCaprio"
console.log(movie.trailer_url)        // "https://youtube.com/watch?v=..."
```

---

## 📚 Helpers Disponibles

### Formatage

```typescript
import { formatRuntime, getTMDBImageUrl, getYouTubeUrl } from '@/lib/tmdb'

formatRuntime(135)  // → "2h 15min"
formatRuntime(90)   // → "1h 30min"
formatRuntime(45)   // → "45 min"

getTMDBImageUrl('/path.jpg', 'w500')      // Poster
getTMDBImageUrl('/path.jpg', 'w1280')     // Backdrop
getTMDBImageUrl('/path.jpg', 'w185')      // Actor photo

getYouTubeUrl('abc123')  // → "https://youtube.com/watch?v=abc123"
```

### Extraction Équipe

```typescript
import { getMainCast, getDirector, getWriters, getMainTrailer } from '@/lib/tmdb'

const cast = getMainCast(movie.credits, 10)     // Top 10 acteurs
const director = getDirector(movie.credits)     // Réalisateur
const writers = getWriters(movie.credits)       // Scénaristes
const trailer = getMainTrailer(movie.videos)    // Trailer officiel
```

---

## 🎯 Exemples de Données

### Exemple de Film Enrichi

```json
{
  "id": "uuid",
  "title": "Inception",
  "original_title": "Inception",
  "year": 2010,
  "duration": 148,
  "formatted_runtime": "2h 28min",
  "file_size": 8589934592,
  "quality": "1080p",
  "tmdb_id": 27205,
  "poster_url": "https://image.tmdb.org/t/p/w500/...",
  "backdrop_url": "https://image.tmdb.org/t/p/w1280/...",
  "overview": "Dom Cobb est un voleur expérimenté...",
  "genres": ["Action", "Science-Fiction", "Aventure"],
  "rating": 8.4,
  "vote_count": 32145,
  "tagline": "Votre esprit est la scène du crime",
  "release_date": "2010-07-16T00:00:00Z",
  "director": {
    "name": "Christopher Nolan",
    "profileUrl": "https://image.tmdb.org/t/p/w185/..."
  },
  "cast": [
    {
      "name": "Leonardo DiCaprio",
      "character": "Dom Cobb",
      "profileUrl": "https://image.tmdb.org/t/p/w185/..."
    },
    {
      "name": "Marion Cotillard",
      "character": "Mal",
      "profileUrl": "https://image.tmdb.org/t/p/w185/..."
    }
    // ... 8 autres acteurs
  ],
  "trailer_url": "https://www.youtube.com/watch?v=YoHD9XEInc0",
  "watch_providers": {
    "streaming": ["Netflix", "Amazon Prime Video"],
    "rent": ["Google Play", "iTunes"],
    "buy": ["iTunes", "Amazon Video"]
  }
}
```

---

## ⚙️ Configuration Next.js

Image domains ajoutés automatiquement :

```javascript
// next.config.js
images: {
  domains: ['image.tmdb.org'],
  formats: ['image/webp']
}
```

---

## 🎨 Conformité Design

### ✅ Checklist Pixel Poule

- [x] Palette noir/blanc/gris stricte
- [x] Nunito (200, 500, 800)
- [x] Animations < 200ms
- [x] translateY(-2px) sur boutons
- [x] translateX(4px) sur cards casting
- [x] Backdrop overlay gradient blanc
- [x] Pas de couleurs sur hover
- [x] Responsive mobile-first
- [x] Espaces généreux (spacing variables)
- [x] Hiérarchie typographique claire

---

## 📈 Performances

### Build Production

```
Route (app/movie/[id])    891 B    93.3 kB (First Load)
```

**Optimisations :**
- Images lazy-loaded (sauf poster/backdrop)
- Unoptimized flag pour TMDB (déjà optimisées)
- CSS Modules (scoped styles)
- Métadonnées server-side (SSR)

---

## 🚀 Prochaines Étapes Possibles

### Phase 2

- [ ] **Recommandations** basées sur genres/réalisateur
- [ ] **Collections TMDB** (trilogies, franchises)
- [ ] **Multi-langues** (switch FR/EN)
- [ ] **Filtres avancés** par note/acteur/réalisateur
- [ ] **Watchlist** personnelle
- [ ] **Mode sombre** (si demandé)

### Fonctionnalités Avancées

- [ ] **Trailer embedded** (player YouTube intégré)
- [ ] **Photos du film** (gallery TMDB)
- [ ] **Budget/Revenue** charts
- [ ] **Critiques** utilisateurs
- [ ] **Actualités** liées au film

---

## 📝 Notes Techniques

### Langue par Défaut

Le système utilise `fr-FR` par défaut pour toutes les requêtes TMDB :

```typescript
await getMovieDetails(tmdbId, 'fr-FR')
```

Les synopsis, titres et genres sont automatiquement en français.

### Cache TMDB

Les métadonnées sont mises en cache dans Supabase. Pas besoin de requêter TMDB à chaque affichage.

### Rate Limiting

TMDB autorise 40 requêtes/10 secondes. Le système de scan respecte ces limites avec les batchs.

---

## ✅ Résultat Final

Le système de métadonnées TMDB est **production-ready** et apporte :

✅ **Informations complètes** sur chaque film  
✅ **Interface élégante** Pixel Poule  
✅ **Performance optimisée** (SSR + cache)  
✅ **Expérience enrichie** (casting, trailer, plateformes)  
✅ **100% conforme** design system  

**Prêt à afficher votre collection avec style !** 🎬

---

**Développé avec ❤️ par Pixel Poule**  
© 2025 - LEON v1.2 - Métadonnées TMDB Complètes




