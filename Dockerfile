# -----------------------------------------------------------------------------
# DOCKERFILE MULTI-STAGE - Build complet pour CI/CD
# Stage 1: Build Next.js
# Stage 2: Runtime optimisé avec FFmpeg
# -----------------------------------------------------------------------------

# ============================================
# STAGE 1: Builder - Compilation Next.js
# ============================================
FROM node:18-alpine AS builder

WORKDIR /app

# Variables de build (passées par GitHub Actions)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG BUILD_SHA=dev
ARG BUILD_DATE

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_DATE=$BUILD_DATE
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances
RUN npm ci --ignore-scripts

# Copie du code source
COPY . .

# Build Next.js en mode standalone
RUN npm run build

# ============================================
# STAGE 2: Runner - Image de production
# ============================================
FROM node:18-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PCLOUD_LOCAL_PATH=/leon/media/films
ENV HLS_TEMP_DIR=/tmp/leon-hls
ENV TRANSCODED_DIR=/leon/transcoded

# Installation de FFmpeg et des drivers VAAPI pour Intel Quick Sync
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    intel-media-va-driver \
    libva-drm2 \
    libva2 \
    vainfo \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Création de l'utilisateur non-root
RUN groupadd --gid 1001 leon && \
    useradd --uid 1001 --gid leon --shell /bin/bash --create-home leon

# Création des dossiers nécessaires
RUN mkdir -p /leon/media/films && \
    mkdir -p /leon/transcoded && \
    mkdir -p /tmp/leon-hls && \
    chown -R leon:leon /leon && \
    chown -R leon:leon /tmp/leon-hls

# Copie des fichiers compilés depuis le builder
COPY --from=builder --chown=leon:leon /app/public ./public
COPY --from=builder --chown=leon:leon /app/.next/standalone ./
COPY --from=builder --chown=leon:leon /app/.next/static ./.next/static

# Permissions
RUN chown -R leon:leon /app

USER leon

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
