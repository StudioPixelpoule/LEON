# LEON - Configuration NAS et Déploiement

**Date** : 22 novembre 2025  
**Contexte** : Configuration initiale du NAS Synology DS718+ pour héberger LEON (plateforme de streaming personnelle)

---

## 1. INFRASTRUCTURE ACTUELLE

### Matériel
- **NAS** : Synology DS718+
  - RAM : 16GB
  - Processeur : Intel Celeron J3455 (4 cœurs, 1.5-2.3 GHz)
  - Accélération matérielle : Intel Quick Sync Video (transcodage H.264/H.265)
- **Stockage** : 2x Seagate IronWolf 8TB en SHR (Synology Hybrid RAID)
  - Capacité utilisable : ~7.3 TB
  - Système de fichiers : Btrfs (avec snapshots, checksums, compression)
- **Réseau** : Bell Fibe Gigabit
  - Download : jusqu'à 5 Gbit/s
  - Upload : 940 Mbit/s
  - IP locale NAS : 192.168.2.128
- **Onduleur** : APC BE600M1 (EN ATTENTE DE LIVRAISON)

### Logiciels installés
- **DSM** : Version 7.x (Synology DiskStation Manager)
- **Container Manager** : Installé et configuré
  - Réseau Docker bridge : 172.17.0.1/16
- **SSH** : Activé (port 22)
- **Compte admin** : pixel_admin

### État du stockage
- **Volume principal** : /volume1 (7.7 To libre au départ)
- **Utilisé actuellement** : ~1.5 TB (médias migrés depuis PCloud)
- **Disponible** : ~6.2 TB

---

## 2. STRUCTURE DE DOSSIERS

```
/volume1/docker/
├── leon/
│   ├── cache/          # Cache de transcodage HLS
│   ├── config/         # Configuration LEON + rclone.conf
│   └── media/
│       └── films/      # 1.5TB - 457 fichiers vidéo (migrés depuis PCloud)
└── tailscale/
    └── config/         # Configuration VPN (à configurer)
```

### Chemins importants
- **Médias** : `/volume1/docker/leon/media/films/` (1.5 TB, 457 fichiers)
- **Config LEON** : `/volume1/docker/leon/config/`
- **Cache transcodage** : `/volume1/docker/leon/cache/`
- **Config rclone** : `/volume1/docker/leon/config/rclone.conf`

---

## 3. MIGRATION PCLOUD TERMINÉE

### Stats de migration
- **Source** : PCloud (région EU - eapi.pcloud.com)
- **Destination** : `/volume1/docker/leon/media/films/`
- **Données transférées** : 1.430 TiB (1.57 TB)
- **Fichiers** : 457/457 (100%)
- **Durée** : 4h 1m 48s
- **Vitesse moyenne** : 13.357 MiB/s
- **Méthode** : rclone via Docker (conteneur temporaire pcloud-migration, maintenant arrêté)

### Configuration rclone
Fichier : `/volume1/docker/leon/config/rclone.conf`
```ini
[pcloud]
type = pcloud
hostname = eapi.pcloud.com
token = {"access_token":"ANP0ZDnONSzyJXpmZLs3u0kZUpJDx3rFXyjmcYis8MVxIjWRG97X","token_type":"bearer","expiry":"0001-01-01T00:00:00Z"}
```

---

## 4. ARCHITECTURE LEON ACTUELLE (À DÉPLOYER)

### Stack technique (existante dans le repo Git)
- **Frontend** : React avec interface personnalisée
- **Backend** : Next.js avec routes API
  - Transcodage HLS avec accélération matérielle
  - Streaming MP4 direct
  - Extraction/conversion sous-titres WebVTT
  - Gestionnaire FFmpeg
- **Base de données** : (à confirmer - probablement SQLite ou PostgreSQL)

### Problèmes connus à résoudre (package d'optimisation en 5 phases)
1. Interruptions de lecture quand vitesse > capacité transcodage
2. Gestion de buffer inadéquate (attentes fixes 30s)
3. Erreurs HTTP 500 sur sous-titres formats image (PGS, VOBSUB)
4. Besoin de buffering adaptatif intelligent
5. Optimisations de performance pour fluidité Netflix

---

## 5. CONFIGURATION DOCKER À CRÉER

