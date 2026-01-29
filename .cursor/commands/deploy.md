---
name: deploy
description: Déploie LEON sur le NAS Synology via Docker. Build, push, et redémarrage du conteneur.
---

# Command /deploy

Déploie LEON sur le NAS Synology DS718+ via Docker.

## Prérequis

- Docker installé localement
- Accès SSH au NAS ou Tailscale configuré
- Container Manager sur le NAS
- Variables d'environnement production configurées

## Workflow

### 1. Vérifications pré-déploiement

```bash
# Build local pour vérifier
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

# Vérifier TypeScript
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors"
  exit 1
fi

# Vérifier les variables d'env requises
REQUIRED_VARS="NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY TMDB_API_KEY"
for var in $REQUIRED_VARS; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing: $var"
    exit 1
  fi
done
```

### 2. Build Docker

```bash
# Build l'image
docker build -t leon:latest .

# Tag pour le registry (si utilisé)
docker tag leon:latest registry.local/leon:$(date +%Y%m%d-%H%M)
docker tag leon:latest registry.local/leon:latest
```

### 3. Déploiement sur NAS

#### Option A: Via SSH direct

```bash
# Se connecter au NAS
ssh admin@nas.local

# Arrêter le conteneur actuel
docker stop leon
docker rm leon

# Pull la nouvelle image (si registry)
docker pull registry.local/leon:latest

# Ou copier l'image (si pas de registry)
# Sur la machine locale:
docker save leon:latest | ssh admin@nas.local 'docker load'

# Démarrer le nouveau conteneur
docker run -d \
  --name leon \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /volume1/media:/media:ro \
  -v /volume1/docker/leon/cache:/tmp/leon-cache \
  -e NODE_ENV=production \
  --env-file /volume1/docker/leon/.env \
  leon:latest
```

#### Option B: Via Docker Compose sur NAS

```yaml
# docker-compose.yml sur le NAS
version: '3.8'
services:
  leon:
    image: leon:latest
    container_name: leon
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - /volume1/media:/media:ro
      - /volume1/docker/leon/cache:/tmp/leon-cache
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

```bash
# Déploiement
ssh admin@nas.local "cd /volume1/docker/leon && docker-compose pull && docker-compose up -d"
```

#### Option C: Via Tailscale

```bash
# Si NAS accessible via Tailscale
ssh admin@nas-tailscale "docker-compose -f /volume1/docker/leon/docker-compose.yml up -d"
```

### 4. Vérification post-déploiement

```bash
# Vérifier que le conteneur tourne
ssh admin@nas.local "docker ps | grep leon"

# Vérifier les logs
ssh admin@nas.local "docker logs leon --tail 50"

# Test de santé
curl -s https://leon.direct/api/health
```

### 5. Cloudflare Tunnel (si configuré)

```bash
# Le tunnel devrait se reconnecter automatiquement
# Vérifier le statut dans le dashboard Cloudflare
# https://dash.cloudflare.com → Zero Trust → Tunnels
```

## Format du rapport

```
═══════════════════════════════════════════════════════════════════
                    DÉPLOIEMENT - LEON
═══════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────┐
│ PRÉ-DÉPLOIEMENT                                                 │
├─────────────────────────────────────────────────────────────────┤
│ ✅ Build local réussi                                           │
│ ✅ TypeScript: 0 erreurs                                        │
│ ✅ Variables d'environnement OK                                 │
│ ✅ Image Docker: leon:20250129-1430                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ DÉPLOIEMENT                                                     │
├─────────────────────────────────────────────────────────────────┤
│ Cible          : NAS Synology DS718+ (192.168.1.x)             │
│ Méthode        : Docker Compose                                 │
│ Ancien cont.   : ✅ Arrêté                                      │
│ Nouvelle image : ✅ Chargée                                     │
│ Nouveau cont.  : ✅ Démarré                                     │
│ Durée          : 45s                                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ POST-DÉPLOIEMENT                                                │
├─────────────────────────────────────────────────────────────────┤
│ Conteneur      : ✅ Running (15s)                               │
│ Port 3000      : ✅ Accessible                                  │
│ Health check   : ✅ OK                                          │
│ Cloudflare     : ✅ Tunnel connecté                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ URLS                                                            │
├─────────────────────────────────────────────────────────────────┤
│ Local          : http://192.168.1.x:3000                        │
│ Tailscale      : http://nas:3000                                │
│ Public         : https://leon.direct                            │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════

✅ Déploiement terminé avec succès

Prochaines étapes:
• Vérifier l'app: https://leon.direct
• Monitorer Sentry pour erreurs
• Tester une lecture vidéo
```

## Checklist pré-déploiement

```markdown
- [ ] Branche main à jour
- [ ] Build local réussi
- [ ] TypeScript sans erreurs
- [ ] Variables d'env production configurées
- [ ] Migrations Supabase appliquées
- [ ] Backup de l'ancienne version (si critique)
```

## Gestion des erreurs

### Build Docker échoue

```
❌ Erreur: Build Docker échoué

Vérifier:
1. Dockerfile présent à la racine
2. .dockerignore configuré
3. Dépendances toutes présentes
4. Logs: docker build -t leon:latest . 2>&1
```

### Conteneur ne démarre pas

```
❌ Erreur: Conteneur ne démarre pas

Vérifier les logs:
docker logs leon

Causes courantes:
1. Port 3000 déjà utilisé
2. Variables d'env manquantes
3. Volume non accessible
4. Mémoire insuffisante
```

### Tunnel Cloudflare déconnecté

```
❌ Erreur: Tunnel Cloudflare non connecté

Vérifier:
1. cloudflared tourne: docker ps | grep cloudflared
2. Token valide dans .env
3. Dashboard Cloudflare: Zero Trust → Tunnels
```

## Options

- `/deploy` — Déploiement complet
- `/deploy --build-only` — Build Docker sans déployer
- `/deploy --dry-run` — Simuler sans exécuter
- `/deploy --skip-tests` — Ignorer les vérifications (dangereux)
- `/deploy --rollback` — Revenir à la version précédente

## Rollback

```bash
# Si problème après déploiement
ssh admin@nas.local "
  docker stop leon
  docker rm leon
  docker run -d --name leon ... leon:previous-tag
"
```

## Dockerfile recommandé

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# FFmpeg pour le transcodage
RUN apk add --no-cache ffmpeg

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```
