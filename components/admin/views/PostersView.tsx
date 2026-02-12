'use client'

import {
  RefreshCw,
  Film,
  Tv,
  X,
  Filter,
  Search,
  Check
} from 'lucide-react'
import styles from '@/app/admin/admin.module.css'
import { usePostersData } from '@/components/admin/hooks/usePostersData'
import { usePosterUpdate } from '@/components/admin/hooks/usePosterUpdate'
import { PosterEditModal } from '@/components/admin/components/PosterEditModal'
import { PostersGrid } from '@/components/admin/components/PostersGrid'

// ============================================
// COMPONENT
// ============================================

export function PostersView() {
  const postersData = usePostersData()
  const posterUpdate = usePosterUpdate({
    loadMovies: postersData.loadMovies,
    loadSeries: postersData.loadSeries,
  })

  const {
    loading, mediaTab, setMediaTab, posterFilter, setPosterFilter,
    searchFilter, setSearchFilter, allMovies, filteredMovies,
    allSeries, filteredSeries, toValidateMovies, toValidateSeries,
  } = postersData

  const {
    selectedMovie, setSelectedMovie, selectedSeries, setSelectedSeries,
    suggestions, searchQuery, setSearchQuery, searching, saving,
    searchTMDB, updatePoster, closeModal,
  } = posterUpdate

  if (loading) {
    return (
      <div className={styles.section}>
        <div className={styles.loading}>
          <RefreshCw size={32} className={styles.spin} />
          <p className={styles.loadingText}>Chargement...</p>
        </div>
      </div>
    )
  }

  const showEmptyValidation = posterFilter === 'to-validate' && (
    (mediaTab === 'films' && filteredMovies.length === 0) ||
    (mediaTab === 'series' && filteredSeries.length === 0)
  )

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.sectionTitle}>Gestion des affiches</h1>
          <p className={styles.sectionDesc}>
            Valider ou modifier les affiches de vos médias
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${mediaTab === 'films' ? styles.active : ''}`}
          onClick={() => setMediaTab('films')}
        >
          <Film size={16} />
          Films ({allMovies.length})
          {toValidateMovies > 0 && <span className={styles.tabBadge}>{toValidateMovies}</span>}
        </button>
        <button
          className={`${styles.tab} ${mediaTab === 'series' ? styles.active : ''}`}
          onClick={() => setMediaTab('series')}
        >
          <Tv size={16} />
          Séries ({allSeries.length})
          {toValidateSeries > 0 && <span className={styles.tabBadge}>{toValidateSeries}</span>}
        </button>
      </div>

      {/* Filtres */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <button
            className={`${styles.filterBtn} ${posterFilter === 'to-validate' ? styles.active : ''}`}
            onClick={() => setPosterFilter('to-validate')}
          >
            <X size={14} />
            À valider ({mediaTab === 'films' ? toValidateMovies : toValidateSeries})
          </button>
          <button
            className={`${styles.filterBtn} ${posterFilter === 'all' ? styles.active : ''}`}
            onClick={() => setPosterFilter('all')}
          >
            <Filter size={14} />
            Tous
          </button>
        </div>
        
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder={mediaTab === 'films' ? "Rechercher un film..." : "Rechercher une série..."}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className={styles.searchInput}
          />
          {searchFilter && (
            <button onClick={() => setSearchFilter('')} className={styles.searchClear}>
              <X size={14} />
            </button>
          )}
        </div>
        
        <span className={styles.filterCount}>
          {mediaTab === 'films'
            ? `${filteredMovies.length} film${filteredMovies.length > 1 ? 's' : ''}`
            : `${filteredSeries.length} série${filteredSeries.length > 1 ? 's' : ''}`
          }
        </span>
      </div>

      {/* Message si rien à valider */}
      {showEmptyValidation && (
        <div className={styles.success}>
          <Check size={48} color="#10b981" />
          <h3 className={styles.successTitle}>
            {mediaTab === 'films' ? 'Tous les films sont validés !' : 'Toutes les séries sont validées !'}
          </h3>
          <p className={styles.successText}>
            Aucune affiche n&apos;a besoin de validation.
          </p>
        </div>
      )}

      {/* Grille */}
      <PostersGrid
        type={mediaTab}
        movies={filteredMovies}
        series={filteredSeries}
        onSelectMovie={(movie) => {
          setSelectedMovie(movie)
          setSearchQuery(movie.title)
        }}
        onSelectSeries={(series) => {
          setSelectedSeries(series)
          setSearchQuery(series.title)
        }}
      />

      {/* Modal film */}
      {selectedMovie && (
        <PosterEditModal
          type="movie"
          title={selectedMovie.title}
          year={selectedMovie.year}
          posterUrl={selectedMovie.poster_url}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          suggestions={suggestions}
          searching={searching}
          saving={saving}
          onSearch={() => searchTMDB('movie')}
          onSelect={(tmdbId) => updatePoster(tmdbId, 'movie')}
          onClose={closeModal}
        />
      )}

      {/* Modal série */}
      {selectedSeries && (
        <PosterEditModal
          type="series"
          title={selectedSeries.title}
          year={selectedSeries.first_air_date
            ? new Date(selectedSeries.first_air_date).getFullYear()
            : undefined
          }
          posterUrl={selectedSeries.poster_url}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          suggestions={suggestions}
          searching={searching}
          saving={saving}
          onSearch={() => searchTMDB('tv')}
          onSelect={(tmdbId) => updatePoster(tmdbId, 'series')}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