### Docker Compose pour LEON (à créer)

Le `docker-compose.yml` doit être créé dans `/volume1/docker/leon/` et doit inclure :

**Services nécessaires :**

1. **LEON Backend (Next.js)**
   - Ports : 3000 (API) ou selon config
   - Volumes :
     - `/volume1/docker/leon/media:/app/media` (lecture seule pour les médias)
     - `/volume1/docker/leon/cache:/app/cache` (lecture/écriture pour le cache de transcodage)
     - `/volume1/docker/leon/config:/app/config` (config de l'app)
   - Variables d'environnement à définir selon le code existant
   - Accélération matérielle : Device `/dev/dri` pour Intel Quick Sync

2. **LEON Frontend (React)**
   - Ports : 80 ou 3001 selon config
   - Build de production ou dev selon besoin

3. **Base de données** (si nécessaire)
   - PostgreSQL ou SQLite selon choix architecture

### Exemple de structure Docker Compose (à adapter au code existant)

```yaml
version: '3.8'

services:
  leon-backend:
    image: node:18-alpine  # ou image custom si Dockerfile existe
    container_name: leon-backend
    restart: unless-stopped
    working_dir: /app
    ports:
      - "3000:3000"
    volumes:
      - /volume1/docker/leon/media:/app/media:ro
      - /volume1/docker/leon/cache:/app/cache
      - /volume1/docker/leon/config:/app/config
      - ./backend:/app  # Monter le code source
    devices:
      - /dev/dri:/dev/dri  # Accélération matérielle Intel Quick Sync
    environment:
      - NODE_ENV=production
      - MEDIA_PATH=/app/media/films
      - CACHE_PATH=/app/cache
      # Autres variables selon le code
    command: npm start
    networks:
      - leon-network

  leon-frontend:
    image: node:18-alpine
    container_name: leon-frontend
    restart: unless-stopped
    working_dir: /app
    ports:
      - "80:3000"
    volumes:
      - ./frontend:/app
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://leon-backend:3000
    command: npm start
    depends_on:
      - leon-backend
    networks:
      - leon-network

networks:
  leon-network:
    driver: bridge
```

**Note** : Cette structure est un point de départ. Il faudra l'adapter selon :
- L'architecture réelle du code dans le repo Git
- Les dépendances spécifiques (bases de données, Redis, etc.)
- Les variables d'environnement nécessaires
- La présence ou non de Dockerfiles dans le repo

---

## 6. ACCÉLÉRATION MATÉRIELLE FFMPEG

### Configuration Intel Quick Sync Video

Le DS718+ dispose d'un Intel Celeron J3455 avec Quick Sync Video intégré.

**Pour utiliser l'accélération matérielle dans FFmpeg :**

```bash
# Device à monter dans Docker
devices:
  - /dev/dri:/dev/dri

# Commande FFmpeg avec accélération matérielle
ffmpeg -hwaccel vaapi -hwaccel_device /dev/dri/renderD128 \
  -hwaccel_output_format vaapi \
  -i input.mp4 \
  -vf 'scale_vaapi=w=1920:h=1080' \
  -c:v h264_vaapi \
  -b:v 5M \
  output.mp4
```

**Codecs supportés :**
- H.264 (AVC) : Encode/Decode
- H.265 (HEVC) : Decode uniquement
- VC-1 : Decode
- MPEG-2 : Decode

---

## 7. PROCHAINES ÉTAPES

### Phase 1 : Déploiement LEON (EN COURS)

1. **Récupérer le code du repo Git**
   - Cloner le repo sur le NAS ou sur le Mac pour ensuite transférer

2. **Analyser l'architecture existante**
   - Vérifier les Dockerfiles existants
   - Identifier les dépendances (bases de données, cache, etc.)
   - Lister les variables d'environnement nécessaires

3. **Créer/adapter le docker-compose.yml**
   - Configurer les volumes correctement
   - Monter `/dev/dri` pour l'accélération matérielle
   - Configurer les ports d'exposition
   - Définir les variables d'environnement

4. **Tester le déploiement**
   - `docker-compose up -d` dans `/volume1/docker/leon/`
   - Vérifier les logs : `docker-compose logs -f`
   - Tester l'accès web : http://192.168.2.128:PORT

5. **Implémenter les optimisations de performance**
   - Package d'optimisation en 5 phases (voir section 4)
   - Buffering adaptatif intelligent
   - Gestion des erreurs de sous-titres

### Phase 2 : Tailscale VPN (APRÈS LEON)

1. **Installer Tailscale via Docker**
2. **Configurer l'accès distant sécurisé**
3. **Tester la connexion depuis l'extérieur**

### Phase 3 : Sécurité et maintenance (APRÈS ONDULEUR)

1. **Activer le 2FA sur DSM**
2. **Configurer les notifications d'onduleur**
3. **Mettre en place les snapshots Btrfs automatiques**
4. **Planifier les sauvegardes**

---

## 8. COMMANDES UTILES

### SSH vers le NAS
```bash
ssh pixel_admin@192.168.2.128
```

### Docker sur le NAS
```bash
# Lister les conteneurs
sudo docker ps -a

# Logs d'un conteneur
sudo docker logs -f <container_name>

# Arrêter/démarrer
sudo docker-compose down
sudo docker-compose up -d

# Monitoring ressources
sudo docker stats
```

### Monitoring système
```bash
# Espace disque
df -h /volume1

# Utilisation par dossier
du -sh /volume1/docker/leon/*

# RAM et CPU
top
```

---

## 9. NOTES IMPORTANTES

### Risques actuels
- **Pas d'onduleur branché** : Le NAS n'est pas protégé contre les coupures de courant
  - Ne pas lancer de processus critiques de plusieurs heures
  - Les données existantes (1.5TB) sont à risque en cas de coupure
  - Attendre l'onduleur pour les opérations sensibles si possible

### Philosophie Pixel Poule
- **Contrôle total** : Pas de services cloud Synology (QuickConnect désactivé)
- **Mises à jour manuelles** : Contrôle des changements système
- **Code propre** : Architecture modulaire et documentée
- **Pragmatisme** : Solutions efficaces sans bullshit marketing

### Capacités futures
- **Ollama** : Infrastructure prête pour déployer des modèles LLM locaux
  - Structure `/volume1/docker/ollama/models/` créée mais vide
  - 16GB RAM suffisante pour des modèles 7B-13B
  - À déployer quand LEON sera stable

---

## 10. INFORMATIONS DE CONNEXION

**NAS**
- IP locale : 192.168.2.128
- Port SSH : 22
- Port DSM : 5000
- Utilisateur admin : pixel_admin
- Hostname : PixelNAS

**PCloud (backup)**
- Région : EU (eapi.pcloud.com)
- Config rclone disponible sur le NAS
- Données originales toujours présentes sur PCloud (pas supprimées)

---

## 11. QUESTIONS À RÉSOUDRE AVEC CURSOR

1. **Architecture du code existant**
   - Y a-t-il des Dockerfiles dans le repo ?
   - Quelle est la structure des dossiers backend/frontend ?
   - Quelles dépendances externes (BDD, Redis, etc.) ?

2. **Variables d'environnement**
   - Quelles variables sont nécessaires pour la config ?
   - Où sont stockées les métadonnées des films ?
   - Comment est géré le cache de transcodage ?

3. **Optimisations à implémenter**
   - Prioriser quelle phase du package d'optimisation ?
   - Comment intégrer l'accélération matérielle Intel Quick Sync ?
   - Quelle stratégie pour le buffering adaptatif ?

4. **Déploiement**
   - Build de production ou dev sur le NAS ?
   - CI/CD depuis le Mac vers le NAS ?
   - Hot reload pour le développement ?

---

## 12. RESSOURCES

### Documentation technique
- Synology DSM : https://www.synology.com/dsm
- Docker Compose : https://docs.docker.com/compose/
- FFmpeg VAAPI : https://trac.ffmpeg.org/wiki/Hardware/VAAPI
- Tailscale : https://tailscale.com/kb/

### Spécifications matériel
- DS718+ : https://www.synology.com/en-global/products/DS718+
- Intel Celeron J3455 : https://ark.intel.com/content/www/us/en/ark/products/95594/intel-celeron-processor-j3455-2m-cache-up-to-2-3-ghz.html

---

**Dernière mise à jour** : 22 novembre 2025, 17:15 EST  
**Statut** : Infrastructure prête, médias migrés, prêt pour le déploiement LEON
