# 🎉 Configuration pCloud Drive - Méthode Simplifiée

## ✅ Bonne Nouvelle !

Vous avez pCloud Drive installé ! C'est la méthode la plus simple et la plus rapide. LEON va lire directement vos fichiers depuis le disque au lieu de passer par l'API.

**Aucun token nécessaire** - Tout est déjà configuré ! 🚀

---

## 📁 Configuration Actuelle

Votre dossier films est accessible à :
```
/Users/lionelvernay/pCloud Drive/films
```

LEON est déjà configuré pour scanner ce dossier automatiquement.

---

## 🚀 Prochaines Étapes

### 1. Configurer TMDB et Supabase

Il vous reste juste à ajouter vos clés TMDB et Supabase dans le fichier `.env` :

```env
TMDB_API_KEY=votre_cle_tmdb_ici
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_ici
```

**TMDB** (gratuit) : https://www.themoviedb.org/settings/api
**Supabase** (gratuit) : https://supabase.com

### 2. Lancer l'application

```bash
npm run dev
```

### 3. Scanner vos films

Allez sur : http://localhost:3000/admin

Cliquez sur "Lancer le scan" et LEON va automatiquement :
- ✅ Scanner votre dossier `/Users/lionelvernay/pCloud Drive/films`
- ✅ Identifier tous vos films (39 fichiers trouvés !)
- ✅ Récupérer les métadonnées depuis TMDB
- ✅ Détecter les sous-titres
- ✅ Créer votre bibliothèque

---

## 💡 Avantages de cette Méthode

- ⚡ **Plus rapide** : Lecture directe du disque (pas d'API)
- 🔒 **Plus sécurisé** : Pas besoin de token d'accès
- 🎯 **Plus simple** : Pas de configuration complexe
- 📁 **Sous-dossiers** : LEON scanne automatiquement tous les sous-dossiers

---

## 📝 Méthode Alternative (API pCloud) - Non Nécessaire

Si vous n'aviez pas pCloud Drive, voici comment obtenir un token API :

## Méthode Simple et Rapide

### Étape 1 : Obtenir le Token via l'API Console

1. **Ouvrez votre navigateur** et allez sur :
   ```
   https://api.pcloud.com/userinfo?getauth=1&logout=1&username=VOTRE_EMAIL&password=VOTRE_MOT_DE_PASSE
   ```

2. **Remplacez** `VOTRE_EMAIL` et `VOTRE_MOT_DE_PASSE` par vos vrais identifiants pCloud

3. **Vous obtiendrez une réponse JSON** comme ceci :
   ```json
   {
     "result": 0,
     "auth": "ABC123XYZ789...",
     "email": "votre@email.com",
     "quota": 10737418240,
     ...
   }
   ```

4. **Copiez la valeur du champ `auth`** : c'est votre **TOKEN API** ! ✅

---

### Étape 2 : Trouver l'ID de votre Dossier Films

#### Option A : Via l'URL (le plus simple)

1. Connectez-vous sur **https://my.pcloud.com**
2. Naviguez vers le dossier qui contient vos films
3. Regardez l'URL dans votre navigateur :
   ```
   https://my.pcloud.com/#page=filemanager&folder=123456789
   ```
4. Le nombre après `folder=` est votre **FOLDER_ID** (exemple : `123456789`)

#### Option B : Via l'API (si vous n'avez pas accès à l'interface web)

1. Ouvrez votre navigateur et allez sur :
   ```
   https://api.pcloud.com/listfolder?access_token=VOTRE_TOKEN&folderid=0
   ```

2. Vous obtiendrez la liste de tous vos dossiers avec leurs IDs :
   ```json
   {
     "result": 0,
     "metadata": {
       "contents": [
         {
           "name": "Films",
           "isfolder": true,
           "folderid": 123456789
         },
         ...
       ]
     }
   }
   ```

3. **Trouvez le dossier "Films"** et notez son `folderid`

---

### Étape 3 : Configurer LEON

1. **Ouvrez le fichier `.env`** à la racine du projet (ou créez-le s'il n'existe pas)

2. **Ajoutez ces deux lignes** :
   ```env
   PCLOUD_ACCESS_TOKEN=ABC123XYZ789...
   PCLOUD_MEDIA_FOLDER_ID=123456789
   ```
   (Remplacez par vos vraies valeurs)

3. **Sauvegardez** le fichier

---

### Étape 4 : Vérifier que ça fonctionne

Lancez l'application :
```bash
npm run dev
```

Puis allez sur **http://localhost:3000/admin** pour lancer un scan.

Si tout est bon, LEON va commencer à scanner votre dossier pCloud ! 🎬

---

## 🆘 Problèmes Courants

### "Log in failed" lors de l'étape 1
- ❌ Vérifiez que votre email et mot de passe sont corrects
- ❌ Si vous avez l'authentification à 2 facteurs (2FA), cette méthode ne fonctionnera pas
- ✅ **Solution** : Désactivez temporairement 2FA, récupérez le token, puis réactivez 2FA

### "Access denied" ou "Invalid token"
- Le token a peut-être expiré
- Refaites l'étape 1 pour générer un nouveau token

### "Folder not found"
- Vérifiez que l'ID du dossier est correct
- Assurez-vous que le dossier existe et contient bien vos films

---

## 📝 Notes de Sécurité

- ⚠️ **Ne partagez JAMAIS votre token** : il donne accès complet à votre pCloud
- 🔒 Le token reste valide jusqu'à ce que vous changiez votre mot de passe
- 🗑️ Pour révoquer un token : changez votre mot de passe pCloud
- 📂 Le `.env` est dans le `.gitignore` : il ne sera jamais commité sur Git

---

## 🎯 Résumé Ultra-Rapide

**Ce dont vous avez besoin :**

1. **Token API** → Via `https://api.pcloud.com/userinfo?getauth=1&logout=1&username=EMAIL&password=PASS`
2. **Folder ID** → Dans l'URL de my.pcloud.com : `folder=123456789`

**Où les mettre :**

Fichier `.env` à la racine :
```env
PCLOUD_ACCESS_TOKEN=votre_token_ici
PCLOUD_MEDIA_FOLDER_ID=123456789
```

**C'est tout !** 🚀

