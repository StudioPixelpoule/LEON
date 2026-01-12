const { withSentryConfig } = require('@sentry/nextjs')

// Récupérer les infos de version
// En Docker: BUILD_SHA est passé comme ARG/ENV
// En local: on essaie git, sinon 'dev'
let gitCommit = process.env.BUILD_SHA || 'dev'
let buildDate = process.env.BUILD_DATE || new Date().toISOString()

// En dev local, essayer de lire git
if (gitCommit === 'dev') {
  try {
    const { execSync } = require('child_process')
    gitCommit = execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    // Pas de git disponible
  }
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
    NEXT_PUBLIC_BUILD_SHA: gitCommit,
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