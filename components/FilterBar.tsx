/**
 * Barre de filtres minimaliste
 * Boutons avec animation translateY(-2px) au hover
 */

'use client'

type FilterBarProps = {
  activeFilter: string
  onFilterChange: (filter: string) => void
  filters?: Array<{ id: string; label: string }>
}

export default function FilterBar({ 
  activeFilter, 
  onFilterChange,
  filters = [
    { id: 'all', label: 'Tout' },
    { id: 'movies', label: 'Films' },
    { id: 'series', label: 'Séries' }
  ]
}: FilterBarProps) {
  return (
    <div className="filters">
      {filters.map((filter) => (
        <button
          key={filter.id}
          className={`filterButton ${activeFilter === filter.id ? 'active' : ''}`}
          onClick={() => onFilterChange(filter.id)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  )
}




