/**
 * Gestionnaire d'erreurs centralisé pour LEON
 * Fournit des messages user-friendly et une gestion cohérente des erreurs
 */

/**
 * Erreur personnalisée avec message utilisateur et détails techniques
 */
export class UserFriendlyError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    public technicalDetails?: any,
    public recoverable = false,
    public httpStatus = 500
  ) {
    super(userMessage)
    this.name = 'UserFriendlyError'
  }

  /**
   * Convertit l'erreur en réponse JSON pour l'API
   */
  toJSON() {
    return {
      error: this.userMessage,
      code: this.code,
      recoverable: this.recoverable,
      details: this.technicalDetails
    }
  }
}

/**
 * Catalogue des erreurs connues avec leurs messages
 */
export const ERROR_CODES = {
  // Erreurs vidéo
  VIDEO_CORRUPTED: {
    code: 'VIDEO_CORRUPTED',
    message: 'Le fichier vidéo est corrompu ou invalide',
    httpStatus: 422
  },
  VIDEO_NOT_FOUND: {
    code: 'VIDEO_NOT_FOUND',
    message: 'Fichier vidéo introuvable',
    httpStatus: 404
  },
  UNSUPPORTED_CODEC: {
    code: 'UNSUPPORTED_CODEC',
    message: 'Format vidéo non supporté',
    httpStatus: 415,
    recoverable: true
  },
  TRANSCODE_FAILED: {
    code: 'TRANSCODE_FAILED',
    message: 'Erreur lors du transcodage de la vidéo',
    httpStatus: 500,
    recoverable: true
  },

  // Erreurs sous-titres
  SUBTITLE_IMAGE_FORMAT: {
    code: 'SUBTITLE_IMAGE_FORMAT',
    message: 'Format de sous-titre image non supporté (PGS, VOBSUB)',
    httpStatus: 415
  },
  SUBTITLE_NOT_AVAILABLE: {
    code: 'SUBTITLE_NOT_AVAILABLE',
    message: 'Aucun sous-titre disponible pour cette vidéo',
    httpStatus: 404
  },
  SUBTITLE_CONVERSION_FAILED: {
    code: 'SUBTITLE_CONVERSION_FAILED',
    message: 'Erreur lors de la conversion des sous-titres',
    httpStatus: 500,
    recoverable: true
  },

  // Erreurs système
  NO_SPACE: {
    code: 'NO_SPACE',
    message: 'Espace disque insuffisant sur le serveur',
    httpStatus: 507,
    recoverable: true
  },
  FFMPEG_NOT_AVAILABLE: {
    code: 'FFMPEG_NOT_AVAILABLE',
    message: 'FFmpeg n\'est pas disponible sur le serveur',
    httpStatus: 500
  },
  PROCESS_TIMEOUT: {
    code: 'PROCESS_TIMEOUT',
    message: 'Le traitement a pris trop de temps',
    httpStatus: 504,
    recoverable: true
  },

  // Erreurs réseau
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message: 'Erreur réseau, veuillez réessayer',
    httpStatus: 503,
    recoverable: true
  },
  BUFFER_STALL: {
    code: 'BUFFER_STALL',
    message: 'Mise en mémoire tampon en cours...',
    httpStatus: 503,
    recoverable: true
  }
} as const

/**
 * Classe principale de gestion des erreurs
 */
export class ErrorHandler {
  /**
   * Log structuré d'une erreur
   */
  static log(context: string, error: Error | UserFriendlyError, additionalData?: any): void {
    const timestamp = new Date().toISOString()
    
    if (error instanceof UserFriendlyError) {
      console.error(`[${timestamp}] [${context}] ❌ ${error.code}`, {
        message: error.userMessage,
        technical: error.technicalDetails,
        recoverable: error.recoverable,
        ...additionalData
      })
    } else {
      console.error(`[${timestamp}] [${context}] ❌ Erreur`, {
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5),
        ...additionalData
      })
    }
  }

  /**
   * Crée une erreur user-friendly depuis un code d'erreur
   */
  static createError(
    errorCode: keyof typeof ERROR_CODES,
    technicalDetails?: any
  ): UserFriendlyError {
    const config = ERROR_CODES[errorCode]
    return new UserFriendlyError(
      config.code,
      config.message,
      technicalDetails,
      config.recoverable || false,
      config.httpStatus
    )
  }

  /**
   * Détecte le type d'erreur FFmpeg et retourne l'erreur appropriée
   */
  static parseFFmpegError(stderr: string): UserFriendlyError {
    const lowerStderr = stderr.toLowerCase()

    // Fichier corrompu
    if (lowerStderr.includes('invalid data found') || lowerStderr.includes('corrupt')) {
      return this.createError('VIDEO_CORRUPTED', { stderr: stderr.slice(-500) })
    }

    // Espace disque
    if (lowerStderr.includes('no space left') || lowerStderr.includes('disk full')) {
      return this.createError('NO_SPACE', { stderr: stderr.slice(-500) })
    }

    // Codec non supporté
    if (lowerStderr.includes('codec not currently supported') || 
        lowerStderr.includes('unknown codec') ||
        lowerStderr.includes('decoder') && lowerStderr.includes('not found')) {
      return this.createError('UNSUPPORTED_CODEC', { stderr: stderr.slice(-500) })
    }

    // Erreur générique de transcodage
    return this.createError('TRANSCODE_FAILED', { stderr: stderr.slice(-500) })
  }

  /**
   * Wrapper pour les appels FFmpeg avec retry automatique
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    backoffMs = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        const isLastAttempt = attempt === maxRetries
        
        // Si c'est une erreur non récupérable, ne pas retry
        if (error instanceof UserFriendlyError && !error.recoverable) {
          throw error
        }

        if (isLastAttempt) {
          throw error
        }

        // Exponential backoff
        const waitTime = backoffMs * Math.pow(2, attempt - 1)
        console.warn(`⚠️ Tentative ${attempt}/${maxRetries} échouée, retry dans ${waitTime}ms...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    // TypeScript safety (ne devrait jamais arriver ici)
    throw new Error('Retry logic error')
  }
}

/**
 * Helper pour créer des réponses d'erreur Next.js
 */
export function createErrorResponse(error: Error | UserFriendlyError) {
  if (error instanceof UserFriendlyError) {
    return {
      status: error.httpStatus,
      body: error.toJSON()
    }
  }

  // Erreur inconnue
  return {
    status: 500,
    body: {
      error: 'Une erreur inattendue s\'est produite',
      code: 'UNKNOWN_ERROR',
      details: error.message
    }
  }
}


