import { NextRequest, NextResponse } from 'next/server'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // 1. Vérification des variables d'environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    // Essayer d'abord la clé Service Role (admin), sinon la clé Anon (publique)
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const tmdbApiKey = process.env.TMDB_API_KEY

    console.log('🔧 Vérification configuration:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      usingServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasTmdbKey: !!tmdbApiKey
    })

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Configuration Supabase manquante')
      return NextResponse.json(
        { error: 'Configuration Supabase manquante (URL ou Key)' },
        { status: 500 }
      )
    }

    if (!tmdbApiKey) {
      console.error('❌ Configuration TMDB manquante')
      return NextResponse.json(
        { error: 'Clé API TMDB manquante' },
        { status: 500 }
      )
    }

    // 2. Initialisation du client Supabase
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 3. Lecture du corps de la requête
    const body = await request.json()
    const { mediaId, tmdbId } = body

    console.log(`📥 Requête reçue - mediaId: ${mediaId}, tmdbId: ${tmdbId}`)

    if (!mediaId || !tmdbId) {
      return NextResponse.json(
        { error: 'mediaId et tmdbId sont requis' },
        { status: 400 }
      )
    }

    // 4. Appel API TMDB
    console.log(`🔄 Récupération données TMDB pour ID ${tmdbId}...`)
    const tmdbUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbApiKey}&language=fr-FR&append_to_response=credits`
    
    const tmdbResponse = await fetch(tmdbUrl)
    
    if (!tmdbResponse.ok) {
      console.error(`❌ Erreur TMDB API: ${tmdbResponse.status}`)
      return NextResponse.json(
        { error: `Erreur TMDB: ${tmdbResponse.statusText}` },
        { status: tmdbResponse.status }
      )
    }

    const movieData = await tmdbResponse.json()
    console.log(`📦 Données TMDB reçues pour: ${movieData.title}`)

    // 5. Préparation des données
    const updateData: any = {
      tmdb_id: tmdbId,
      title: movieData.title,
      original_title: movieData.original_title,
      overview: movieData.overview,
      release_date: movieData.release_date,
      year: movieData.release_date ? new Date(movieData.release_date).getFullYear() : null,
      rating: movieData.vote_average,
      poster_url: movieData.poster_path 
        ? `https://image.tmdb.org/t/p/w500${movieData.poster_path}`
        : null,
      backdrop_url: movieData.backdrop_path
        ? `https://image.tmdb.org/t/p/original${movieData.backdrop_path}`
        : null,
      duration: movieData.runtime || null, // 'runtime' dans TMDB -> 'duration' dans Supabase
      genres: movieData.genres?.map((g: any) => g.name) || [],
    }

    if (movieData.credits) {
      if (movieData.credits.cast) {
        // Supabase attend un objet JSON pour movie_cast, pas un tableau de strings
        // On va stocker les acteurs principaux avec leurs infos
        updateData.movie_cast = movieData.credits.cast
          .slice(0, 10)
          .map((actor: any) => ({
            name: actor.name,
            character: actor.character,
            profile_path: actor.profile_path
          }))
      }
      if (movieData.credits.crew) {
        const director = movieData.credits.crew.find((person: any) => person.job === 'Director')
        if (director) {
          // Supabase attend un objet JSON pour director
          updateData.director = {
            name: director.name,
            profile_path: director.profile_path
          }
        }
      }
    }

    // 6. Mise à jour Supabase
    console.log(`💾 Mise à jour Supabase pour media ID: ${mediaId}...`)
    
    const { data, error } = await supabase
      .from('media')
      .update(updateData)
      .eq('id', mediaId)
      .select()
      .single()

    if (error) {
      console.error('❌ Erreur Supabase:', error)
      return NextResponse.json(
        { error: `Erreur BDD: ${error.message}`, details: error },
        { status: 500 }
      )
    }

    console.log(`✅ Mise à jour réussie pour "${movieData.title}"`)

    return NextResponse.json({
      success: true,
      media: data
    })

  } catch (error: any) {
    console.error('❌ Exception non gérée:', error)
    return NextResponse.json(
      { 
        error: 'Erreur serveur interne',
        message: error.message,
        stack: error.stack 
      },
      { status: 500 }
    )
  }
}
