# LEON - Structure Netflix + Minimalisme Pixel Poule

**Date:** 6 octobre 2025  
**Auteur:** Pixel Poule

---

## 🎯 Vision

Fusionner **l'expérience utilisateur Netflix** (navigation immersive, découverte visuelle) avec **l'esthétique minimaliste Pixel Poule** (noir/blanc/gris, typographie épurée, animations subtiles).

---

## 🎨 Design System (Inchangé)

✅ **Palette:** Noir, blanc, gris uniquement (du document `GRAPHICS_MINIMALISME.md`)  
✅ **Typographie:** Nunito (3 poids: 200, 500, 800)  
✅ **Animations:** Subtiles (150-200ms max, transformations géométriques uniquement)  
✅ **Espacements:** Variables CSS (`spacing-xs` à `spacing-xl`)

---

## 📐 Structure Netflix

### Page d'Accueil

```
┌────────────────────────────────────────────────────┐
│ Header: [LEON]         [Recherche]         [Admin] │  ← Fixe en haut
├────────────────────────────────────────────────────┤
│                                                     │
│  🎬 Film Héros (backdrop full width)               │  ← Hero Section
│     [Titre + Synopsis + ▶ Lire]                    │     (Film aléatoire chaque visite)
│                                                     │
├────────────────────────────────────────────────────┤
│                                                     │
│  Derniers ajoutés                                  │  ← Rangée scrollable horizontale
│  [🎬][🎬][🎬][🎬][🎬][🎬][🎬]                      │     (Posters verticaux 2:3)
│                                                     │
│  Films populaires                                  │  ← Rangée scrollable
│  [🎬][🎬][🎬][🎬][🎬][🎬][🎬]                      │
│                                                     │
│  Action                                            │  ← Rangée scrollable par genre
│  [🎬][🎬][🎬][🎬][🎬][🎬][🎬]                      │
│                                                     │
│  Drame                                             │
│  [🎬][🎬][🎬][🎬][🎬][🎬][🎬]                      │
│                                                     │
│  [Voir toute la bibliothèque]                      │  ← Lien vers grille complète
│                                                     │
└────────────────────────────────────────────────────┘
```

### Page Détail Film (Inchangé)

Conserver la structure actuelle avec:
- Header LEON + logo cliquable
- Hero avec backdrop flou
- Poster + infos + bouton ▶ Lire
- Casting + trailer

### Page Bibliothèque Complète

```
┌────────────────────────────────────────────────────┐
│ Header: [LEON]         [Recherche]         [Admin] │
├────────────────────────────────────────────────────┤
│                                                     │
│  [Tous] [Action] [Drame] [Comédie] [Thriller]      │  ← Filtres genre
│                                                     │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┐      │
│  │ 🎬  │ 🎬  │ 🎬  │ 🎬  │ 🎬  │ 🎬  │      │  ← Grille responsive
│  └──────┴──────┴──────┴──────┴──────┴──────┘      │     (2:3 ratio)
│  ┌──────┬──────┬──────┬──────┬──────┬──────┐      │
│  │ 🎬  │ 🎬  │ 🎬  │ 🎬  │ 🎬  │ 🎬  │      │
│  └──────┴──────┴──────┴──────┴──────┴──────┘      │
│                                                     │
└────────────────────────────────────────────────────┘
```

---

## 🎬 Composants Clés

### 1. Hero Section

**Objectif:** Film vedette en plein écran avec appel à l'action

**Structure:**
```tsx
<section className="hero">
  <Image src={backdropUrl} layout="fill" />  {/* Backdrop full width */}
  <div className="heroOverlay">            {/* Dégradé noir transparent */}
    <div className="heroContent">
      <h1 className="heroTitle">{title}</h1>     {/* 4rem, extrabold */}
      <p className="heroMeta">                   {/* Genre · Année · Durée */}
        {genre} · {year} · {duration}
      </p>
      <p className="heroOverview">{overview}</p>  {/* 3 lignes max */}
      <div className="heroActions">
        <button className="playButton">▶ Lire</button>
        <button className="infoButton">Plus d'infos</button>
      </div>
    </div>
  </div>
</section>
```

