/**
 * Tests critiques : calcul de similarité pour le matching TMDB
 * Vérifie que l'algorithme identifie correctement les films
 */

import { describe, it, expect } from 'vitest'
import { 
  calculateSimilarity, 
  normalizeString, 
  areSimilar, 
  findBestMatch,
  jaroWinklerSimilarity 
} from '@/lib/media-recognition/similarityUtils'

describe('calculateSimilarity', () => {
  it('retourne 1 pour chaînes identiques', () => {
    expect(calculateSimilarity('The Matrix', 'The Matrix')).toBe(1)
  })

  it('retourne 0 pour chaînes vides', () => {
    expect(calculateSimilarity('', 'test')).toBe(0)
    expect(calculateSimilarity('test', '')).toBe(0)
  })

  it('retourne un score élevé pour variations mineures', () => {
    const score = calculateSimilarity('The Matrix', 'the matrix')
    expect(score).toBeGreaterThan(0.7)
  })

  it('retourne un score faible pour chaînes très différentes', () => {
    const score = calculateSimilarity('The Matrix', 'Finding Nemo')
    expect(score).toBeLessThan(0.5)
  })

  it('gère la comparaison avec accents', () => {
    const score = calculateSimilarity('Amélie', 'Amelie')
    expect(score).toBeGreaterThan(0.7)
  })
})

describe('normalizeString', () => {
  it('met en minuscules', () => {
    expect(normalizeString('HELLO')).toBe('hello')
  })

  it('retire les accents', () => {
    expect(normalizeString('Amélie')).toBe('amelie')
  })

  it('normalise les espaces', () => {
    expect(normalizeString('  hello   world  ')).toBe('hello world')
  })

  it('retire les caractères spéciaux', () => {
    const result = normalizeString("L'homme (2024)")
    expect(result).not.toContain("'")
    expect(result).not.toContain('(')
  })
})

describe('areSimilar', () => {
  it('détecte des chaînes similaires (seuil par défaut 0.7)', () => {
    expect(areSimilar('The Matrix', 'the matrix')).toBe(true)
  })

  it('rejette des chaînes très différentes', () => {
    expect(areSimilar('The Matrix', 'Finding Nemo')).toBe(false)
  })

  it('respecte un seuil personnalisé', () => {
    expect(areSimilar('test', 'tost', 0.5)).toBe(true)
    expect(areSimilar('test', 'tost', 0.99)).toBe(false)
  })
})

describe('findBestMatch', () => {
  it('trouve le meilleur match dans une liste', () => {
    const result = findBestMatch('The Matrix', [
      'Finding Nemo',
      'The Matrix Reloaded',
      'Matrix',
      'Inception'
    ])
    expect(result).not.toBeNull()
    expect(result!.match).toBe('Matrix')
  })

  it('retourne null pour une liste vide', () => {
    expect(findBestMatch('test', [])).toBeNull()
  })
})

describe('jaroWinklerSimilarity', () => {
  it('retourne 1 pour chaînes identiques', () => {
    expect(jaroWinklerSimilarity('hello', 'hello')).toBe(1)
  })

  it('retourne 0 pour chaînes vides', () => {
    expect(jaroWinklerSimilarity('', 'test')).toBe(0)
  })

  it('donne un score élevé pour préfixe commun', () => {
    // Jaro-Winkler favorise les chaînes qui commencent pareil
    const score = jaroWinklerSimilarity('Martha', 'Marhta')
    expect(score).toBeGreaterThan(0.9)
  })

  it('retourne un score entre 0 et 1', () => {
    const score = jaroWinklerSimilarity('abc', 'xyz')
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('est symétrique', () => {
    const score1 = jaroWinklerSimilarity('abc', 'def')
    const score2 = jaroWinklerSimilarity('def', 'abc')
    expect(score1).toBeCloseTo(score2, 5)
  })
})
