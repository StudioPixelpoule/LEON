/**
 * Validation et sécurisation des chemins de fichiers
 * Protection contre le path traversal et accès non autorisés
 */

import path from 'path'
import { existsSync } from 'fs'

/**
 * Racines autorisées pour l'accès aux fichiers média
 * Ces chemins sont définis en variables d'environnement ou par défaut
 */
const ALLOWED_ROOTS = (() => {
  const roots: string[] = []
  
  // Chemins depuis les variables d'environnement
  if (process.env.MEDIA_ROOT) {
    roots.push(process.env.MEDIA_ROOT)
  }
  if (process.env.TRANSCODED_DIR) {
    roots.push(process.env.TRANSCODED_DIR)
  }
  
  // Chemins par défaut pour LEON
  roots.push('/leon/media', '/leon/transcoded')
  
  // Chemins temporaires
  roots.push('/tmp/leon-hls', '/tmp/leon-audio-remux')
  
  // macOS : Volume NAS Synology
  roots.push('/Volumes')
  
  return roots
})()

export type PathValidationResult = {
  valid: boolean
  normalized?: string
  error?: string
}

/**
 * Valider un chemin de fichier média
 * Vérifie contre le path traversal et les accès non autorisés
 * 
 * @param filepath - Chemin à valider
 * @param options - Options de validation
 * @returns Résultat de validation avec chemin normalisé si valide
 */
export function validateMediaPath(
  filepath: string | null | undefined,
  options: {
    requireExists?: boolean
    allowedRoots?: string[]
  } = {}
): PathValidationResult {
  const { requireExists = false, allowedRoots = ALLOWED_ROOTS } = options
  
  // Vérification de base
  if (!filepath || typeof filepath !== 'string') {
    return { valid: false, error: 'Chemin manquant ou invalide' }
  }
  
  // Normaliser le chemin en NFC (forme composée, standard Linux/Windows/NAS)
  // NFD décomposerait é en e+accent, ce qui ne matcherait pas les fichiers NFC
  const normalizedInput = filepath.normalize('NFC')
  
  // Détection path traversal - CRITIQUE
  if (normalizedInput.includes('..')) {
    console.error('[PATH-VALIDATOR] Path traversal détecté:', filepath.slice(0, 100))
    return { valid: false, error: 'Chemin invalide - path traversal détecté' }
  }
  
  // Détection de caractères dangereux
  const dangerousPatterns = [
    /\0/,           // Null byte injection
    /[\r\n]/,       // Line injection
    /[<>|]/,        // Shell metacharacters
    /\$\(/,         // Command substitution
    /`/,            // Backtick command substitution
  ]
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(normalizedInput)) {
      console.error('[PATH-VALIDATOR] Caractère dangereux détecté:', filepath.slice(0, 50))
      return { valid: false, error: 'Chemin contient des caractères non autorisés' }
    }
  }
  
  // Résoudre le chemin absolu
  const resolved = path.resolve(normalizedInput)
  
  // Vérifier que le chemin résolu commence par une racine autorisée
  const isAllowed = allowedRoots.some(root => {
    const normalizedRoot = path.resolve(root)
    return resolved.startsWith(normalizedRoot + path.sep) || resolved === normalizedRoot
  })
  
  if (!isAllowed) {
    console.warn('[PATH-VALIDATOR] Accès non autorisé:', resolved.slice(0, 100))
    return { valid: false, error: 'Accès non autorisé à ce chemin' }
  }
  
  // Vérifier l'existence si demandé
  if (requireExists && !existsSync(resolved)) {
    return { valid: false, error: 'Fichier non trouvé' }
  }
  
  return { valid: true, normalized: resolved }
}

/**
 * Valider un chemin et retourner le chemin normalisé ou lancer une erreur
 * Version pratique pour les routes API
 */
export function getValidatedPath(
  filepath: string | null | undefined,
  options: {
    requireExists?: boolean
    allowedRoots?: string[]
  } = {}
): string {
  const result = validateMediaPath(filepath, options)
  
  if (!result.valid || !result.normalized) {
    throw new PathValidationError(result.error || 'Chemin invalide')
  }
  
  return result.normalized
}

/**
 * Erreur personnalisée pour validation de chemin
 */
export class PathValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathValidationError'
  }
}

/**
 * Échapper un chemin pour utilisation dans une commande shell
 * À utiliser UNIQUEMENT si spawn() n'est pas possible
 * Préférer TOUJOURS spawn() avec arguments séparés
 */
export function escapeShellArg(arg: string): string {
  // Double-quote avec échappement des caractères spéciaux
  return `"${arg.replace(/(["\$`\\])/g, '\\$1')}"`
}

/**
 * Vérifier si un chemin est dans un répertoire autorisé
 * Utile pour les vérifications rapides
 */
export function isPathAllowed(filepath: string): boolean {
  return validateMediaPath(filepath).valid
}

/**
 * Obtenir le nom de fichier sécurisé depuis un chemin
 * Retourne uniquement le basename sans caractères dangereux
 */
export function getSafeFilename(filepath: string): string {
  const basename = path.basename(filepath)
  // Supprimer les caractères potentiellement dangereux
  return basename.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s\-_.()[\]]/gi, '_')
}
