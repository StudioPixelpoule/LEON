const { withSentryConfig } = require('@sentry/nextjs')
const { execSync } = require('child_process')

// Récupérer les infos de version au build
let gitCommit = 'dev'
let gitBranch = 'local'
let buildDate = new Date().toISOString()

try {
  gitCommit = execSync('git rev-parse --short HEAD').toString().trim()
  gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
} catch {
  // En cas d'erreur (pas de git), utiliser les valeurs par défaut
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: [
      'image.tmdb.org',              // TMDB images (posters auto)
      'vjgflvphprmuxsfwmhyo.supabase.co' // Supabase Storage (jaquettes manuelles)
    ],
    formats: ['image/webp'], // Optimisation WebP
  },
  
  // Activer l'instrumentation pour Sentry
  experimental: {
    instrumentationHook: true,
  },
  
  // Variables d'environnement de build (accessibles côté client)
  env: {
    NEXT_PUBLIC_GIT_COMMIT: gitCommit,
    NEXT_PUBLIC_GIT_BRANCH: gitBranch,
    NEXT_PUBLIC_BUILD_DATE: buildDate,
  },
}

// Configuration Sentry
const sentryWebpackPluginOptions = {
  // Organisation et projet Sentry
  org: 'pixel-poule',
  project: 'leon',
  
  // Désactiver les source maps en production pour la sécurité
  // (les erreurs seront quand même trackées)
  hideSourceMaps: true,
  
  // Désactiver le télémétrie
  telemetry: false,
  
  // Ne pas échouer le build si Sentry n'est pas accessible
  silent: true,
  
  // Désactiver l'upload des source maps (optionnel, économise du temps de build)
  disableServerWebpackPlugin: true,
  disableClientWebpackPlugin: true,
}

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions)