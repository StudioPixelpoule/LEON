/**
 * Système de classification intelligent des genres
 * Attribue chaque film à maximum 2 catégories pertinentes
 */

// Hiérarchie et priorités des genres
const GENRE_PRIORITY: Record<string, number> = {
  // Genres très spécifiques (haute priorité)
  'Animation': 10,
  'Documentary': 10,
  'Western': 9,
  'War': 9,
  'Musical': 9,
  'Horror': 8,
  
  // Genres spécifiques moyens
  'Science Fiction': 7,
  'Fantasy': 7,
  'Crime': 6,
  'Mystery': 6,
  
  // Genres larges (basse priorité)
  'Action': 5,
  'Adventure': 5,
  'Thriller': 4,
  'Comedy': 4,
  'Drama': 3,
  'Romance': 3,
  
  // Genres très génériques (à éviter comme principal)
  'Family': 2,
  'History': 2,
  'Music': 1,
}

// Genres incompatibles (ne peuvent pas être ensemble)
const INCOMPATIBLE_GENRES: Record<string, string[]> = {
  'Animation': ['Horror', 'War', 'Crime'],
  'Horror': ['Animation', 'Comedy', 'Romance'],
  'Comedy': ['Horror', 'War'],
  'Documentary': ['Animation', 'Fantasy', 'Science Fiction'],
  'Western': ['Science Fiction', 'Animation'],
}

// Genres complémentaires (vont bien ensemble)
const COMPLEMENTARY_GENRES: Record<string, string[]> = {
  'Action': ['Adventure', 'Thriller', 'Science Fiction'],
  'Science Fiction': ['Action', 'Adventure', 'Thriller'],
  'Fantasy': ['Adventure', 'Action'],
  'Crime': ['Thriller', 'Drama', 'Mystery'],
  'Comedy': ['Romance', 'Adventure', 'Family'],
  'Drama': ['Crime', 'Romance', 'History'],
  'Horror': ['Thriller', 'Mystery'],
  'Romance': ['Comedy', 'Drama'],
  'War': ['Drama', 'History', 'Action'],
  'Western': ['Action', 'Drama'],
  'Animation': ['Adventure', 'Comedy', 'Family'],
}

interface GenreClassification {
  primary: string
  secondary?: string
  allGenres: string[]
}

/**
 * Détermine les 2 genres les plus pertinents pour un film
 */
export function classifyMovieGenres(genres: string[] | null): GenreClassification {
  if (!genres || genres.length === 0) {
    return {
      primary: 'Autres',
      allGenres: []
    }
  }
  
  // Si un seul genre, c'est simple
  if (genres.length === 1) {
    return {
      primary: genres[0],
      allGenres: genres
    }
  }
  
  // Trier les genres par priorité
  const sortedGenres = [...genres].sort((a, b) => {
    const priorityA = GENRE_PRIORITY[a] || 0
    const priorityB = GENRE_PRIORITY[b] || 0
    return priorityB - priorityA
  })
  
  const primary = sortedGenres[0]
  
  // Chercher le meilleur genre secondaire
  let secondary: string | undefined
  
  for (const genre of sortedGenres.slice(1)) {
    // Vérifier si compatible
    const incompatible = INCOMPATIBLE_GENRES[primary]?.includes(genre) ||
                        INCOMPATIBLE_GENRES[genre]?.includes(primary)
    
    if (!incompatible) {
      // Préférer les genres complémentaires
      const isComplementary = COMPLEMENTARY_GENRES[primary]?.includes(genre) ||
                              COMPLEMENTARY_GENRES[genre]?.includes(primary)
      
      if (isComplementary) {
        secondary = genre
        break
      }
      
      // Sinon, prendre le premier compatible avec une priorité décente
      if (!secondary && (GENRE_PRIORITY[genre] || 0) >= 4) {
        secondary = genre
      }
    }
  }
  
  return {
    primary,
    secondary,
    allGenres: genres
  }
}

/**
 * Normalise les noms de genres (traductions françaises)
 */
export const GENRE_LABELS: Record<string, string> = {
  'Action': 'Action',
  'Adventure': 'Aventure',
  'Animation': 'Animation',
  'Comedy': 'Comédie',
  'Crime': 'Policier',
  'Documentary': 'Documentaire',
  'Drama': 'Drame',
  'Family': 'Famille',
  'Fantasy': 'Fantasy',
  'History': 'Histoire',
  'Horror': 'Horreur',
  'Music': 'Musique',
  'Mystery': 'Mystère',
  'Romance': 'Romance',
  'Science Fiction': 'Science-Fiction',
  'TV Movie': 'Téléfilm',
  'Thriller': 'Thriller',
  'War': 'Guerre',
  'Western': 'Western',
}

export function getGenreLabel(genre: string): string {
  return GENRE_LABELS[genre] || genre
}

/**
 * Regroupe les films par leurs catégories primaires et secondaires
 */
export function groupMoviesByCategories<T extends { genres: string[] | null }>(
  movies: T[]
): Record<string, T[]> {
  const groups: Record<string, Set<T>> = {}
  
  movies.forEach(movie => {
    const classification = classifyMovieGenres(movie.genres)
    
    // Ajouter au groupe primaire
    if (!groups[classification.primary]) {
      groups[classification.primary] = new Set()
    }
    groups[classification.primary].add(movie)
    
    // Ajouter au groupe secondaire si pertinent
    if (classification.secondary) {
      if (!groups[classification.secondary]) {
        groups[classification.secondary] = new Set()
      }
      groups[classification.secondary].add(movie)
    }
  })
  
  // Convertir les Sets en Arrays et trier par nombre de films
  const result: Record<string, T[]> = {}
  Object.entries(groups).forEach(([genre, moviesSet]) => {
    result[genre] = Array.from(moviesSet)
  })
  
  return result
}

/**
 * Sélectionne les meilleures catégories à afficher (les plus fournies)
 */
export function selectTopCategories(
  groupedMovies: Record<string, any[]>,
  maxCategories: number = 6
): Array<{ genre: string; movies: any[] }> {
  return Object.entries(groupedMovies)
    .filter(([_, movies]) => movies.length >= 3) // Au moins 3 films par catégorie
    .sort((a, b) => {
      // Trier par priorité du genre d'abord, puis par nombre de films
      const priorityA = GENRE_PRIORITY[a[0]] || 0
      const priorityB = GENRE_PRIORITY[b[0]] || 0
      
      if (Math.abs(priorityA - priorityB) > 2) {
        return priorityB - priorityA
      }
      
      return b[1].length - a[1].length
    })
    .slice(0, maxCategories)
    .map(([genre, movies]) => ({
      genre: getGenreLabel(genre),
      originalGenre: genre,
      movies: movies.slice(0, 40) // Augmenté à 40 films par rangée
    }))
}

