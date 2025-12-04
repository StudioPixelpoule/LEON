# Template de configuration .env pour le NAS

Copiez ce contenu dans un fichier nommé `.env` à la racine du projet sur le NAS.

```bash
# URL publique de l'application (IP du NAS)
NEXT_PUBLIC_APP_URL=http://192.168.2.128:3000

# SUPABASE (Base de données)
# Récupérer ces clés dans Project Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-publique
SUPABASE_SERVICE_KEY=votre-cle-service-role-secrete

# TMDB (Métadonnées films)
# Récupérer la clé sur themoviedb.org > Settings > API
TMDB_API_KEY=votre-cle-api-tmdb

# PCLOUD (Si utilisé, sinon laisser tel quel si montage local)
PCLOUD_ACCESS_TOKEN=optionnel-si-volume-docker-monte
```












