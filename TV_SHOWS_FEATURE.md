# Feature: Support Complet des Séries TV
**Date:** 7 octobre 2024  
**Statut:** ✅ Implémenté

---

## 🎯 Fonctionnalités

### 1. Une seule jaquette par série
- Les épisodes d'une même série sont **groupés** sous une seule entrée
- Le poster de la série est affiché (pas un poster par épisode)
- Évite d'avoir 50 affiches identiques de Kaamelott dans la bibliothèque

### 2. Modale avec saisons et épisodes
- Cliquer sur une série ouvre une modale dédiée
- **Sélecteur de saisons** : Boutons pour naviguer entre les saisons
- **Liste d'épisodes** : Affiche tous les épisodes de la saison sélectionnée
- **Bouton "Lire" par épisode** : Lance directement l'épisode choisi
- Informations affichées : numéro d'épisode, titre, durée, qualité

### 3. Groupement intelligent
- Groupement par `tmdb_id` (plus fiable que le nom de fichier)
- Tri automatique : Saison 1 → Saison 2 → ..., puis Épisode 1 → Épisode 2 → ...
- Comptage du nombre total d'épisodes disponibles

---

## 📁 Fichiers Créés/Modifiés

### Nouveaux fichiers

#### `app/api/media/grouped/route.ts`
API qui retourne :
- **Films** : un élément par film
- **Séries** : un élément par série, avec la liste des épisodes dans `episodes[]`

```typescript
export type GroupedMedia = Media & {
  episodes?: Media[] // Liste des épisodes
  total_episodes?: number // Nombre total d'épisodes
}
```

#### `components/MovieModal/MovieModalWithTV.tsx`
Nouvelle version de la modale avec :
- Détection automatique film vs série (`media_type`)
- Section "Épisodes" avec sélecteur de saisons
- Affichage des épisodes avec bouton "Lire" individuel

#### `lib/media-recognition/filenameSanitizer.ts`
Fonctions de nettoyage et détection :
- `fixEncoding()` : Corrige les caractères UTF-8 mal encodés
- `isTVShow()` : Détecte si c'est une série (S01E01, 1x01, etc.)
- `extractTVInfo()` : Extrait saison/épisode/nom de série
- `sanitizeFilename()` : Nettoyage complet pour recherche TMDB

#### `lib/media-recognition/universalIdentifier.ts`
Identifier universel pour films + séries :
- Utilise `sanitizeFilename()` pour nettoyer le nom
- Recherche sur TMDB (films + séries)
- Calcule la confiance avec bonus type/année
- Retourne `UniversalMediaMatch` avec infos série si applicable

#### `lib/tmdb.ts` (étendu)
Ajout du support séries TV :
- `searchTVShow()` : Recherche de séries sur TMDB
- `getTVShowDetails()` : Détails complets d'une série
- `searchMedia()` : Recherche universelle (films + séries)
- Nouveaux types : `TMDBTVShow`, `MediaType`

#### `supabase/add_tv_support.sql`
Migration SQL pour ajouter :
- `media_type` : 'movie' ou 'tv'
- `season_number`, `episode_number` : Numéros S/E
- `show_name` : Nom de la série
- `number_of_seasons`, `number_of_episodes` : Totaux TMDB
- Index optimisés pour requêtes séries

### Fichiers modifiés

#### `app/page.tsx`
- Utilise `/api/media/grouped` au lieu de `/api/media`
- Import de `MovieModalWithTV` au lieu de `MovieModal`
- Type `GroupedMedia` au lieu de `Media`
- Ne ferme plus la modale après lecture (pour lancer plusieurs épisodes)

#### `components/MovieModal/MovieModal.module.css`
Ajout des styles :
- `.tvInfo` : Info "X saisons · Y épisodes"
- `.episodesSection` : Conteneur de la section épisodes
- `.seasonSelector`, `.seasonButton`, `.seasonButtonActive` : Sélecteur de saisons
- `.episodesList`, `.episodeCard` : Liste des épisodes
- `.episodeNumber`, `.episodeInfo`, `.episodeTitle` : Détails d'un épisode
- `.episodePlayButton` : Bouton de lecture par épisode

#### `lib/supabase.ts`
Ajout des types :
- `MediaType = 'movie' | 'tv'`
- Champs séries dans `Media` : `media_type`, `season_number`, `episode_number`, `show_name`, `number_of_seasons`, `number_of_episodes`

