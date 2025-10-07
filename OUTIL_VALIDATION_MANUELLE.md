# ✅ Outil de validation manuelle - COMPLET

## 🎯 Objectif

Identifier **tous les médias manquants** (752 sans TMDB ID) avec un outil semi-automatique :
1. Corriger le titre
2. Rechercher sur TMDB
3. Sélectionner le bon résultat
4. OU uploader une jaquette personnalisée
5. Passer au suivant automatiquement

---

## 📋 Ce qui a été implémenté

### 1. **Supabase Storage** ✅
- Bucket `custom-posters` pour jaquettes personnalisées
- Politiques publiques (lecture/écriture)
- Limite 10MB par fichier
- Formats acceptés : JPG, PNG, WebP

### 2. **API de recherche TMDB** ✅
- `POST /api/admin/search-tmdb`
- Recherche par titre corrigé + année
- Support films et séries
- Limite 10 résultats max

### 3. **API d'upload jaquettes** ✅
- `POST /api/admin/upload-poster`
- Upload vers Supabase Storage
- Génération URL publique
- Validation type/taille de fichier

### 4. **API de validation** ✅
- `POST /api/admin/validate-media`
- Récupération métadonnées complètes TMDB
- Sauvegarde dans `manual_matches` (apprentissage)
- Support jaquettes personnalisées

### 5. **Page `/admin/validate`** ✅
- Interface complète de validation
- Filtres : Tous / Sans TMDB / Sans poster / Films / Séries
- Navigation : Précédent / Suivant / Ignorer
- Formulaire de correction (titre, année, type)
- Recherche TMDB en un clic
- Sélection de résultats avec preview
- Upload de jaquette drag & drop
- Progression : X / Y médias traités

### 6. **Lien dans `/admin`** ✅
- Encart "Validation manuelle" en haut de page
- Lien direct vers `/admin/validate`

---

## 🚀 Comment l'utiliser

### Étape 1 : Créer le bucket Storage

1. Allez sur **Supabase > SQL Editor**
2. **Collez** le contenu du presse-papier (déjà copié !)
3. Cliquez sur **"Run"**

Le SQL crée le bucket `custom-posters` avec toutes les politiques.

### Étape 2 : Accéder à l'outil

```
http://localhost:3000/admin
→ Cliquez sur "Accéder à la validation"
```

Ou directement :
```
http://localhost:3000/admin/validate
```

### Étape 3 : Workflow de validation

#### **Cas 1 : Média trouvé sur TMDB**

1. **Corrigez le titre** si besoin
   - Ex : `A.Bicyclette.2025.FRENCH.mkv` → `À bicyclette`
2. **Cliquez "Rechercher sur TMDB"**
3. **Sélectionnez le bon résultat**
4. → **Métadonnées + jaquette téléchargées automatiquement**
5. → **Passe au suivant**

#### **Cas 2 : Média introuvable sur TMDB**

1. **Corrigez le titre**
2. **Recherchez sur TMDB** (aucun résultat)
3. **Uploadez une jaquette personnalisée**
   - Cliquez sur "Choisir une image"
   - Sélectionnez JPG/PNG/WebP (max 10MB)
4. **Cliquez "Valider avec cette jaquette"**
5. → **Jaquette sauvegardée + titre corrigé**
6. → **Passe au suivant**

#### **Cas 3 : Ignorer temporairement**

- **Cliquez "Ignorer"** pour passer au suivant sans sauvegarder

---

## 🎨 Filtres disponibles

### **Tous** (1000)
Affiche tous les médias de la base

### **Sans TMDB ID** (750)
Médias sans métadonnées TMDB (priorité haute)

### **Sans poster** (752)
Médias sans jaquette visible

### **Films** (248)
Uniquement les films

### **Séries** (752)
Uniquement les séries TV

---

## 💾 Apprentissage automatique

Chaque validation TMDB est sauvegardée dans `manual_matches` :
```sql
INSERT INTO manual_matches (filename, tmdb_id, title, year, poster_path)
```

**Lors du prochain scan** :
- Si le même nom de fichier est scanné
- → LEON utilise automatiquement le bon TMDB ID
- → Plus besoin de re-valider !

---

## 🖼️ Jaquettes personnalisées

### Où sont stockées ?
- **Supabase Storage** : bucket `custom-posters/`
- URL publique : `https://[projet].supabase.co/storage/v1/object/public/custom-posters/[filename]`

### Format recommandé
- **Résolution** : 500x750px (2:3 portrait)
- **Format** : JPG ou PNG
- **Poids** : < 1MB (max 10MB)

### Exemple d'URL générée
```
https://votre-projet.supabase.co/storage/v1/object/public/custom-posters/abc123-1234567890.jpg
```

---

## 📊 Statistiques

Avant validation :
- ✅ **248 avec TMDB** (25%)
- ❌ **752 sans TMDB** (75%)

Après validation complète :
- ✅ **1000 avec métadonnées** (100%) 🎉

---

## 🛠️ Fichiers créés

### Backend :
- `supabase/storage_custom_posters.sql` ← À exécuter sur Supabase
- `app/api/admin/search-tmdb/route.ts`
- `app/api/admin/upload-poster/route.ts`
- `app/api/admin/validate-media/route.ts`

### Frontend :
- `app/admin/validate/page.tsx`
- `app/admin/validate/validate.module.css`
- `app/admin/page.tsx` (modifié - lien ajouté)

---

## ⚡ Temps estimé

- **~752 médias** à traiter
- **~30 secondes par média** (recherche + sélection)
- **Total : ~6 heures** (ou par sessions de 30min)

**Astuce** : Faites-le par lots de 50-100 médias pour ne pas vous lasser ! 😊

---

## 🎯 Prochaines étapes

1. **Exécuter le SQL Storage** (déjà dans presse-papier)
2. **Aller sur `/admin/validate`**
3. **Traiter les 752 médias manquants**
4. **Atteindre 100% de reconnaissance** 🎉

---

## ⚠️ Notes importantes

- **L'outil ne supprime rien** : vous pouvez toujours ignorer et revenir plus tard
- **Apprentissage actif** : les corrections sont sauvegardées pour les futurs scans
- **Jaquettes permanentes** : une fois uploadées, elles restent sur Supabase
- **Pas de limite** : validez autant de médias que vous voulez

---

Bon courage pour la validation ! 🚀


