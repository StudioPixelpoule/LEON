// Instrumentation pour Sentry et démarrage automatique des services
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
    
    // Démarrer automatiquement le file watcher après un délai
    // pour s'assurer que l'app est complètement initialisée
    setTimeout(async () => {
      try {
        const { default: fileWatcher } = await import('./lib/file-watcher')
        
        if (!fileWatcher.isActive()) {
          console.log('🚀 [BOOT] Démarrage automatique du File Watcher...')
          await fileWatcher.start()
          console.log('✅ [BOOT] File Watcher actif - Les nouveaux fichiers seront détectés automatiquement')
        }
      } catch (error) {
        console.error('❌ [BOOT] Erreur démarrage File Watcher:', error)
      }
    }, 5000) // Attendre 5 secondes après le boot
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}












