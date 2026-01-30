const { withSentryConfig } = require('@sentry/nextjs')
const fs = require('fs')
const path = require('path')

// Récupérer les infos de version
let gitCommit = 'dev'
let buildDate = new Date().toISOString()

// 1. Essayer de lire build-info.json (créé par GitHub Actions)
try {
  const buildInfoPath = path.join(__dirname, 'build-info.json')
  if (fs.existsSync(buildInfoPath)) {
    const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'))
    gitCommit = buildInfo.sha?.slice(0, 7) || 'dev'
    buildDate = buildInfo.date || buildDate
    console.log(`📦 Build info: ${gitCommit} @ ${buildDate}`)
  }
} catch (e) {
  console.log('⚠️ Could not read build-info.json:', e.message)
}

// 2. Fallback: variables d'environnement
if (gitCommit === 'dev' && process.env.BUILD_SHA) {
  gitCommit = process.env.BUILD_SHA.slice(0, 7)
}

// 3. Fallback: git en dev local
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
    // Utiliser remotePatterns (domains est deprecated)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
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