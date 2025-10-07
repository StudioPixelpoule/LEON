# 🚀 Lancer LEON sans Cursor

## Méthode 1 : Double-clic (La Plus Simple) ⭐

1. **Ouvrez le Finder**
2. Allez dans `/Users/lionelvernay/Documents/Cursor/LEON`
3. **Double-cliquez** sur le fichier `start-leon.command`
4. Une fenêtre Terminal s'ouvrira et lancera automatiquement LEON
5. Ouvrez votre navigateur sur **http://localhost:3000**

**Pour arrêter** : Fermez la fenêtre Terminal ou appuyez sur `Ctrl+C`

---

## Méthode 2 : Via le Terminal

### Ouvrir le Terminal

- **Spotlight** : Appuyez sur `Cmd+Espace`, tapez "Terminal", Entrée
- **Finder** : Applications → Utilitaires → Terminal
- **Launchpad** : Cherchez "Terminal"

### Lancer LEON

```bash
cd /Users/lionelvernay/Documents/Cursor/LEON
npm run dev
```

L'application sera accessible sur : **http://localhost:3000**

**Pour arrêter** : Appuyez sur `Ctrl+C` dans le Terminal

---

## Méthode 3 : Créer un Raccourci sur le Bureau

1. **Ouvrez le Finder**
2. Allez dans `/Users/lionelvernay/Documents/Cursor/LEON`
3. **Faites glisser** `start-leon.command` sur votre Bureau en maintenant `Cmd+Option`
4. Vous avez maintenant un raccourci sur votre Bureau !

Double-cliquez dessus pour lancer LEON à tout moment.

---

## Méthode 4 : Créer une Application macOS

Pour avoir LEON dans vos Applications comme n'importe quelle app :

1. **Ouvrez Automator** (Spotlight → "Automator")
2. Choisissez **"Application"**
3. Dans la barre de recherche, trouvez **"Exécuter un script shell"**
4. Glissez-le dans la zone de droite
5. Collez ce script :
   ```bash
   cd /Users/lionelvernay/Documents/Cursor/LEON
   open -a Terminal.app start-leon.command
   ```
6. **Fichier → Enregistrer** sous le nom "LEON"
7. Enregistrez dans `/Applications`

Maintenant LEON apparaît dans vos Applications ! 🎉

---

## 🔧 Correction de l'Erreur file_size

Il y a une petite correction à faire dans Supabase :

1. Allez sur **https://supabase.com**
2. Ouvrez votre projet → **SQL Editor**
3. Copiez-collez le contenu de `supabase/fix_file_size.sql` :
   ```sql
   ALTER TABLE media 
   ALTER COLUMN file_size TYPE TEXT USING file_size::TEXT;
   ```
4. Cliquez sur **Run**
5. Relancez le scan depuis **http://localhost:3000/admin**

Cette correction permet d'afficher la taille des fichiers au format lisible (ex: "2.5 GB" au lieu de "2500000000").

---

## 📱 Accéder à LEON depuis un autre appareil

Si vous voulez accéder à LEON depuis votre iPhone, iPad ou un autre ordinateur sur le même réseau WiFi :

1. **Trouvez votre adresse IP locale** :
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
   Vous verrez quelque chose comme `192.168.1.10`

2. **Sur l'autre appareil**, ouvrez le navigateur et allez sur :
   ```
   http://192.168.1.10:3000
   ```
   (Remplacez par votre vraie IP)

---

## 🛑 Arrêter LEON

### Si lancé via start-leon.command
- Fermez la fenêtre Terminal
- Ou appuyez sur `Ctrl+C` dans le Terminal

### Si lancé via Terminal manuel
- Appuyez sur `Ctrl+C`

### Si LEON tourne en arrière-plan
```bash
# Trouver le processus
ps aux | grep "next dev"

# Tuer le processus (remplacez XXXXX par le bon PID)
kill XXXXX
```

---

## 🔄 Mettre à Jour LEON

Si vous modifiez le code ou récupérez des mises à jour :

```bash
cd /Users/lionelvernay/Documents/Cursor/LEON
npm install  # Si de nouvelles dépendances sont ajoutées
npm run dev  # Relancer
```

---

## 💡 Astuces

### Lancer LEON automatiquement au démarrage de votre Mac

1. **Préférences Système** → **Utilisateurs et groupes**
2. Onglet **"Ouverture"**
3. Cliquez sur le **"+"**
4. Ajoutez `start-leon.command` ou l'app créée avec Automator

### Créer un alias Terminal

Ajoutez dans `~/.zshrc` ou `~/.bash_profile` :
```bash
alias leon="cd /Users/lionelvernay/Documents/Cursor/LEON && npm run dev"
```

Ensuite, tapez juste `leon` dans le Terminal pour lancer l'app !

---

## 🆘 Problèmes Courants

### "Permission denied"
```bash
chmod +x /Users/lionelvernay/Documents/Cursor/LEON/start-leon.command
```

### "Port 3000 already in use"
Un autre processus utilise le port 3000. Pour le trouver et le tuer :
```bash
lsof -ti:3000 | xargs kill -9
```

### "pCloud Drive not accessible"
Lancez l'application pCloud Drive avant de démarrer LEON.

### "Cannot find module 'next'"
Les dépendances ne sont pas installées :
```bash
cd /Users/lionelvernay/Documents/Cursor/LEON
npm install
```

---

## 📊 Récapitulatif

| Méthode | Difficulté | Avantages |
|---------|-----------|-----------|
| Double-clic sur `start-leon.command` | ⭐ Très facile | Le plus rapide |
| Terminal manuel | ⭐⭐ Facile | Plus de contrôle |
| Raccourci Bureau | ⭐ Très facile | Accès rapide |
| App macOS avec Automator | ⭐⭐⭐ Moyen | Comme une vraie app |
| Alias Terminal | ⭐⭐ Facile | Pour les développeurs |

**Recommandation** : Commencez par le double-clic sur `start-leon.command` ! 🚀




