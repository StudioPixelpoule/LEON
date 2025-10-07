/**
 * Cache d'apprentissage pour les correspondances manuelles
 * Permet au système d'apprendre des corrections utilisateur
 */

import { supabase } from '@/lib/supabase';

export interface ManualMatch {
  filename: string;
  tmdbId: number;
  title: string;
  year: number;
  posterPath: string;
  createdAt: Date;
  userId?: string;
}

/**
 * Récupère une correspondance manuelle depuis le cache
 */
export async function getManualMatch(filename: string): Promise<ManualMatch | null> {
  try {
    const { data, error } = await supabase
      .from('manual_matches')
      .select('*')
      .eq('filename', filename)
      .single();
    
    if (error || !data) return null;
    
    return {
      filename: data.filename,
      tmdbId: data.tmdb_id,
      title: data.title,
      year: data.year,
      posterPath: data.poster_path,
      createdAt: new Date(data.created_at),
      userId: data.user_id
    };
  } catch (error) {
    console.error('Erreur récupération manual match:', error);
    return null;
  }
}

/**
 * Sauvegarde une correspondance manuelle
 */
export async function saveManualMatch(match: Omit<ManualMatch, 'createdAt'>): Promise<void> {
  try {
    await supabase
      .from('manual_matches')
      .upsert({
        filename: match.filename,
        tmdb_id: match.tmdbId,
        title: match.title,
        year: match.year,
        poster_path: match.posterPath,
        user_id: match.userId,
        updated_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Erreur sauvegarde manual match:', error);
    throw error;
  }
}

/**
 * Récupère les patterns de nommage appris
 */
export async function getLearnedPatterns(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase
      .from('manual_matches')
      .select('filename, title')
      .limit(100)
      .order('updated_at', { ascending: false });
    
    if (!data) return {};
    
    // Analyser les patterns pour améliorer la reconnaissance future
    const patterns: Record<string, string> = {};
    
    data.forEach(match => {
      // Extraire les patterns de transformation
      const cleanedFile = match.filename
        .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i, '')
        .toLowerCase();
      const cleanedTitle = match.title.toLowerCase();
      
      // Sauvegarder les transformations communes
      if (cleanedFile !== cleanedTitle) {
        patterns[cleanedFile] = cleanedTitle;
      }
    });
    
    return patterns;
  } catch (error) {
    console.error('Erreur récupération patterns:', error);
    return {};
  }
}

/**
 * Supprime une correspondance manuelle
 */
export async function deleteManualMatch(filename: string): Promise<void> {
  try {
    await supabase
      .from('manual_matches')
      .delete()
      .eq('filename', filename);
  } catch (error) {
    console.error('Erreur suppression manual match:', error);
    throw error;
  }
}

/**
 * Récupère toutes les correspondances manuelles pour statistiques
 */
export async function getAllManualMatches(userId?: string): Promise<ManualMatch[]> {
  try {
    let query = supabase
      .from('manual_matches')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error || !data) return [];
    
    return data.map(item => ({
      filename: item.filename,
      tmdbId: item.tmdb_id,
      title: item.title,
      year: item.year,
      posterPath: item.poster_path,
      createdAt: new Date(item.created_at),
      userId: item.user_id
    }));
  } catch (error) {
    console.error('Erreur récupération all matches:', error);
    return [];
  }
}




