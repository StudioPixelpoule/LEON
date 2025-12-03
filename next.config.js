const { withSentryConfig } = require('@sentry/nextjs')

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
