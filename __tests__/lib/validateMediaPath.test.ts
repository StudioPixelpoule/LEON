/**
 * Tests critiques : validation des chemins de fichiers
 * Vérifie la protection contre le path traversal
 */

import { describe, it, expect } from 'vitest'
import { validateMediaPath, isPathAllowed, getSafeFilename } from '@/lib/path-validator'

describe('validateMediaPath', () => {
  // Chemins valides
  it('accepte un chemin valide dans /leon/media', () => {
    const result = validateMediaPath('/leon/media/films/film.mkv')
    expect(result.valid).toBe(true)
    expect(result.normalized).toBeDefined()
  })

  it('accepte un chemin valide dans /leon/transcoded', () => {
    const result = validateMediaPath('/leon/transcoded/output.mp4')
    expect(result.valid).toBe(true)
  })

  it('accepte un chemin temporaire /tmp/leon-hls', () => {
    const result = validateMediaPath('/tmp/leon-hls/segment.ts')
    expect(result.valid).toBe(true)
  })

  it('accepte un chemin temporaire /tmp/leon-audio-remux', () => {
    const result = validateMediaPath('/tmp/leon-audio-remux/remuxed.mp4')
    expect(result.valid).toBe(true)
  })

  // Path traversal
  it('bloque le path traversal avec ..', () => {
    const result = validateMediaPath('/leon/media/../../etc/passwd')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('path traversal')
  })

  it('bloque le path traversal en milieu de chemin', () => {
    const result = validateMediaPath('/leon/media/films/../../../etc/shadow')
    expect(result.valid).toBe(false)
  })

  it('bloque les chemins hors racines autorisées', () => {
    const result = validateMediaPath('/etc/passwd')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('non autorisé')
  })

  it('bloque /usr/bin', () => {
    const result = validateMediaPath('/usr/bin/test')
    expect(result.valid).toBe(false)
  })

  // Entrées invalides
  it('bloque null', () => {
    const result = validateMediaPath(null)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('manquant')
  })

  it('bloque undefined', () => {
    const result = validateMediaPath(undefined)
    expect(result.valid).toBe(false)
  })

  it('bloque chaîne vide', () => {
    const result = validateMediaPath('')
    expect(result.valid).toBe(false)
  })

  // Caractères dangereux
  it('bloque les null bytes', () => {
    const result = validateMediaPath('/leon/media/film\0.mkv')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('non autorisés')
  })

  it('bloque les backticks (command substitution)', () => {
    const result = validateMediaPath('/leon/media/`rm -rf /`.mkv')
    expect(result.valid).toBe(false)
  })

  it('bloque la substitution de commande $()', () => {
    const result = validateMediaPath('/leon/media/$(whoami).mkv')
    expect(result.valid).toBe(false)
  })

  // Chemins avec caractères Unicode normaux (doivent passer)
  it('accepte les caractères accentués', () => {
    const result = validateMediaPath('/leon/media/films/Le Fabuleux Destin d\'Amélie Poulain.mkv')
    expect(result.valid).toBe(true)
  })
})

describe('isPathAllowed', () => {
  it('retourne true pour chemin valide', () => {
    expect(isPathAllowed('/leon/media/films/test.mp4')).toBe(true)
  })

  it('retourne false pour chemin interdit', () => {
    expect(isPathAllowed('/etc/passwd')).toBe(false)
  })
})

describe('getSafeFilename', () => {
  it('extrait le nom de fichier', () => {
    expect(getSafeFilename('/leon/media/films/test.mp4')).toBe('test.mp4')
  })

  it('nettoie les caractères dangereux', () => {
    const result = getSafeFilename('/leon/media/films/te;st&file.mp4')
    expect(result).not.toContain(';')
    expect(result).not.toContain('&')
  })
})
