# Correction des Affiches - Guide Utilisateur

## 📍 Accès à la fonctionnalité

1. Ouvrir le panneau d'administration : `/admin`
2. Cliquer sur **"Corriger les affiches"** dans le menu latéral

## ✨ Fonctionnalités

### Vue d'ensemble
- **Liste complète** de tous les films avec leurs affiches actuelles
- **Grille responsive** avec miniatures des posters
- **Barre de recherche** pour filtrer rapidement les films

### Workflow de correction

#### 1. Trouver le film
- Utiliser la barre de recherche en haut pour taper le titre du film
- Le compteur affiche le nombre de résultats en temps réel
- Cliquer sur **X** pour effacer la recherche

#### 2. Modifier l'affiche
- **Cliquer sur la carte du film** à modifier
- Un modal s'ouvre avec :
  - **Colonne gauche** : Affiche actuelle + infos du film
  - **Colonne droite** : Recherche TMDB

#### 3. Rechercher la bonne affiche
- Le champ de recherche est pré-rempli avec le titre du film
- Modifier la recherche si nécessaire
- Appuyer sur **Entrée** ou cliquer sur **"Rechercher"**
- TMDB retourne jusqu'à 8 suggestions

#### 4. Sélectionner la nouvelle affiche
- **Cliquer sur la suggestion** désirée
- La mise à jour se fait automatiquement
- Un message de confirmation s'affiche
- Le modal se ferme et la liste se rafraîchit

## 🎨 Design & UX

### Interactions
- **Hover sur les cartes** : effet de surélévation + overlay "Modifier l'affiche"
- **Animations douces** : transitions de 0.2-0.3s
- **Glassmorphism** : backdrop-blur sur le modal
- **Scrollbar custom** : dans la liste de suggestions

### Feedback utilisateur
- **Loading states** : icônes animées pendant les recherches
- **Overlay de sauvegarde** : pendant la mise à jour
- **Alert de succès** : confirmation de la modification
- **Empty state** : message si aucune suggestion

## 🔧 Technique

### APIs utilisées
- `/api/media/grouped?type=movie` : récupération de tous les films
- `/api/admin/search-tmdb` : recherche TMDB
- `/api/admin/update-metadata` : mise à jour des métadonnées

### Données mises à jour
Lors de la sélection d'une nouvelle affiche, **toutes les métadonnées** sont actualisées :
- Poster URL
- Synopsis
- Genres
- Durée
- Note
- Acteurs (casting)
- Réalisateur
- Date de sortie

## 🚀 Améliorations possibles

- [ ] Prévisualisation côte à côte (avant/après)
- [ ] Historique des modifications
- [ ] Upload manuel d'affiche
- [ ] Batch update (plusieurs films en même temps)
- [ ] Raccourcis clavier (Échap pour fermer, Entrée pour rechercher)
- [ ] Pagination si plus de 100 films

## 📱 Responsive

- **Desktop** : grille 5-6 colonnes
- **Tablet** : grille 3-4 colonnes
- **Mobile** : grille 2-3 colonnes
- Modal adaptatif : disposition en colonne sur petit écran

---

**Version** : 1.0  
**Date** : 24 novembre 2024  
**Auteur** : Pixel Poule















