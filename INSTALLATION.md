# Guide d'installation LEON

## 📋 Prérequis

- **Node.js** 18.17 ou supérieur
- **npm** ou **yarn**
- Compte **Supabase** (gratuit)
- Compte **pCloud** avec dossier synchronisé
- Clé API **TMDB** (gratuite)

---

## 🚀 Installation Rapide

### 1. Installation des dépendances

```bash
cd /Users/lionelvernay/Documents/Cursor/LEON
npm install
```

### 2. Configuration des variables d'environnement

Créer un fichier `.env` à la racine du projet :

```bash
cp .env.example .env
```

Éditer le fichier `.env` avec vos clés :

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
```

### 3. Configuration Supabase

#### A. Créer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com)
2. Créer un nouveau projet
3. Copier l'URL et les clés API depuis Settings → API

#### B. Exécuter le schéma SQL

1. Ouvrir le SQL Editor dans Supabase
2. Copier le contenu de `/supabase/schema.sql`
3. Exécuter le script
4. Vérifier que les tables sont créées

### 4. Obtenir les clés API

#### pCloud Access Token

1. Se connecter à [pCloud](https://www.pcloud.com)
2. Aller dans **Settings** → **Security** → **App Access**
3. Créer un nouveau App Access Token
4. Copier le token

#### pCloud Folder ID

1. Ouvrir le dossier de médias dans pCloud Web
2. L'ID du dossier est dans l'URL : `https://my.pcloud.com/#page=filemanager&folder=123456`
3. Le `123456` est votre FOLDER_ID

#### TMDB API Key

1. Créer un compte sur [themoviedb.org](https://www.themoviedb.org)
2. Aller dans **Settings** → **API**
3. Demander une clé API (gratuite)
4. Accepter les conditions
5. Copier l'API Key (v3 auth)

### 5. Lancer l'application

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

---

## 📁 Premier Scan

### Méthode 1 : Via l'interface admin

1. Ouvrir `http://localhost:3000/admin`
2. Cliquer sur "Lancer le scan"
3. Attendre la fin de l'indexation

### Méthode 2 : Via API

```bash
curl -X POST http://localhost:3000/api/scan
```

**⏱️ Durée estimée :** 
- 100 films ≈ 5-10 minutes
- 500 films ≈ 30-60 minutes

L'indexation traite les fichiers par batch de 100 pour optimiser les performances.

---

## 🎬 Utilisation

### Parcourir la bibliothèque

1. Ouvrir `http://localhost:3000`
2. Utiliser la barre de recherche (debounce 300ms)
3. Filtrer par catégorie
4. Cliquer sur une jaquette pour voir les détails

### Télécharger un film

1. Ouvrir la fiche détaillée
2. Cliquer sur "Télécharger" (téléchargement immédiat)
3. OU cliquer sur "Ajouter à la file" (téléchargement en queue)
4. Suivre la progression dans la file flottante (bas droite)

### Rafraîchir les métadonnées

Si des jaquettes ou infos sont manquantes :

```bash
# Relancer le scan (ne dupliquera pas les fichiers existants)
curl -X POST http://localhost:3000/api/scan
```

---

## 🛠️ Commandes Utiles

```bash
# Développement
npm run dev

# Build production
npm run build

# Lancer en production
npm run start

# Linter
npm run lint
```

---

## 🐛 Dépannage

### Erreur "Variables Supabase manquantes"

→ Vérifier que le fichier `.env` existe et contient les bonnes clés

### Aucun film n'apparaît

→ Lancer le scan depuis `/admin` ou via l'API

### Jaquettes manquantes

→ Vérifier que TMDB_API_KEY est valide  
→ Relancer le scan

### Erreur pCloud

→ Vérifier que le token pCloud est valide  
→ Vérifier que le FOLDER_ID est correct  
→ Vérifier que le dossier contient des fichiers .mp4

### Performance lente

→ Vider le cache Next.js : `rm -rf .next`  
→ Réduire le nombre de téléchargements simultanés (max 3)

---

## 📊 Structure de la Base de Données

### Table `media`

Contient tous les films indexés avec :
- Métadonnées TMDB (titre, synopsis, casting)
- Infos fichier (taille, qualité, durée)
- Références pCloud (file_id)
- Sous-titres associés

### Table `profiles` (Phase 2)

Profils utilisateurs pour le multi-user

### Table `downloads` (Phase 2)

Historique des téléchargements par utilisateur

---

## 🎨 Personnalisation

### Modifier les couleurs

Éditer `/styles/globals.css` → section `:root`

⚠️ **ATTENTION** : Respecter le design system Pixel Poule (noir/blanc/gris uniquement)

### Ajouter des filtres

Modifier `/components/FilterBar.tsx`

### Changer la grille

Modifier `/styles/globals.css` → `.mediaGrid`

---

## 🚀 Déploiement Production (Phase 2)

### Sur Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel

# Configurer les variables d'environnement
vercel env add PCLOUD_ACCESS_TOKEN
vercel env add TMDB_API_KEY
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_KEY

# Redéployer
vercel --prod
```

### Configuration DNS

Après déploiement, configurer un domaine personnalisé via le dashboard Vercel.

---

## 📞 Support

Pour toute question ou problème :
- Vérifier le README.md
- Consulter les logs : `tail -f .next/server/app-paths-manifest.json`
- Tester en mode développement avec `npm run dev`

---

© 2025 Pixel Poule - LEON