**Style:**
```css
.hero {
  position: relative;
  height: 80vh;                        /* 80% hauteur écran */
  background: var(--color-black);
}

.heroOverlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.9) 0%,           /* Noir opaque à gauche */
    rgba(0, 0, 0, 0.4) 50%,          /* Semi-transparent au centre */
    transparent 100%                  /* Transparent à droite */
  );
  display: flex;
  align-items: center;
}

.heroContent {
  max-width: 600px;
  padding: 0 var(--spacing-xl) 0 calc(var(--spacing-xl) * 2);
}

.heroTitle {
  font-size: 4rem;                     /* 64px */
  font-weight: var(--font-weight-bold);
  color: var(--color-white);
  margin-bottom: var(--spacing-md);
  line-height: 1.1;
}

.heroMeta {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-regular);
  color: var(--color-white);
  margin-bottom: var(--spacing-lg);
  opacity: 0.8;
}

.heroOverview {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-thin);
  color: var(--color-white);
  line-height: 1.6;
  margin-bottom: var(--spacing-xl);
  display: -webkit-box;
  -webkit-line-clamp: 3;               /* 3 lignes max */
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.playButton {
  background: var(--color-white);
  color: var(--color-black);
  border: none;
  padding: var(--spacing-md) calc(var(--spacing-xl) * 1.5);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.playButton:hover {
  transform: scale(1.05);              /* Légèrement plus gros */
}

.infoButton {
  background: rgba(255, 255, 255, 0.3);
  color: var(--color-white);
  border: 1px solid var(--color-white);
  padding: var(--spacing-md) var(--spacing-xl);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-regular);
  cursor: pointer;
  margin-left: var(--spacing-md);
  transition: background var(--transition-fast);
}

.infoButton:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Mobile */
@media (max-width: 768px) {
  .hero {
    height: 60vh;
  }
  
  .heroTitle {
    font-size: 2.5rem;                 /* 40px sur mobile */
  }
  
  .heroOverview {
    -webkit-line-clamp: 2;             /* 2 lignes sur mobile */
  }
}
```

---

### 2. Rangée de Films (Horizontal Scroll)

**Objectif:** Liste scrollable horizontale de posters

**Structure:**
```tsx
<section className="movieRow">
  <h2 className="rowTitle">Derniers ajoutés</h2>
  <div className="rowScroll">
    {movies.map(movie => (
      <Link href={`/movie/${movie.id}`} className="movieCard">
        <Image src={movie.poster_url} width={200} height={300} />
        <div className="cardHover">
          <h3 className="cardTitle">{movie.title}</h3>
          <p className="cardMeta">{movie.year} · {movie.rating}/10</p>
        </div>
      </Link>
    ))}
  </div>
</section>
```

**Style:**
```css
.movieRow {
  padding: var(--spacing-xl) calc(var(--spacing-xl) * 2);
}

.rowTitle {
  font-size: var(--font-size-2xl);      /* 32px */
  font-weight: var(--font-weight-bold);
  color: var(--color-black);
  margin-bottom: var(--spacing-lg);
}

.rowScroll {
  display: flex;
  gap: var(--spacing-md);
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  padding-bottom: var(--spacing-md);    /* Espace pour scrollbar */
  
  /* Masquer la scrollbar mais garder le scroll */
  scrollbar-width: thin;
  scrollbar-color: var(--color-gray-300) transparent;
}

.rowScroll::-webkit-scrollbar {
  height: 4px;
}

.rowScroll::-webkit-scrollbar-track {
  background: transparent;
}

.rowScroll::-webkit-scrollbar-thumb {
  background: var(--color-gray-300);
  border-radius: 2px;
}

.movieCard {
  position: relative;
  min-width: 200px;                     /* Largeur fixe */
  height: 300px;                        /* Ratio 2:3 */
  flex-shrink: 0;
  cursor: pointer;
  transition: transform var(--transition-fast);
  overflow: hidden;
}

.movieCard:hover {
  transform: scale(1.05) translateY(-4px);  /* Zoom + soulèvement */
}

.movieCard img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cardHover {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--spacing-md);
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.9),
    transparent
  );
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.movieCard:hover .cardHover {
  opacity: 1;
}

.cardTitle {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-white);
  margin: 0 0 var(--spacing-xs) 0;
  line-height: 1.2;
}

.cardMeta {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-thin);
  color: var(--color-white);
  margin: 0;
  opacity: 0.8;
}

/* Mobile */
@media (max-width: 768px) {
  .movieRow {
    padding: var(--spacing-lg) var(--spacing-md);
  }
  
  .rowTitle {
    font-size: var(--font-size-xl);    /* 24px sur mobile */
  }
  
  .movieCard {
    min-width: 150px;                  /* Plus petit sur mobile */
    height: 225px;
  }
}
```

