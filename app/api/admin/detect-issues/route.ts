/**
 * API Admin: Détection automatique des problèmes
 * GET /api/admin/detect-issues
 * 
 * Scanne tous les films et détecte :
 * - Jaquettes manquantes
 * - Duplicatas (même TMDB ID)
 * - Métadonnées incohérentes
 * - Films probablement mal identifiés
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'

interface Issue {
  id: string
  media_id: string
  type: 'no_poster' | 'duplicate' | 'suspicious_match' | 'no_tmdb'
  severity: 'high' | 'medium' | 'low'
  title: string
  year: number | null
  poster_url: string | null
  pcloud_fileid: string
  details: string
  suggested_action: string
}

export async function GET(request: NextRequest) {
  // Vérification admin OBLIGATOIRE
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

  try {
    const issues: Issue[] = []
    
    // Récupérer tous les films
    const { data: allMedia, error } = await supabase
      .from('media')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('❌ Erreur récupération médias:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des médias' },
        { status: 500 }
      )
    }
    
    if (!allMedia || allMedia.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        issues: [],
        summary: {
          total: 0,
          no_poster: 0,
          duplicates: 0,
          suspicious: 0,
          no_tmdb: 0
        }
      })
    }
    
    // 1. Détecter les films sans TMDB ID
    const noTmdb = allMedia.filter(m => !m.tmdb_id)
    noTmdb.forEach(media => {
      issues.push({
        id: `no_tmdb_${media.id}`,
        media_id: media.id,
        type: 'no_tmdb',
        severity: 'high',
        title: media.title,
        year: media.year,
        poster_url: media.poster_url,
        pcloud_fileid: media.pcloud_fileid,
        details: 'Film non identifié sur TMDB',
        suggested_action: 'Rechercher manuellement sur TMDB ou uploader une jaquette'
      })
    })
    
    // 2. Détecter les films sans poster (ou avec placeholder)
    const noPoster = allMedia.filter(m => 
      !m.poster_url || 
      m.poster_url === '/placeholder-poster.png' ||
      m.poster_url.includes('placeholder')
    )
    noPoster.forEach(media => {
      issues.push({
        id: `no_poster_${media.id}`,
        media_id: media.id,
        type: 'no_poster',
        severity: 'medium',
        title: media.title,
        year: media.year,
        poster_url: media.poster_url,
        pcloud_fileid: media.pcloud_fileid,
        details: 'Jaquette manquante ou placeholder',
        suggested_action: 'Rechercher une jaquette sur TMDB/OMDb ou uploader manuellement'
      })
    })
    
    // 3. Détecter les duplicatas (même tmdb_id)
    const tmdbGroups = allMedia
      .filter(m => m.tmdb_id)
      .reduce((acc, media) => {
        const key = media.tmdb_id!
        if (!acc[key]) acc[key] = []
        acc[key].push(media)
        return acc
      }, {} as Record<number, any[]>)
    
    for (const tmdbId of Object.keys(tmdbGroups)) {
      const medias = tmdbGroups[parseInt(tmdbId)]
      if (medias && medias.length > 1) {
        medias.forEach((media: any, index: number) => {
          issues.push({
            id: `duplicate_${media.id}`,
            media_id: media.id,
            type: 'duplicate',
            severity: 'medium',
            title: media.title,
            year: media.year,
            poster_url: media.poster_url,
            pcloud_fileid: media.pcloud_fileid,
            details: `Film en double (${medias.length} exemplaires du même film)`,
            suggested_action: index === 0 ? 'Garder celui-ci et supprimer les autres' : 'Supprimer ce doublon'
          })
        })
      }
    }
    
    // 4. Détecter les matchs suspects (nom de fichier très différent du titre)
    const suspiciousMatches = allMedia
      .filter(m => m.tmdb_id && m.pcloud_fileid)
      .filter(media => {
        const filename = media.pcloud_fileid.toLowerCase()
        const title = media.title.toLowerCase()
        
        // Extraire le nom du fichier sans extension
        const filenameClean = filename
          .replace(/\.[^/.]+$/, '') // Enlever extension
          .replace(/[._-]/g, ' ') // Remplacer séparateurs
          .replace(/\d{4}/g, '') // Enlever années
          .trim()
        
        // Vérifier si les mots du titre sont dans le nom de fichier
        const titleWords = title.split(/\s+/).filter((w: string) => w.length > 3)
        const matchingWords = titleWords.filter((word: string) => 
          filenameClean.includes(word.toLowerCase())
        )
        
        // Suspect si moins de 30% des mots du titre sont dans le filename
        return titleWords.length > 0 && (matchingWords.length / titleWords.length) < 0.3
      })
    
    suspiciousMatches.forEach(media => {
      issues.push({
        id: `suspicious_${media.id}`,
        media_id: media.id,
        type: 'suspicious_match',
        severity: 'low',
        title: media.title,
        year: media.year,
        poster_url: media.poster_url,
        pcloud_fileid: media.pcloud_fileid,
        details: 'Le nom du fichier ne correspond pas au titre identifié',
        suggested_action: 'Vérifier que le film identifié est correct'
      })
    })
    
    // Résumé
    const summary = {
      total: issues.length,
      no_poster: issues.filter(i => i.type === 'no_poster').length,
      duplicates: issues.filter(i => i.type === 'duplicate').length,
      suspicious: issues.filter(i => i.type === 'suspicious_match').length,
      no_tmdb: issues.filter(i => i.type === 'no_tmdb').length
    }
    
    // Trier par sévérité (high > medium > low)
    const severityOrder = { high: 0, medium: 1, low: 2 }
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    
    console.log(`✅ ${issues.length} problèmes détectés`)
    console.log(`   - ${summary.no_tmdb} sans TMDB`)
    console.log(`   - ${summary.no_poster} sans jaquette`)
    console.log(`   - ${summary.duplicates} duplicatas`)
    console.log(`   - ${summary.suspicious} matchs suspects`)
    
    return NextResponse.json({
      success: true,
      count: issues.length,
      issues,
      summary
    })
    
  } catch (error) {
    console.error('❌ Erreur détection problèmes:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la détection des problèmes' },
      { status: 500 }
    )
  }
}




