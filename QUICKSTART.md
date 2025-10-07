# 🚀 LEON - Démarrage Rapide

## ⚡ Installation en 5 minutes

### 1️⃣ Prérequis (à avoir AVANT de commencer)

- [ ] Compte Supabase créé sur [supabase.com](https://supabase.com)
- [ ] Token pCloud obtenu (Settings → Security → App Access)
- [ ] Clé API TMDB obtenue ([themoviedb.org](https://www.themoviedb.org/settings/api))
- [ ] Node.js 18+ installé (`node -v` pour vérifier)

---

### 2️⃣ Configuration (5 minutes)

```bash
# 1. Se placer dans le projet
cd /Users/lionelvernay/Documents/Cursor/LEON

# 2. Créer le fichier .env
cat > .env << 'EOF'
# pCloud
PCLOUD_ACCESS_TOKEN=VOTRE_TOKEN_ICI
PCLOUD_MEDIA_FOLDER_ID=VOTRE_FOLDER_ID_ICI

# TMDB
TMDB_API_KEY=VOTRE_CLE_TMDB_ICI

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_KEY=eyJxxx...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

# 3. Éditer le fichier avec vos vraies clés
nano .env  # ou code .env si vous utilisez VSCode
```

---

### 3️⃣ Configuration Supabase (2 minutes)

```bash
# 1. Copier le contenu du schéma SQL
cat supabase/schema.sql | pbcopy

# 2. Ouvrir Supabase dans le navigateur
open "https://supabase.com/dashboard/project/_/sql/new"

# 3. Coller le SQL et exécuter (bouton RUN)
```

**OU en ligne de commande si vous avez le CLI Supabase :**

```bash
supabase link --project-ref votre-ref-projet
supabase db push
```

---

### 4️⃣ Premier lancement (1 minute)

```bash
# Lancer le serveur de développement
npm run dev
```

✅ L'application est accessible sur **http://localhost:3000**

---

### 5️⃣ Premier scan (5-30 minutes selon nombre de films)

#### Option A : Via l'interface (recommandé)

1. Ouvrir **http://localhost:3000/admin**
2. Cliquer sur "Lancer le scan"
3. Attendre la fin (une barre de progression s'affiche)

#### Option B : Via terminal

```bash
curl -X POST http://localhost:3000/api/scan
```

---

## 🎬 C'est prêt !

Ouvrir **http://localhost:3000** et profiter de votre médiathèque.

---

## 🆘 Problèmes Courants

### "Variables Supabase manquantes"
→ Vérifier que le fichier `.env` existe et contient les bonnes valeurs

### "Cannot find module"
→ Exécuter `npm install`

### Aucun film ne s'affiche
→ Lancer le scan depuis `/admin`

### "TMDB API error"
→ Vérifier que votre clé TMDB est valide

### "pCloud API error"
→ Vérifier le token et le folder ID

---

## 📚 Documentation Complète

- **Installation détaillée** : voir `INSTALLATION.md`
- **Guide utilisateur** : voir `README.md`
- **Spécifications techniques** : voir `SPECIFICATIONS.md`
- **Résumé projet** : voir `PROJECT_SUMMARY.md`

---

## 🎯 Commandes Utiles

```bash
# Développement
npm run dev

# Build production
npm run build

# Lancer en production
npm start

# Linting
npm run lint

# Nettoyer le cache
rm -rf .next

# Relancer le scan
curl -X POST http://localhost:3000/api/scan
```

---

**Développé par Pixel Poule** 🐔  
© 2025 - Tous droits réservés




