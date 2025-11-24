# 🎬 Workflow d'ajout de films dans LEON

## 📁 1. Ajout des fichiers

### Emplacement
Placez vos films dans le dossier :
```
/Users/lionelvernay/pCloud Drive/films/
```

### Formats supportés
- **Vidéo** : `.mkv`, `.mp4`, `.avi`, `.mov`, `.webm`
- **Nommage recommandé** : `Titre du Film (Année).mkv`
  - Exemple : `Inception (2010).mkv`
  - Exemple : `The Matrix.mkv`

## 🔍 2. Scan des nouveaux films

1. Accédez à la page admin : http://localhost:3000/admin
2. Dans la section **"Scanner les films"**, cliquez sur **"Lancer le scan"**
3. Le système va :
   - Détecter les nouveaux fichiers
   - Identifier automatiquement les films via TMDB
   - Récupérer les métadonnées (titre, année, poster, synopsis)
   - Ajouter les films à la base de données

### Résultats du scan
- **✅ Films identifiés** : Prêts à être visionnés
- **⚠️ Films non identifiés** : Nécessitent une validation manuelle

## 🖼️ 3. Validation des posters

Si certains films n'ont pas été identifiés correctement :

1. Dans l'admin, section **"Validation posters"**
2. Cliquez sur **"Commencer la validation"**
3. Pour chaque film :
   - **Recherche alternative** : Modifiez le titre et recherchez
   - **Sélection rapide** : Cliquez sur la bonne suggestion TMDB
   - **Navigation** : Utilisez Précédent/Suivant/Passer

### Interface de validation
- **Progression** : Barre en haut indiquant l'avancement
- **Recherche intelligente** : Suggestions automatiques de TMDB
- **Validation en 1 clic** : Sélectionnez le bon film parmi les suggestions
- **Navigation rapide** : Touches fléchées pour naviguer

## ✅ 4. Films disponibles

Une fois le scan et la validation terminés :
- Les films apparaissent immédiatement sur la page d'accueil
- Ils sont classés dans les bonnes catégories
- Le mode "Continuer le visionnage" fonctionne automatiquement

## 🚀 Raccourcis et astuces

### Scan rapide en ligne de commande
```bash
# Depuis le dossier LEON
curl -X POST http://localhost:3000/api/scan
```

### Validation en masse
- Utilisez la touche **Entrée** pour lancer une recherche
- Utilisez les **flèches** pour naviguer entre les films
- **Double-clic** sur une suggestion pour valider rapidement

### Problèmes courants

#### Film non détecté lors du scan
- Vérifiez le format du fichier
- Renommez le fichier avec le titre exact du film
- Ajoutez l'année entre parenthèses

#### Mauvaise identification
- Utilisez la validation manuelle
- Recherchez avec le titre original (anglais)
- Ajoutez l'année dans la recherche

#### Poster manquant après validation
- TMDB peut ne pas avoir de poster pour certains vieux films
- Solution : Ajoutez manuellement via Supabase Storage

## 📊 Statistiques

Dans la section **"Statistiques"** de l'admin, vous pouvez voir :
- Nombre total de films
- Films récemment ajoutés
- Films nécessitant une validation
- Espace disque utilisé

## 🔄 Maintenance

### Nettoyer les doublons
Si un film apparaît plusieurs fois :
1. Identifiez le doublon dans Supabase
2. Supprimez l'entrée dupliquée
3. Relancez un scan pour vérifier

### Actualiser les métadonnées
Pour mettre à jour les infos d'un film :
1. Supprimez le film de la base
2. Relancez un scan
3. Le film sera ré-identifié avec les dernières infos TMDB