#### `app/api/scan/route.ts`
- Utilise `identifyMedia()` au lieu de `identifyMovie()`
- Appelle `getMovieDetails()` ou `getTVShowDetails()` selon le type
- Stocke les infos de saison/épisode dans la base

---

## 🎨 Design (Pixel Poule)

### Modale Films
- Hero avec backdrop flou
- Bouton "▶ Lire" direct

### Modale Séries
- Hero avec backdrop flou
- Info "X saisons · Y épisodes" sous le titre
- **Section "Épisodes"** :
  - Sélecteur de saisons (boutons horizontaux, actif = noir, inactif = gris clair)
  - Liste d'épisodes :
    - Numéro d'épisode dans un carré noir (40x40px)
    - Titre de l'épisode + durée + qualité
    - Bouton "▶" pour lire (50x50px, noir)
  - Hover : fond gris clair, bordure gris foncé

### Palette
- Noir/blanc/gris uniquement
- Animations subtiles (<200ms)
- Espaces généreux
- Typographie : Nunito (Regular, Bold)

---

## 📊 Structure de Données

### Exemple de série groupée

```json
{
  "id": "uuid-serie",
  "media_type": "tv",
  "tmdb_id": 60573,
  "title": "Kaamelott",
  "poster_url": "https://image.tmdb.org/t/p/w500/...",
  "backdrop_url": "https://image.tmdb.org/t/p/original/...",
  "overview": "...",
  "genres": ["Comédie", "Action & Adventure"],
  "rating": 8.5,
  "number_of_seasons": 6,
  "number_of_episodes": 459,
  "total_episodes": 120,
  "episodes": [
    {
      "id": "uuid-ep1",
      "media_type": "tv",
      "title": "Kaamelott S01E01",
      "season_number": 1,
      "episode_number": 1,
      "show_name": "Kaamelott",
      "pcloud_fileid": "/path/to/Kaamelott.S01E01.mkv",
      "duration": 3,
      "quality": "720p",
      "file_size": "42.79 MB"
    },
    {
      "id": "uuid-ep2",
      "media_type": "tv",
      "title": "Kaamelott S01E02",
      "season_number": 1,
      "episode_number": 2,
      "show_name": "Kaamelott",
      "pcloud_fileid": "/path/to/Kaamelott.S01E02.mkv",
      "duration": 3,
      "quality": "720p",
      "file_size": "43.12 MB"
    }
  ]
}
```

---

## 🧪 Tests

### 1. Vérifier le groupement

```bash
curl http://localhost:3000/api/media/grouped
```

- Les séries doivent avoir un champ `episodes[]`
- Les films n'ont pas ce champ

### 2. Tester la modale série

1. Lancer l'app : http://localhost:3000
2. Cliquer sur une série (ex: Kaamelott)
3. Vérifier :
   - Affichage du nombre de saisons/épisodes
   - Sélecteur de saisons fonctionnel
   - Liste d'épisodes triés
   - Bouton "Lire" lance le bon épisode

### 3. Tester la modale film

1. Cliquer sur un film
2. Vérifier :
   - Bouton "▶ Lire" direct (pas de section épisodes)
   - Ferme la modale après lecture

---

## 🔧 Configuration Requise

### 1. Appliquer la migration SQL

```sql
-- Copier/coller le contenu de supabase/add_tv_support.sql
-- dans Supabase Dashboard → SQL Editor → Run
```

### 2. Vider la table (optionnel)

```sql
TRUNCATE TABLE media RESTART IDENTITY CASCADE;
```

### 3. Re-scanner

http://localhost:3000/admin → "Lancer le scan"

---

## 📈 Améliorations Futures

### Phase 2
- [ ] Page dédiée `/series` avec grid de séries uniquement
- [ ] Filtres : par genre, par nombre de saisons, par statut (en cours/terminée)
- [ ] Badge "Nouvelle saison" pour les ajouts récents
- [ ] Progression de visionnage (épisodes vus/non vus)

### Phase 3
- [ ] Lecture en série : bouton "Épisode suivant" automatique
- [ ] Marquage automatique des épisodes vus
- [ ] Notifications pour nouvelles saisons
- [ ] Support des extras (bonus, making-of, etc.)

---

## 🎉 Résultat

**Avant** : 1000 fichiers → 1000 entrées (dont 500 épisodes de Kaamelott en doublon)  
**Après** : 1000 fichiers → ~500 entrées (films individuels + séries groupées)

**Interface** : Propre, organisée, style Netflix avec design Pixel Poule minimaliste.

