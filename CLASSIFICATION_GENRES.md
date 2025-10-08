# 🎯 Système de Classification Intelligente des Genres

## Vue d'ensemble

Le système de classification garantit que **chaque film apparaît dans maximum 2 catégories** : une catégorie principale et éventuellement une catégorie secondaire complémentaire.

## Principes de classification

### 1. Hiérarchie des genres

Les genres sont classés par **spécificité** (du plus spécifique au plus général) :

#### Très spécifiques (priorité 9-10)
- **Animation** : Très reconnaissable, toujours catégorie principale
- **Documentary** : Genre distinct, rarement mélangé
- **Western** : Style unique et identifiable
- **War** : Thématique forte
- **Musical** : Caractéristique dominante
- **Horror** : Ambiance et ton spécifiques

#### Spécifiques moyens (priorité 6-8)
- **Science Fiction** : Univers particulier
- **Fantasy** : Monde imaginaire
- **Crime** : Thématique criminelle
- **Mystery** : Intrigue policière

#### Génériques (priorité 3-5)
- **Action** : Peut accompagner beaucoup de genres
- **Adventure** : Souvent secondaire
- **Thriller** : Ton mais pas genre principal
- **Comedy** : Peut être principal ou secondaire
- **Drama** : Très général
- **Romance** : Souvent sous-intrigue

#### Très génériques (priorité 1-2)
- **Family** : Plus un public cible qu'un genre
- **History** : Contexte temporel
- **Music** : Trop vague

### 2. Genres incompatibles

Certains genres ne peuvent **jamais** être ensemble :

- **Animation** ≠ Horror, War, Crime
- **Horror** ≠ Animation, Comedy, Romance
- **Comedy** ≠ Horror, War
- **Documentary** ≠ Animation, Fantasy, Science Fiction
- **Western** ≠ Science Fiction, Animation

### 3. Genres complémentaires

Certaines combinaisons sont **naturelles et recommandées** :

- **Action** + Adventure, Thriller, Science Fiction
- **Science Fiction** + Action, Adventure, Thriller
- **Crime** + Thriller, Drama, Mystery
- **Comedy** + Romance, Adventure, Family
- **Horror** + Thriller, Mystery
- **Animation** + Adventure, Comedy, Family
- **War** + Drama, History, Action

## Algorithme de sélection

### Étape 1 : Catégorie principale
Le genre avec la **plus haute priorité** devient automatiquement la catégorie principale.

**Exemple :**
```
Genres TMDB : ["Drama", "Crime", "Thriller"]
→ Principal : Crime (priorité 6)
```

### Étape 2 : Catégorie secondaire (optionnelle)

Parmi les genres restants, on cherche :

1. **Un genre complémentaire** avec la catégorie principale
2. **Un genre compatible** avec une priorité ≥ 4
3. Sinon, **aucune catégorie secondaire**

**Exemple 1 - Avec secondaire :**
```
Genres TMDB : ["Action", "Science Fiction", "Adventure"]
→ Principal : Science Fiction (priorité 7)
→ Secondaire : Action (complémentaire + priorité 5)
→ Résultat : Film dans "Science-Fiction" ET "Action"
```

**Exemple 2 - Sans secondaire :**
```
Genres TMDB : ["Horror", "Thriller", "Mystery"]
→ Principal : Horror (priorité 8)
→ Secondaire : Thriller (complémentaire + priorité 4)
→ Résultat : Film dans "Horreur" ET "Thriller"
```

**Exemple 3 - Incompatibilité :**
```
Genres TMDB : ["Animation", "Comedy", "Horror"]
→ Principal : Animation (priorité 10)
→ Horror incompatible avec Animation → éliminé
→ Secondaire : Comedy (complémentaire)
→ Résultat : Film dans "Animation" ET "Comédie"
```

## Exemples concrets

### Inception (2010)
```
Genres TMDB : ["Action", "Science Fiction", "Mystery", "Thriller"]
→ Principal : Science Fiction (priorité 7)
→ Secondaire : Action (complémentaire)
✅ Apparaît dans : "Science-Fiction" + "Action"
```

### The Dark Knight (2008)
```
Genres TMDB : ["Drama", "Action", "Crime", "Thriller"]
→ Principal : Crime (priorité 6)
→ Secondaire : Thriller (complémentaire)
✅ Apparaît dans : "Policier" + "Thriller"
```

### Toy Story (1995)
```
Genres TMDB : ["Animation", "Comedy", "Family"]
→ Principal : Animation (priorité 10)
→ Secondaire : Comedy (complémentaire)
✅ Apparaît dans : "Animation" + "Comédie"
```

### The Shawshank Redemption (1994)
```
Genres TMDB : ["Drama", "Crime"]
→ Principal : Crime (priorité 6)
→ Secondaire : Drama (compatible mais priorité basse)
✅ Apparaît dans : "Policier" + "Drame"
```

### Interstellar (2014)
```
Genres TMDB : ["Adventure", "Drama", "Science Fiction"]
→ Principal : Science Fiction (priorité 7)
→ Secondaire : Adventure (complémentaire)
✅ Apparaît dans : "Science-Fiction" + "Aventure"
```

## Sélection des catégories affichées

L'interface affiche les **6 meilleures catégories** selon :

1. **Priorité du genre** (genres spécifiques favorisés)
2. **Nombre de films** dans la catégorie
3. **Minimum 3 films** par catégorie

**Exemple de résultat :**
```
1. Action (25 films)
2. Science-Fiction (18 films)
3. Comédie (15 films)
4. Policier (12 films)
5. Horreur (8 films)
6. Animation (6 films)
```

## Traductions françaises

Les noms de genres sont traduits automatiquement :

| Anglais (TMDB) | Français (Interface) |
|----------------|----------------------|
| Action | Action |
| Science Fiction | Science-Fiction |
| Comedy | Comédie |
| Crime | Policier |
| Horror | Horreur |
| Adventure | Aventure |
| Animation | Animation |
| Drama | Drame |
| Thriller | Thriller |
| Mystery | Mystère |
| Romance | Romance |
| War | Guerre |
| Western | Western |
| Fantasy | Fantasy |
| Documentary | Documentaire |
| Family | Famille |
| History | Histoire |

## Avantages du système

✅ **Pas de doublons visuels** : Chaque film apparaît 2 fois maximum
✅ **Catégories pertinentes** : Les films sont dans leurs vraies catégories
✅ **Navigation claire** : L'utilisateur trouve rapidement ce qu'il cherche
✅ **Cohérence thématique** : Les catégories ont du sens
✅ **Performance** : Moins de calculs, interface plus rapide

## Cas particuliers

### Films sans genre
```
→ Catégorie "Autres"
```

### Films mono-genre
```
Genres : ["Horror"]
→ Principal : Horror
→ Secondaire : aucune
✅ Apparaît uniquement dans "Horreur"
```

### Films multi-genres (> 3)
```
Genres : ["Action", "Adventure", "Comedy", "Drama", "Thriller"]
→ Même logique : 1 principal + 1 secondaire maximum
✅ Les 3 autres genres sont ignorés pour le classement
```

---

**Pixel Poule** - Classification intelligente des médias

