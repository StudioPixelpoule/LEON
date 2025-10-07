# Migration: Support des Séries TV
**Date:** 7 octobre 2024  
**Auteur:** Pixel Poule

---

## 🎯 Objectif

Ajouter le support complet des séries TV à LEON, en plus des films, avec :
- Sanitization des noms de fichiers (correction encodage UTF-8)
- Détection automatique film vs série
- Recherche TMDB pour films ET séries
- Stockage des métadonnées de séries (saisons, épisodes)

---

## 📋 Étapes de Migration

### 1. Appliquer la migration SQL

Exécutez le fichier SQL dans votre dashboard Supabase :

```bash
# Ouvrez le fichier et copiez son contenu
cat supabase/add_tv_support.sql
```

Puis collez-le dans **Supabase Dashboard → SQL Editor → New Query → Run**

OU via la CLI Supabase :

```bash
supabase db push
```

### 2. Vider la table media (optionnel mais recommandé)

Pour repartir sur une base propre avec le nouveau système :

```sql
TRUNCATE TABLE media RESTART IDENTITY CASCADE;
```

⚠️ **ATTENTION** : Cela supprimera tous les films actuellement indexés !

### 3. Re-scanner la bibliothèque

Relancez le scan depuis l'interface admin :

1. Ouvrez **http://localhost:3000/admin**
2. Cliquez sur **"Lancer le scan"**
3. Attendez la fin du traitement (peut prendre plusieurs minutes pour 1000 fichiers)

---

## 🆕 Nouveautés

### Sanitization des noms de fichiers

Le système corrige automatiquement :
- Caractères UTF-8 mal encodés (`Ã©` → `é`, `Ì€` → `è`, etc.)
- Accents combinés
- Tags de release (1080p, BluRay, FRENCH, etc.)
- Années entre parenthèses
- Groupes de release

**Exemples** :
- `L'eÌtrange histoire de Benjamin Button.mkv` → `L'étrange histoire de Benjamin Button`
- `Alien, le HuitieÌ€me Passager.mkv` → `Alien, le Huitième Passager`
- `AsteÌrix & ObeÌlix - Mission CleÌopaÌ‚tre.mkv` → `Astérix & Obélix - Mission Cléopâtre`

### Détection automatique des séries

Patterns reconnus :
- `S01E01`, `S1E1` (format standard)
- `1x01` (format alternatif)
- `Season 1`, `Saison 1`
- `Episode 1`, `Épisode 1`

**Exemples** :
- `Kaamelott.S01E01.mkv` → Série TV, Saison 1, Épisode 1
- `Six.Feet.Under.1x05.mkv` → Série TV, Saison 1, Épisode 5
- `Better.Call.Saul.S05E10.mkv` → Série TV, Saison 5, Épisode 10

### Recherche TMDB unifiée

Le système cherche automatiquement dans :
1. **Films** (`/search/movie`)
2. **Séries TV** (`/search/tv`)

Et sélectionne le meilleur match selon :
- Similarité du titre (Levenshtein)
- Correspondance de l'année
- Correspondance du type (film vs série)
- Popularité TMDB

---

## 📊 Nouvelles colonnes dans `media`

| Colonne | Type | Description |
|---------|------|-------------|
| `media_type` | TEXT | `'movie'` ou `'tv'` |
| `season_number` | INTEGER | Numéro de saison (séries uniquement) |
| `episode_number` | INTEGER | Numéro d'épisode (séries uniquement) |
| `show_name` | TEXT | Nom de la série (séries uniquement) |
| `number_of_seasons` | INTEGER | Nombre total de saisons |
| `number_of_episodes` | INTEGER | Nombre total d'épisodes |

---

## 🧪 Tests

Après migration, vérifiez :

1. **Statistiques** : http://localhost:3000/api/stats
   - Devrait afficher un meilleur taux de posters (>60% au lieu de 31%)

2. **Films avec posters** :
   ```sql
   SELECT COUNT(*) FROM media WHERE poster_url IS NOT NULL AND poster_url != '/placeholder-poster.png';
   ```

3. **Séries détectées** :
   ```sql
   SELECT COUNT(*) FROM media WHERE media_type = 'tv';
   ```

4. **Répartition films/séries** :
   ```sql
   SELECT media_type, COUNT(*) FROM media GROUP BY media_type;
   ```

---

## 🔧 Dépannage

### Problème : "column media_type does not exist"

→ La migration SQL n'a pas été appliquée. Relancez `supabase/add_tv_support.sql`.

### Problème : "TMDB API error: 401"

→ Vérifiez que `TMDB_API_KEY` est correctement définie dans `.env`.

### Problème : Beaucoup de films non reconnus

→ Vérifiez les logs du scan dans la console. Les noms de fichiers très complexes peuvent nécessiter un ajustement manuel via l'interface de validation (à venir).

---

## 📈 Résultats Attendus

Avant migration :
- **307/1000 films avec posters (31%)**
- Beaucoup de séries non reconnues
- Caractères spéciaux mal affichés

Après migration :
- **~700/1000 médias avec posters (70%)**
- Séries TV correctement indexées avec saisons/épisodes
- Titres français correctement affichés

---

## 🚀 Prochaines Étapes

1. Interface de validation manuelle pour les médias non reconnus
2. Page dédiée aux séries TV avec groupement par saison
3. Amélioration de l'algorithme de reconnaissance pour les cas complexes
4. Support des multi-fichiers (CD1, CD2, Part1, Part2)

---

**Besoin d'aide ?** Consultez les logs du scan dans la console ou ouvrez une issue sur le repo.

