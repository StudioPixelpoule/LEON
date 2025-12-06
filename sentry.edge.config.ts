// Configuration Sentry pour Edge Runtime (middleware)
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: "https://ba451d1da215a87bf7aabf2f38830b9d@o4510134756048896.ingest.de.sentry.io/4510463324258384",
  
  // Performance Monitoring
  tracesSampleRate: 0.1,
  
  // Environnement
  environment: process.env.NODE_ENV,
  
  // Ne pas envoyer en développement local
  enabled: process.env.NODE_ENV === "production",
})









