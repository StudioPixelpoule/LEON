# -----------------------------------------------------------------------------
# STAGE 1: BUILDER
# -----------------------------------------------------------------------------
FROM node:18-bookworm-slim AS builder

WORKDIR /app

# Installation des dépendances système pour le build (si nécessaire)
# python3 et make peuvent être requis pour certaines deps natives
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Installation des dépendances NPM
COPY package.json package-lock.json ./
RUN npm ci

# Copie du code source
COPY . .

# Build de l'application Next.js (mode standalone requis dans next.config.js)
# Les variables NEXT_PUBLIC_* doivent être passées au build via --build-arg
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

RUN npm run build

# -----------------------------------------------------------------------------
# STAGE 2: RUNNER
# -----------------------------------------------------------------------------
FROM node:18-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PCLOUD_LOCAL_PATH=/leon/media/films
ENV HLS_TEMP_DIR=/tmp/leon-hls

# Installation de FFmpeg et des drivers VAAPI pour Intel Quick Sync (J3455)
# intel-media-va-driver : Driver iHD (moderne) pour Gen8+ (J3455 est Apollo Lake Gen9)
# libva-drm2, libva2 : Librairies VAAPI de base
# vainfo : Pour debugger l'accélération matérielle
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    intel-media-va-driver \
    libva-drm2 \
    libva2 \
    vainfo \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Création de l'utilisateur non-root (UID 1001 pour éviter conflit avec node:1000)
RUN groupadd --gid 1001 leon && \
    useradd --uid 1001 --gid leon --shell /bin/bash --create-home leon

# Création des dossiers nécessaires
RUN mkdir -p /leon/media/films && \
    mkdir -p /tmp/leon-hls && \
    chown -R leon:leon /leon && \
    chown -R leon:leon /tmp/leon-hls

# Copie des fichiers depuis le builder
# Next.js standalone ne copie pas automatiquement public et static
COPY --from=builder /app/public ./public
COPY --from=builder --chown=leon:leon /app/.next/standalone ./
COPY --from=builder --chown=leon:leon /app/.next/static ./.next/static

# Permissions pour le user leon (notamment pour le dossier cache HLS)
RUN chown -R leon:leon /app

# Basculer sur l'utilisateur leon
USER leon

# Exposition du port
EXPOSE 3000

# Healthcheck Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Démarrage
CMD ["node", "server.js"]