---

### 3. Header Fixe

**Objectif:** Navigation persistante en haut

**Structure:**
```tsx
<header className="stickyHeader">
  <Link href="/" className="headerLogo">LEON</Link>
  <nav className="headerNav">
    <Link href="/">Accueil</Link>
    <Link href="/library">Bibliothèque</Link>
    <SearchBar />
  </nav>
  <Link href="/admin" className="headerAdmin">Admin</Link>
</header>
```

**Style:**
```css
.stickyHeader {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) calc(var(--spacing-xl) * 2);
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.8),
    transparent
  );
  backdrop-filter: blur(4px);
  transition: background var(--transition-normal);
}

.stickyHeader.scrolled {
  background: rgba(255, 255, 255, 0.95);  /* Fond blanc quand scrollé */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.headerLogo {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-white);           /* Blanc par défaut */
  text-decoration: none;
  transition: transform var(--transition-fast), color var(--transition-normal);
}

.stickyHeader.scrolled .headerLogo {
  color: var(--color-black);           /* Noir quand scrollé */
}

.headerLogo:hover {
  transform: translateY(-2px);
}

.headerNav {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
}

.headerNav a {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-regular);
  color: var(--color-white);
  text-decoration: none;
  transition: color var(--transition-normal);
}

.stickyHeader.scrolled .headerNav a {
  color: var(--color-black);
}

.headerAdmin {
  font-size: var(--font-size-sm);
  color: var(--color-white);
  text-decoration: none;
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-white);
  transition: all var(--transition-fast);
}

.headerAdmin:hover {
  background: var(--color-white);
  color: var(--color-black);
}

.stickyHeader.scrolled .headerAdmin {
  color: var(--color-black);
  border-color: var(--color-black);
}

.stickyHeader.scrolled .headerAdmin:hover {
  background: var(--color-black);
  color: var(--color-white);
}

/* Mobile */
@media (max-width: 768px) {
  .stickyHeader {
    padding: var(--spacing-sm) var(--spacing-md);
  }
  
  .headerNav {
    display: none;                      /* Masquer nav sur mobile */
  }
}
```

---

## 🔄 Migration Progressive

### Phase 1: Hero Section (Prioritaire)
1. Créer composant `HeroSection.tsx`
2. Sélectionner un film aléatoire chaque chargement
3. Afficher backdrop + infos + bouton ▶ Lire

### Phase 2: Rangées Horizontales
1. Créer composant `MovieRow.tsx`
2. Implémenter scroll horizontal
3. Grouper par catégories (Derniers, Populaires, Genres)

### Phase 3: Header Fixe
1. Rendre header sticky
2. Effet de transparence → opaque au scroll
3. Changement de couleur (blanc → noir)

### Phase 4: Page Bibliothèque
1. Nouvelle route `/library`
2. Grille complète avec filtres genre
3. Garder le design actuel pour les cartes

---

## ✅ Checklist Minimalisme (Conservé)

- ✅ Couleurs noir/blanc/gris uniquement
- ✅ Typographie Nunito (3 poids)
- ✅ Animations < 200ms
- ✅ Transformations géométriques au hover
- ✅ Pas de changement de couleur au hover (sauf boutons)
- ✅ Espacements généreux
- ✅ Contrastes WCAG AA

---

## 🎯 Résultat Final

**UX Netflix** : Navigation immersive, découverte visuelle, hero captivant  
**Esthétique Pixel Poule** : Minimalisme radical, typographie épurée, animations subtiles

**Le meilleur des deux mondes** ! 🎬✨

---

**Créé par Pixel Poule**  
*L'élégance Netflix rencontre le minimalisme radical.*


