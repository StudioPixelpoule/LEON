# Variables d'environnement pour l'optimisation des médias

Pour utiliser la fonctionnalité d'optimisation des médias, ajoutez ces variables à votre fichier `.env` ou `.env.local` :

```env
# Chemins des dossiers de films
PCLOUD_LOCAL_PATH=/Users/lionelvernay/pCloud Drive/films
PCLOUD_OPTIMIZED_PATH=/Users/lionelvernay/pCloud Drive/films_optimized
```

## Détails

- **PCLOUD_LOCAL_PATH** : Chemin vers le dossier contenant vos films originaux
- **PCLOUD_OPTIMIZED_PATH** : Chemin vers le dossier où seront stockés les films optimisés (sera créé automatiquement)

## Instructions

1. Créer le fichier `.env.local` à la racine du projet s'il n'existe pas
2. Ajouter ces deux lignes
3. Adapter les chemins si nécessaire
4. Redémarrer le serveur Next.js

## Exemple complet de .env.local

```env
# pCloud
PCLOUD_ACCESS_TOKEN=votre_token_pcloud
PCLOUD_MEDIA_FOLDER_ID=votre_folder_id

# TMDB
TMDB_API_KEY=votre_cle_tmdb

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_KEY=eyJxxx...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Chemins films (NOUVEAU)
PCLOUD_LOCAL_PATH=/Users/lionelvernay/pCloud Drive/films
PCLOUD_OPTIMIZED_PATH=/Users/lionelvernay/pCloud Drive/films_optimized
```


