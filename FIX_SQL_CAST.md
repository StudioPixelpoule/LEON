# 🔧 Correction : Erreur SQL "cast"

## Problème

Erreur SQL lors de l'exécution du schéma Supabase :
```
ERROR: 42601: syntax error at or near "cast"
LINE 30: cast JSONB, -- Casting complet depuis TMDB
```

## Cause

`cast` est un **mot réservé** en PostgreSQL (utilisé pour les conversions de type : `CAST(value AS type)`).

## Solution Appliquée

Renommé la colonne `cast` en `movie_cast` dans tous les fichiers :

### ✅ Fichiers Modifiés

1. **`supabase/schema.sql`**
   ```sql
   -- AVANT
   cast JSONB, -- Casting complet depuis TMDB
   
   -- APRÈS
   movie_cast JSONB, -- Casting complet depuis TMDB
   ```

2. **`app/api/scan/route.ts`**
   ```typescript
   // AVANT
   cast: movieDetails?.credits?.cast || null,
   
   // APRÈS
   movie_cast: movieDetails?.credits?.cast || null,
   ```

3. **`app/api/metadata/route.ts`**
   ```typescript
   // AVANT
   cast: movieDetails.credits?.cast || null,
   
   // APRÈS
   movie_cast: movieDetails.credits?.cast || null,
   ```

4. **`lib/supabase.ts`**
   ```typescript
   // AVANT
   cast: Record<string, any> | null
   
   // APRÈS
   movie_cast: Record<string, any> | null
   ```

5. **`lib/media-processing/metadataProcessor.ts`**
   ```typescript
   // AVANT
   cast: { name: string; character: string; profileUrl: string | null }[]
   
   // APRÈS
   movieCast: { name: string; character: string; profileUrl: string | null }[]
   
   // ET
   cast: metadata.cast,
   
   // DEVIENT
   movie_cast: metadata.movieCast,
   ```

6. **`app/movie/[id]/page.tsx`**
   ```typescript
   // AVANT
   const cast = movie.cast ?
     (Array.isArray(movie.cast) ? movie.cast : []) :
     []
   
   // APRÈS
   const cast = movie.movie_cast ?
     (Array.isArray(movie.movie_cast) ? movie.movie_cast : []) :
     []
   ```

## Vérification

Tous les fichiers TypeScript compilent sans erreur :
- ✅ `app/api/scan/route.ts`
- ✅ `app/api/metadata/route.ts`
- ✅ `lib/supabase.ts`
- ✅ `lib/media-processing/metadataProcessor.ts`
- ✅ `app/movie/[id]/page.tsx`

## Correction Supplémentaire : Index GIN sur TEXT

### Problème 2
```
ERROR: 42704: data type text has no default operator class for access method "gin"
```

### Cause
Les index GIN sur des champs TEXT nécessitent l'extension `pg_trgm` et l'opérateur `gin_trgm_ops`.

### Solution
Ajouté l'opérateur `gin_trgm_ops` aux index GIN sur TEXT :

```sql
-- AVANT
CREATE INDEX idx_media_director ON media USING GIN((director->>'name'));

-- APRÈS
CREATE INDEX idx_media_director ON media USING GIN((director->>'name') gin_trgm_ops);
```

## Prochaine Étape

Vous pouvez maintenant **exécuter le schéma SQL** dans Supabase :

1. Allez sur : https://supabase.com
2. Ouvrez votre projet
3. SQL Editor
4. Copiez-collez le contenu de `supabase/schema.sql`
5. Exécutez (Run)

Le schéma devrait s'exécuter sans erreur ! ✅

## Mots Réservés PostgreSQL à Éviter

Autres mots courants à éviter dans les noms de colonnes :
- `user`, `order`, `table`, `index`, `key`, `value`
- `select`, `insert`, `update`, `delete`, `from`, `where`
- `join`, `group`, `having`, `limit`, `offset`
- `cast`, `case`, `when`, `then`, `else`, `end`

**Bonne pratique** : Toujours préfixer les noms ambigus (ex: `user_id`, `order_date`, `movie_cast`).

