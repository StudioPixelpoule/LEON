// Configuration Sentry pour Edge Runtime (middleware)
import * as Sentry from "@sentry/nextjs"

// DSN Sentry depuis variable d'environnement
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,
  
  // Performance Monitoring
  tracesSampleRate: 0.1,
  
  // Environnement
  environment: process.env.NODE_ENV,
  
  // Ne pas envoyer en développement local
  enabled: process.env.NODE_ENV === "production",
})












