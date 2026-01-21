// Configuration Sentry côté client
import * as Sentry from "@sentry/nextjs"

// DSN Sentry depuis variable d'environnement (public car côté client)
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,
  
  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% des transactions (économise le quota)
  
  // Session Replay (optionnel, désactivé pour économiser)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1, // 10% des sessions avec erreur
  
  // Environnement
  environment: process.env.NODE_ENV,
  
  // Filtrer les erreurs non pertinentes
  ignoreErrors: [
    // Erreurs réseau courantes
    "Network request failed",
    "Failed to fetch",
    "Load failed",
    "NetworkError",
    // Erreurs de navigation
    "ResizeObserver loop",
    "AbortError",
    // Erreurs HLS non critiques
    "manifestLoadTimeOut",
  ],
  
  // Ne pas envoyer en développement local
  enabled: process.env.NODE_ENV === "production",
  
  // Intégrations
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
})












