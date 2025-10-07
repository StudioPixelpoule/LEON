# 🚨 INSTRUCTIONS IMPORTANTES

## ⚠️ Problème actuel : 0 séries affichées

**Cause** : Les migrations SQL n'ont pas encore été exécutées sur Supabase.

---

## 📋 ÉTAPES OBLIGATOIRES (dans l'ordre) :

### 1️⃣ Exécuter les migrations SQL sur Supabase

Les migrations sont **dans votre presse-papier** !

1. Allez sur **Supabase > SQL Editor**
2. **Cmd+V** (coller)
3. **Run** ▶️

**Ces migrations vont** :
- Ajouter la colonne `media_type` ('movie' | 'tv')
- Ajouter les colonnes `series_name`, `season_number`, `episode_number`
- Mettre à jour automatiquement les séries existantes (Better Call Saul, etc.)
- Créer la fonction `get_grouped_tv_series()`
- Créer le bucket Storage `custom-posters`

### 2️⃣ Vider la base et rescanner

1. Allez sur **http://localhost:3000/admin**
2. Cliquez sur **"Vider la base"**
3. Cliquez sur **"Lancer le scan"**
4. Attendez la fin (5-10 minutes)

**Après le scan** :
- Les films auront `media_type = 'movie'`
- Les séries auront `media_type = 'tv'` ET `series_name` rempli
- Les séries seront groupées (1 carte = 1 série)

### 3️⃣ Vérifier les résultats

- **http://localhost:3000/** → Accueil (Hero + aperçu)
- **http://localhost:3000/films** → Films uniquement (avec Hero)
- **http://localhost:3000/series** → Séries uniquement (avec Hero)

---

## 🎨 Design final (sans émojis) :

```
┌─────────────────────────────────────────┐
│ LEON      [Accueil] [Films] [Séries]   │ ← Header fixe
└─────────────────────────────────────────┘

[HERO SECTION avec backdrop]

────────────────────────────────────────── ← Trait fin

Films récents
[Poster] [Poster] [Poster] [Poster]

────────────────────────────────────────── ← Trait fin

Séries récentes
[Poster] [Poster] [Poster] [Poster]

────────────────────────────────────────── ← Trait fin
```

---

## ✅ Ce qui a été fait :

1. **Suppression de TOUS les émojis**
2. **Hero section** sur `/films` et `/series` (comme Netflix)
3. **Traits fins** entre sections (1px, blanc 10%)
4. **Header fixe** avec navigation Accueil/Films/Séries
5. **Pages séparées** :
   - `/` → Accueil avec Hero + aperçu
   - `/films` → Catalogue films avec Hero
   - `/series` → Catalogue séries avec Hero
6. **Modale universelle** :
   - Films → Bouton "Lire"
   - Séries → Sélecteur de saisons + épisodes
7. **Outil de validation manuelle** à `/admin/validate`

---

## 🔧 Architecture finale :

```
/                 → Accueil (Hero + aperçu films + séries)
/films            → Films (Hero + catalogue complet)
/series           → Séries (Hero + catalogue complet)
/admin            → Administration (scan + lien validation)
/admin/validate   → Validation manuelle (titres + jaquettes)
```

---

## 📊 Résultats attendus après scan :

**Avant** (actuellement) :
- 248 films identifiés
- 3 séries (bug : migrations pas exécutées)

**Après migrations + scan** :
- ~250 films groupés avec Hero
- ~50-100 séries groupées avec Hero (Better Call Saul = 1 carte, pas 50 épisodes)
- Tout le reste à valider manuellement sur `/admin/validate`

---

## 🚀 Prochaines étapes :

1. **Maintenant** : Exécuter les migrations SQL (Cmd+V sur Supabase)
2. **Ensuite** : Vider + Rescanner
3. **Enfin** : Valider les 750 médias restants sur `/admin/validate`

---

**Tout est prêt ! Il ne manque plus que les migrations SQL ! 🎬**
