/**
 * Page détail d'un film avec métadonnées TMDB complètes
 * Hero avec backdrop flou + informations enrichies
 */

import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEnrichedMovie } from '@/lib/media-processing/metadataProcessor'
import styles from './page.module.css'
import PlayButton from './PlayButton'

type PageProps = {
  params: {
    id: string
  }
}

export default async function MovieDetailPage({ params }: PageProps) {
  const movie = await getEnrichedMovie(params.id)
  
  if (!movie) {
    notFound()
  }
  
  const backdropUrl = movie.backdrop_url || movie.poster_url || '/placeholder-backdrop.png'
  const posterUrl = movie.poster_url || '/placeholder-poster.png'
  
  // Parse du casting depuis JSONB
  const cast = movie.movie_cast ? 
    (Array.isArray(movie.movie_cast) ? movie.movie_cast : []) : 
    []
  
  return (
    <div className={styles.container}>
      {/* Header simple avec logo */}
      <header className="header">
        <Link href="/" className="logo">LEON</Link>
        <div style={{ width: '400px' }}></div> {/* Espace vide pour garder l'alignement */}
      </header>
      
      {/* Hero avec backdrop flou */}
      <div className={styles.hero}>
        {backdropUrl && (
          <div className={styles.backdrop}>
            <Image
              src={backdropUrl}
              alt=""
              fill
              style={{ objectFit: 'cover' }}
              priority
              unoptimized
            />
            <div className={styles.backdropOverlay} />
          </div>
        )}
        
        <div className={styles.heroContent}>
          {/* Poster */}
          <div className={styles.posterContainer}>
            <Image
              src={posterUrl}
              alt={movie.title}
              width={300}
              height={450}
              className={styles.poster}
              priority
              unoptimized
            />
          </div>
          
          {/* Informations principales */}
          <div className={styles.mainInfo}>
            <h1 className={styles.title}>{movie.title}</h1>
            
            {movie.original_title && movie.original_title !== movie.title && (
              <p className={styles.originalTitle}>{movie.original_title}</p>
            )}
            
            {movie.tagline && (
              <p className={styles.tagline}>&quot;{movie.tagline}&quot;</p>
            )}
            
            {/* Métadonnées */}
            <div className={styles.metadata}>
              {movie.year && <span>{movie.year}</span>}
              {movie.formatted_runtime && (
                <>
                  <span className={styles.separator}>·</span>
                  <span>{movie.formatted_runtime}</span>
                </>
              )}
              {movie.genres && movie.genres.length > 0 && (
                <>
                  <span className={styles.separator}>·</span>
                  <span>{movie.genres.slice(0, 3).join(', ')}</span>
                </>
              )}
            </div>
            
            {/* Note TMDB */}
            {movie.rating > 0 && (
              <div className={styles.rating}>
                <span className={styles.ratingValue}>{movie.rating}/10</span>
                <span className={styles.ratingCount}>
                  ({movie.vote_count?.toLocaleString() || 0} votes)
                </span>
              </div>
            )}
            
            {/* Réalisateur */}
            {movie.director && 
             typeof movie.director === 'object' && 
             movie.director !== null &&
             'name' in movie.director &&
             movie.director.name && (
              <div className={styles.director}>
                <span className={styles.label}>Réalisation :</span>
                <span className={styles.value}>{String(movie.director.name)}</span>
              </div>
            )}
            
            {/* Synopsis */}
            {movie.overview && (
              <div className={styles.overview}>
                <h2 className={styles.sectionTitle}>Synopsis</h2>
                <p className={styles.overviewText}>{movie.overview}</p>
              </div>
            )}
            
            {/* Actions */}
            <div className={styles.actions}>
              <PlayButton 
                filepath={movie.pcloud_fileid}
                title={movie.title}
                quality={movie.quality}
                fileSize={movie.file_size}
              />
            </div>
            
            {/* Sous-titres */}
            {movie.subtitles && Object.keys(movie.subtitles).length > 0 && (
              <div className={styles.subtitles}>
                <label className={styles.subtitlesLabel}>Sous-titres :</label>
                <select className={styles.select}>
                  <option>Aucun</option>
                  {Object.entries(movie.subtitles).map(([lang, file]: [string, any]) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Section Casting */}
      {cast.length > 0 && (
        <section className={styles.castSection}>
          <h2 className={styles.sectionTitle}>Distribution</h2>
          <div className={styles.castGrid}>
            {cast.map((actor: any, index: number) => (
              <div key={index} className={styles.castCard}>
                {actor.profileUrl ? (
                  <div className={styles.actorPhoto}>
                    <Image
                      src={actor.profileUrl}
                      alt={actor.name}
                      width={80}
                      height={120}
                      style={{ objectFit: 'cover' }}
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className={styles.actorPhotoPlaceholder}>
                    <span>{actor.name.charAt(0)}</span>
                  </div>
                )}
                <div className={styles.actorInfo}>
                  <p className={styles.actorName}>{actor.name}</p>
                  <p className={styles.characterName}>{actor.character}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      
      {/* Bande-annonce (si disponible) */}
      {movie.trailer_url && (
        <section className={styles.trailerSection}>
          <h2 className={styles.sectionTitle}>Bande-annonce</h2>
          <a 
            href={movie.trailer_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.trailerLink}
          >
            Voir sur YouTube
          </a>
        </section>
      )}
    </div>
  )
}

