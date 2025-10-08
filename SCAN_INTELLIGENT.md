# 🎬 Scan Intelligent - Documentation

## Vue d'ensemble

Le système de scan intelligent de LEON permet de maintenir automatiquement la bibliothèque de films à jour en détectant :
- **Les nouveaux fichiers** à indexer
- **Les fichiers modifiés** à mettre à jour
- **Les fichiers supprimés** à retirer de la base
- **Les métadonnées manquantes** à compléter

## Fonctionnement

### 1. Comparaison avec l'existant

À chaque scan, le système :
1. Récupère tous les médias déjà présents en base de données
2. Scanne le dossier pCloud Drive local
3. Compare les deux listes pour détecter les changements

### 2. Détection des changements

Le système identifie automatiquement :

#### 🆕 Nouveaux fichiers
- Fichiers présents sur le disque mais pas en base
- Indexation complète avec recherche TMDB

#### 🔄 Fichiers modifiés
- Comparaison de la taille du fichier
- Si changée : mise à jour complète
- Si métadonnées manquantes : recherche TMDB

#### ✅ Fichiers à jour
- Métadonnées complètes (tmdb_id + poster_url)
- Taille de fichier identique
- **Skippés** pour optimiser les performances

#### 🗑️ Fichiers supprimés
- Présents en base mais plus sur le disque
- Suppression automatique de la base

### 3. Traitement par batch

- Traitement par lots de **100 fichiers**
- Optimisé pour MacBook Air M1
- Évite la surcharge mémoire

## Statistiques détaillées

Après chaque scan, le système retourne :

```json
{
  "success": true,
  "message": "Scan intelligent terminé",
  "stats": {
    "total": 150,           // Fichiers scannés
    "new": 5,               // Nouveaux indexés
    "updated": 3,           // Mis à jour
    "skipped": 140,         // Déjà à jour
    "deleted": 2,           // Supprimés
    "errors": 0,            // Erreurs
    "identificationRate": 95,
    "confidence": {
      "high": 8,            // >80% confiance
      "medium": 0,          // 60-80%
      "low": 0              // <60%
    },
    "unidentified": 0
  }
}
```

## Avantages

### ⚡ Performance
- Skip intelligent des fichiers déjà à jour
- Pas de requêtes TMDB inutiles
- Scan ultra-rapide après le premier passage

### 🎯 Précision
- Détection des modifications de fichiers
- Mise à jour des métadonnées manquantes
- Nettoyage automatique des fichiers supprimés

### 🔄 Synchronisation
- Maintien automatique de la cohérence
- Base de données toujours à jour
- Pas de doublons, pas d'entrées orphelines

### 📊 Visibilité
- Statistiques détaillées après chaque scan
- Logs console clairs et structurés
- Taux d'identification et niveaux de confiance

## Cas d'usage

### 📁 Ajout de nouveaux films
1. Copier les fichiers dans pCloud Drive/films
2. Lancer un scan
3. Seuls les nouveaux fichiers sont traités
4. Les films existants sont skippés

### 🔄 Mise à jour de fichiers
1. Remplacer un fichier (ex: upgrade qualité)
2. Lancer un scan
3. Le système détecte le changement de taille
4. Métadonnées mises à jour automatiquement

### 🗑️ Suppression de films
1. Supprimer des fichiers du dossier
2. Lancer un scan
3. Les entrées correspondantes sont supprimées de la base
4. La bibliothèque reste propre

### 🔍 Complément de métadonnées
1. Des films ont été indexés sans métadonnées TMDB
2. Lancer un scan
3. Le système détecte les métadonnées manquantes
4. Recherche TMDB et mise à jour automatique

## Logs console

Le scan produit des logs détaillés :

```
📊 Récupération des médias existants en base...
🎬 Début du scan: 150 fichiers trouvés

📦 Traitement du batch 1/2
⏭️  Déjà à jour: The Matrix (1999).mkv
🔄 Fichier modifié (taille changée): Inception (2010).mkv
🔍 Analyse: Inception (2010).mkv
✅ Match trouvé: Inception (2010) - Confiance: 85%
💾 Mis à jour: Inception (2010).mkv

🗑️  Suppression de 2 médias qui n'existent plus...
✅ 2 médias supprimés

📊 RÉSUMÉ DU SCAN
   Total fichiers: 150
   ✅ Déjà à jour: 140
   🆕 Nouveaux: 5
   🔄 Mis à jour: 3
   🗑️  Supprimés: 2
   ❌ Erreurs: 0
   🎯 Taux identification: 95%
```

## API Endpoint

**POST** `/api/scan`

### Réponse succès

```json
{
  "success": true,
  "message": "Scan intelligent terminé",
  "stats": { ... }
}
```

### Réponse erreur

```json
{
  "error": "Dossier pCloud Drive non accessible: /path/to/folder"
}
```

## Configuration

### Variables d'environnement

```env
# Chemin local pCloud Drive
PCLOUD_LOCAL_PATH=/Users/lionelvernay/pCloud Drive/films

# TMDB API (pour les métadonnées)
TMDB_API_KEY=votre_clé_api
```

## Optimisations futures

- [ ] Scan incrémental par date de modification
- [ ] Cache local des métadonnées TMDB
- [ ] Détection de doublons par hash MD5
- [ ] Scan en arrière-plan automatique
- [ ] Notifications de changements

## Bonnes pratiques

### 🎯 Fréquence de scan
- **Quotidien** : Si ajouts fréquents
- **Hebdomadaire** : Si bibliothèque stable
- **Après modifications** : Upload/suppression de fichiers

### ⚠️ À éviter
- Scanner pendant l'ajout de fichiers
- Scanner si pCloud Drive non monté
- Lancer plusieurs scans simultanément

### ✅ Recommandations
- Attendre la fin du scan avant d'en relancer un
- Vérifier les logs en cas d'erreur
- Utiliser l'outil de validation manuelle pour les films non identifiés

## Support

En cas de problème :
1. Vérifier que pCloud Drive est monté
2. Consulter les logs console
3. Vérifier les variables d'environnement
4. Utiliser l'outil de validation manuelle (`/admin/validate`)

---

**Pixel Poule** - Système de gestion de médias intelligent

