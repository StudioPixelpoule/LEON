# GRAPHICS MINIMALISME - Design System Pixel Poule

**Version:** 1.0  
**Création:** 3 octobre 2024  
**Auteur:** Pixel Poule  
**Usage:** Référence graphique réutilisable pour créer des interfaces minimalistes

---

## 🎨 Philosophie de Design

### Principes Fondamentaux

**MINIMALISME RADICAL**

L'interface est une toile blanche où chaque élément a sa raison d'être. Rien de superflu, rien de décoratif. L'information et l'action sont au centre.

**HIÉRARCHIE PAR LA TYPOGRAPHIE**

La typographie n'est pas un habillage, c'est **l'élément de design principal**. Les tailles, les poids, les espacements créent toute la hiérarchie visuelle.

**ÉLÉGANCE PAR LA CONTRAINTE**

- **Palette:** Noir, blanc, niveaux de gris uniquement
- **Exception:** Un seul rouge (#DC2626) pour les alertes destructives
- **Animations:** Subtiles, 150-200ms maximum
- **Transitions:** Uniquement des transformations géométriques (pas de changement de couleur/opacité au hover)

**L'ESPACE COMME MATIÈRE**

Les espaces blancs ne sont pas du vide, ils structurent, ils respirent, ils guident. L'espace est généreux, jamais avare.

---

## 🎨 Palette de Couleurs

### Couleurs Principales

```css
/* Palette noir/blanc/gris exclusive */
--color-black: #000000;          /* Titres, textes importants, bordures, boutons primaires */
--color-white: #FFFFFF;          /* Fond principal, texte sur fond noir */

/* Niveaux de gris (du plus clair au plus foncé) */
--color-gray-100: #F5F5F5;       /* Fonds secondaires très légers */
--color-gray-200: #E5E5E5;       /* Séparateurs discrets */
--color-gray-300: #D4D4D4;       /* Bordures inputs au repos */
--color-gray-400: #A3A3A3;       /* Textes tertiaires */
--color-gray-500: #737373;       /* Textes secondaires */
--color-gray-600: #525252;       /* Textes de support, descriptions */
--color-gray-700: #404040;       /* Textes légèrement appuyés */
--color-gray-800: #262626;       /* Presque noir */
--color-gray-900: #171717;       /* Noir profond */
```

### Couleur d'Accent (Usage Restreint)

```css
--color-red: #DC2626;            /* UNIQUEMENT pour messages de suppression/danger */
```

**Règle absolue:** Jamais d'autres couleurs. Le minimalisme se définit par cette contrainte.

### Application des Couleurs

| Élément | Couleur | Contexte |
|---------|---------|----------|
| Fond principal | `white` | Corps de page, cartes, modales |
| Textes principaux | `black` | Titres, labels, corps de texte |
| Textes secondaires | `gray-600` | Descriptions, métadonnées |
| Textes tertiaires | `gray-400` | Placeholders, informations légères |
| Bordures principales | `black` | Contours modales, séparations importantes |
| Bordures secondaires | `gray-200` à `gray-300` | Lignes de séparation discrètes, inputs |
| Boutons primaires | `black` (fond) + `white` (texte) | Actions principales |
| Boutons secondaires | `transparent` (fond) + `black` (texte) | Actions secondaires |

---

## ✍️ Typographie

### Police Principale : Nunito

**Source:** Google Fonts  
**Variantes utilisées:** 3 poids uniquement

```css
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@200;500;800&display=swap');

font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Poids de Police

```css
--font-weight-thin: 200;         /* Nunito Thin - textes secondaires, descriptions */
--font-weight-regular: 500;      /* Nunito Medium - texte standard (corps) */
--font-weight-bold: 800;         /* Nunito Extrabold - titres, emphase */
```

**Usage des poids:**

- **Thin (200):** Descriptions, sous-textes, explications, métadonnées
- **Medium (500):** Texte principal, paragraphes, labels normaux
- **Extrabold (800):** Titres de sections, noms importants, labels de champs, boutons

### Échelle Typographique

**Système basé sur 4 tailles principales + variations contextuelles:**

```css
/* Échelle de base */
--font-size-base: 1rem;          /* 16px - Texte standard, corps de texte */
--font-size-lg: 1.25rem;         /* 20px - Sous-titres, labels importants */
--font-size-xl: 1.5rem;          /* 24px - Titres de sections */
--font-size-2xl: 2rem;           /* 32px - Titres de modales, éléments de liste */

/* Variations contextuelles */
--font-size-sm: 0.875rem;        /* 14px - Textes secondaires, descriptions */
--font-size-3xl: 3rem;           /* 48px - Noms de composants importants */
--font-size-4xl: 4rem;           /* 64px - Titres de pages détails */
--font-size-5xl: 5rem;           /* 80px - Éléments héros */
--font-size-8xl: 8rem;           /* 128px - Chiffres statistiques */
```

### Hiérarchie Typographique

```
Niveau 1 : Titres héros (éléments centraux)
├─ 5rem (80px) - Extrabold
├─ Usage: Noms d'entités principales dans vues détaillées
└─ Exemple: Nom d'un utilisateur, d'un produit phare

Niveau 2 : Titres de pages
├─ 4rem (64px) - Extrabold
├─ Usage: Titres de fiches détaillées
└─ Exemple: Nom dans une fiche de profil

Niveau 3 : Titres de sections / liste
├─ 2rem (32px) - Extrabold ou Medium (selon contexte)
├─ Usage: Titres de modales, éléments de liste importante
└─ Exemple: "Créer un utilisateur", items dans une navigation

Niveau 4 : Sous-titres
├─ 1.5rem (24px) - Extrabold
├─ Usage: Titres de sous-sections
└─ Exemple: Labels de groupes de champs

Niveau 5 : Labels / Métadonnées importantes
├─ 1.25rem (20px) - Medium ou Extrabold
├─ Usage: Labels de formulaire, métadonnées visibles
└─ Exemple: "Email", "Date de création"

Niveau 6 : Texte standard
├─ 1rem (16px) - Medium
├─ Usage: Corps de texte, paragraphes, inputs
└─ Exemple: Descriptions, contenus longs

Niveau 7 : Texte secondaire
├─ 0.875rem (14px) - Thin, italique
├─ Usage: Descriptions, explications, aide contextuelle
└─ Exemple: "Limite de 1500 caractères"
```

### Interlignage

```css
--line-height-tight: 1.2;        /* Titres, éléments courts */
--line-height-normal: 1.6;       /* Texte standard */
--line-height-relaxed: 1.7;      /* Texte long, paragraphes */
```

**Règle:** Plus le texte est long, plus l'interlignage est généreux (jusqu'à 1.7).

### Alignement de Texte

- **Par défaut:** `left` (toujours pour les interfaces)
- **Exception:** `center` uniquement pour :
  - Messages vides ("Aucun élément")
  - Statistiques/chiffres isolés
  - Titres de pages très courtes (< 10 caractères)
- **Justifié:** Uniquement pour les longs paragraphes (> 200 caractères)

---

## 📏 Espacements & Grille

### Système d'Espacement

**Échelle basée sur `0.5rem` (8px):**

```css
--spacing-xs: 0.5rem;            /* 8px - Espacement minimal, gap label/input */
--spacing-sm: 1rem;              /* 16px - Gap entre éléments proches */
--spacing-md: 1.5rem;            /* 24px - Gap entre sections, padding boutons */
--spacing-lg: 2rem;              /* 32px - Padding de sections */
--spacing-xl: 3rem;              /* 48px - Padding de pages, modales */
```

### Application des Espacements

**Entre Label et Input:**
```css
gap: var(--spacing-xs);          /* 8px */
```

**Entre Champs de Formulaire:**
```css
gap: var(--spacing-md);          /* 24px */
```

**Entre Sections de Contenu:**
```css
gap: calc(var(--spacing-xl) * 2); /* 96px */
```

**Padding de Modales (Header):**
```css
padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-md) var(--spacing-xl);
/* Haut: 48px, Droite: 48px, Bas: 24px, Gauche: 48px */
```

**Padding de Modales (Content):**
```css
padding: var(--spacing-md) var(--spacing-xl) var(--spacing-xl) var(--spacing-xl);
/* Haut: 24px, Droite: 48px, Bas: 48px, Gauche: 48px */
```

**Écart Titre/Contenu de Modale:**
- Créé par `header padding-bottom (spacing-md)` + `content padding-top (spacing-md)`
- Total: **32px** (2x spacing-md)

### Marges Externes

**Autour de l'interface principale:**
- Desktop: Centré avec marges blanches généreuses (min 10% viewport)
- Mobile: Padding réduit à `spacing-md` (24px)

---

## 🎬 Animations & Transitions

### Timing

```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-normal: 200ms cubic-bezier(0.4, 0, 0.2, 1);
```

**Règle absolue:** Jamais plus de 200ms pour une micro-interaction.

### Animations Standard par Type d'Élément

#### Boutons & Éléments Cliquables (Standard)

```css
.element {
  transition: transform var(--transition-fast);
}

.element:hover {
  transform: translateY(-2px);   /* Soulèvement de 2px */
}

.element:active {
  transform: translateY(0);      /* Retour position initiale */
}
```

**Usage:** Boutons d'action, cartes cliquables, icônes d'action

#### Items de Liste

```css
.listItem {
  transition: transform var(--transition-fast);
}

.listItem:hover {
  transform: translateX(4px);    /* Décalage à droite de 4px */
}

.listItem:active {
  transform: translateX(0);
}
```

**Usage:** Listes de navigation, éléments de menu

#### Icônes Seules (Rare)

```css
.icon {
  transition: transform var(--transition-fast);
}

.icon:hover {
  transform: scale(1.1);         /* Agrandissement de 10% */
}

.icon:active {
  transform: scale(1);
}
```

**Usage:** Icônes isolées sans texte (trash, settings)

### Animations Complexes

#### Ouverture de Modale

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.backdrop {
  animation: fadeIn var(--transition-fast) ease-out;
}

.modal {
  animation: slideUp var(--transition-normal) cubic-bezier(0.4, 0, 0.2, 1);
}
```

#### Compteur Animé (Chiffres)

```tsx
// Ease-out exponential pour fluidité maximale
const easeOutExpo = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

// Durée: 2000ms
// Interpolation: Math.round() pour progression fluide
```

**Effet:** Compteur qui démarre vite et ralentit doucement jusqu'à la valeur finale.

### Règles d'Animation

**✅ À FAIRE:**
- Transformations géométriques uniquement (`translate`, `scale`)
- Transitions subtiles (< 200ms)
- Animations significatives (feedback visuel utile)

**❌ À NE JAMAIS FAIRE:**
- Changement de couleur au hover
- Changement d'opacité au hover (sauf cas très spécifique)
- Animations gratuites sans but fonctionnel
- Animations > 200ms (sauf cas exceptionnels comme compteurs)

---

## 🧩 Composants UI

### Modales

**Anatomie d'une modale minimaliste:**

```
┌─────────────────────────────────────────┐
│ [Backdrop flou rgba(255,255,255,0.3)]  │
│   blur(6px)                             │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Titre (2rem, extrabold)      [×] │ │  ← Header (padding-bottom: md)
│  │                                   │ │
│  ├───────────────────────────────────┤ │  ← Séparation invisible (spacing-md x2)
│  │                                   │ │
│  │ Contenu de la modale              │ │  ← Content (padding-top: md)
│  │ Formulaire, texte, etc.           │ │
│  │                                   │ │
│  │ [Annuler]         [Action]        │ │  ← Actions
│  └───────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

**Styles CSS:**

```css
.backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 150ms ease-out;
}

.modal {
  background-color: rgba(255, 255, 255, 0.65);  /* Semi-transparent */
  border: 1px solid var(--color-black);         /* Contour fin noir */
  max-width: 600px;
  width: 90%;
  animation: slideUp 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-md) var(--spacing-xl);
}

.title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0;
}

.closeButton {
  font-size: 2rem;
  background: none;
  border: none;
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.closeButton:hover {
  transform: translateY(-2px);
}

.content {
  padding: var(--spacing-md) var(--spacing-xl) var(--spacing-xl) var(--spacing-xl);
}

.actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
}
```

**Règles:**
- Toujours une croix (×) en haut à droite
- Jamais de ligne de séparation sous le titre (l'espace suffit)
- Boutons d'action alignés à droite
- Fermeture au clic sur le backdrop

### Boutons

**Types de boutons:**

#### Bouton Principal (Action)

```css
.primaryButton {
  background-color: var(--color-black);
  color: var(--color-white);
  border: 1px solid var(--color-black);
  padding: var(--spacing-md) var(--spacing-xl);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.primaryButton:hover {
  transform: translateY(-2px);
}
```

#### Bouton Secondaire (Annuler)

```css
.secondaryButton {
  background-color: transparent;
  color: var(--color-black);
  border: none; /* ou 1px solid var(--color-black) si besoin de cadre */
  padding: var(--spacing-md) var(--spacing-xl);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-regular);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.secondaryButton:hover {
  transform: translateY(-2px);
}
```

#### Bouton Destructif (Supprimer)

```css
.destructiveButton {
  background-color: var(--color-black);  /* Fond noir, pas rouge */
  color: var(--color-white);
  border: 1px solid var(--color-black);
  /* ... même styles que primaryButton */
}
```

**Note:** Le rouge est uniquement dans le **texte** d'avertissement, pas le bouton.

### Inputs & Formulaires

#### Input Standard

```css
.input {
  font-family: inherit;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-regular);
  background: none;
  border: none;
  border-bottom: 1px solid var(--color-gray-300);
  padding: var(--spacing-sm) 0;
  color: var(--color-black);
  outline: none;
  transition: border-color var(--transition-fast);
  width: 100%;
}

.input:focus {
  border-bottom-color: var(--color-black);
}

.input::placeholder {
  color: var(--color-gray-400);
  font-weight: var(--font-weight-thin);
}

/* Supprimer le fond bleu de l'autocomplete */
.input:-webkit-autofill,
.input:-webkit-autofill:hover,
.input:-webkit-autofill:focus,
.input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 30px white inset !important;
  -webkit-text-fill-color: var(--color-black) !important;
}
```

**Règles:**
- **Jamais de cadre complet** (border: none)
- **Soulignement fin uniquement** (border-bottom)
- Au focus: soulignement devient noir
- Pas d'outline au focus (géré par le soulignement)

#### Textarea

```css
.textarea {
  /* Mêmes styles que .input */
  resize: vertical;              /* Redimensionnement vertical uniquement */
  min-height: auto;
  line-height: var(--line-height-relaxed);
}
```

**Usage:** `rows={1}` par défaut (extensible verticalement)

#### Label & Champ

```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);        /* 8px entre label et input */
}

.label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-black);
}
```

#### Compteurs de Caractères

```css
.labelRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.charCount {
  font-size: 0.75rem;            /* 12px */
  font-weight: var(--font-weight-thin);
  color: var(--color-gray-500);
}
```

**Affichage:** `{count}/{max} caractères` en petit, gris, à droite du label

### Listes

#### Liste Scrollable

```css
.listContainer {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.listItem {
  padding: var(--spacing-lg) var(--spacing-md);
  border-bottom: 1px solid var(--color-gray-200);
  transition: transform var(--transition-fast);
  cursor: pointer;
}

.listItem:hover {
  transform: translateX(4px);
}

.listItem:last-child {
  border-bottom: none;
}
```

#### Liste avec Métadonnées

**Principe :** Métadonnées séparées par de petits points gris (`·`) pour une lecture fluide.

**Exemples :** Conversations, Documents, Utilisateurs

```html
<li class="listItem">
  <div class="itemMain">
    <h3 class="itemTitle">Nom principal</h3>
    <div class="itemMeta">
      <span class="metaItem">John Doe</span>
      <span class="metaSeparator">·</span>
      <span class="metaItem">5 messages</span>
      <span class="metaSeparator">·</span>
      <span class="metaItem">il y a 2h</span>
    </div>
  </div>
</li>
```

**CSS :**

```css
.itemMain {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.itemTitle {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-regular);
  color: var(--color-black);
  margin: 0;
}

.itemMeta {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

.metaItem {
  font-weight: var(--font-weight-thin);
}

.metaSeparator {
  color: var(--color-gray-400);
  font-size: 0.75rem;
  line-height: 1;
}
```

**Règles :**
- ✅ Toujours utiliser `·` (U+00B7 MIDDLE DOT) pour séparer
- ❌ Jamais `|`, `/`, `-`, ou autre caractère
- ✅ Couleur séparateur : `gray-400` (plus clair que le texte)
- ✅ Maximum 3-4 éléments par ligne pour lisibilité mobile

### Séparations Visuelles

#### Ligne Verticale (Sidebar, Sections)

```css
.section {
  position: relative;
}

.section::after {
  content: '';
  position: absolute;
  right: 0;
  top: var(--spacing-xl);        /* Décalage haut */
  bottom: var(--spacing-xl);     /* Décalage bas */
  width: 1px;
  background-color: var(--color-black);
  pointer-events: none;
}
```

**Règle:** Les lignes ne vont jamais de bord à bord, elles ont des marges.

#### Ligne Horizontale (Items)

```css
.item {
  border-bottom: 1px solid var(--color-gray-200);
}

.item:last-child {
  border-bottom: none;
}
```

---

## 🖼️ Images et Optimisation

### next/image (Next.js)

**Tous les logos clients et images doivent utiliser le composant `next/image` de Next.js.**

**Pourquoi :**
- Optimisation automatique (conversion WebP/AVIF)
- Lazy loading natif (charge uniquement quand visible)
- Prévention CLS (Cumulative Layout Shift)
- Responsive automatique (adapte selon l'écran)
- Réduction du poids des pages (~60-80%)

**Composant :** `components/clients/ClientLogo.tsx`

```tsx
import Image from 'next/image';

<Image
  src={logoUrl}
  alt="Logo client"
  width={48}
  height={48}
  quality={90}
  priority={false}  // true uniquement pour images above-the-fold
  unoptimized={logoUrl.includes('supabase')}  // pour domaines externes
/>
```

**Configuration (next.config.js) :**

```javascript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '**.supabase.co',
      pathname: '/storage/v1/object/public/**',
    },
  ],
  formats: ['image/webp', 'image/avif'],
  deviceSizes: [640, 750, 828, 1080, 1200],
  imageSizes: [16, 32, 48, 64, 96, 128, 256],
}
```

**Règles d'utilisation :**

| Situation | Utiliser |
|-----------|----------|
| Logo client (DB/Storage) | ✅ `next/image` |
| Icône SVG (inline) | ❌ Component React SVG |
| Image décor (public/) | ✅ `next/image` |
| Favicon | ❌ `<link>` classique |

**CSS associé :**

```css
/* next/image génère une structure spécifique */
.imageContainer {
  position: relative;
  width: 48px;
  height: 48px;
}

/* Styles additionnels si nécessaires */
.imageContainer img {
  object-fit: contain;
  border-radius: var(--border-radius-md);
}
```

**Règle absolue :** Toujours utiliser `next/image` pour les contenus dynamiques (logos, avatars), jamais `<img>`.

---

## ⏳ Loaders et États de Chargement

### Loader Minimaliste (3 points)

**Principe :** Simplicité absolue. 3 points animés en gris, pas de spinners colorés, pas d'animations complexes.

**Usage :** Chat IA en attente de réponse, traitement de documents, chargement de données.

**HTML :**

```html
<div class="loadingMessage">
  <div class="loadingDot"></div>
  <div class="loadingDot"></div>
  <div class="loadingDot"></div>
</div>
```

**CSS :**

```css
.loadingMessage {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
  margin-top: var(--spacing-md);
}

.loadingDot {
  width: 6px;
  height: 6px;
  background-color: var(--color-gray-600);
  border-radius: 50%;
  animation: pulse 1.4s ease-in-out infinite;
}

.loadingDot:nth-child(1) {
  animation-delay: 0s;
}

.loadingDot:nth-child(2) {
  animation-delay: 0.2s;
}

.loadingDot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes pulse {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: scale(1);
  }
  40% {
    opacity: 1;
    transform: scale(1.1);
  }
}
```

**Variante inline (dans un texte) :**

```css
.loadingInline {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  vertical-align: middle;
}

.loadingInline .loadingDot {
  width: 4px;
  height: 4px;
}
```

**Règles :**
- ✅ Utiliser ce loader pour tous les états de chargement
- ❌ Jamais de spinners circulaires, de barres de progression colorées
- ✅ Toujours 3 points (ni plus, ni moins)
- ✅ Animation décalée (0s, 0.2s, 0.4s) pour effet de vague

---

## 📝 Streaming de Texte (Chat IA)

### Principe

Le texte de l'assistant IA se déroule **token par token** directement dans l'interface, sans bulles de chat.

**Implémentation :** `app/portal/[slug]/chat/page.tsx`

**Design :**
- **Pas de bulles** : fond blanc uniforme, pas de containers colorés
- **Distinction typographique uniquement** :
  - User : `font-weight: var(--font-weight-thin)` (200)
  - Assistant : `font-weight: var(--font-weight-regular)` (500)
- **Pas d'avatars**, pas d'icônes, pas de timestamps visibles par défaut

**HTML :**

```html
<div class="messagesContainer">
  <div class="message">
    <div class="messageContent userMessage">
      Message de l'utilisateur
    </div>
  </div>
  
  <div class="message">
    <div class="messageContent assistantMessage">
      Réponse de l'assistant qui se déroule progressivement...
    </div>
  </div>
  
  <!-- Pendant le streaming -->
  <div class="message">
    <div class="loadingMessage">
      <div class="loadingDot"></div>
      <div class="loadingDot"></div>
      <div class="loadingDot"></div>
    </div>
  </div>
</div>
```

**CSS :**

```css
.messagesContainer {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-xl);
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
}

.message {
  margin-bottom: var(--spacing-xl);
  animation: fadeIn 150ms ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.messageContent {
  font-size: var(--font-size-base);
  line-height: 1.7;
  color: var(--color-black);
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Distinction typographique User vs Assistant */
.userMessage {
  font-weight: var(--font-weight-thin);  /* 200 - Question, légère */
}

.assistantMessage {
  font-weight: var(--font-weight-regular);  /* 500 - Réponse, affirmée */
}
```

**Comportement du streaming :**

1. **Avant réponse** : Afficher le loader 3 points
2. **Premier token reçu** : Remplacer le loader par le texte
3. **Tokens suivants** : Ajouter progressivement au texte existant
4. **Fin du stream** : Message complet affiché, smooth

**Règles :**
- ✅ Streaming fluide, imperceptible techniquement
- ❌ Pas de "typing indicator" visible
- ✅ Distinction user/assistant par police uniquement
- ❌ Pas de couleurs différentes, pas de fonds
- ✅ Espacement généreux entre les messages (xl)

---

## 🎯 États & Interactions

### États des Éléments Cliquables

#### Hover (Survol)

```css
.element:hover {
  transform: translateY(-2px);    /* Standard */
  /* OU */
  transform: translateX(4px);     /* Liste */
  /* OU */
  transform: scale(1.1);          /* Icône seule */
}
```

#### Active (Clic)

```css
.element:active {
  transform: translateY(0);       /* Retour position initiale */
}
```

#### Focus (Accessibilité)

```css
.element:focus-visible {
  outline: 2px solid var(--color-black);
  outline-offset: 2px;
}
```

**Règle:** `focus-visible` uniquement (pas `:focus` qui trigger au clic)

### États Sélectionné / Actif

#### Item de Liste Sélectionné

```css
.listItem.selected {
  font-weight: var(--font-weight-bold);
}
```

**Changement:** Uniquement le poids de police, pas de fond coloré.

#### Bouton Toggle Actif

```css
.toggleButton.active {
  background-color: var(--color-black);
  color: var(--color-white);
}
```

### États de Chargement

#### Texte de Statut

```css
.status {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-thin);
  color: var(--color-gray-600);
  font-style: italic;
}

.status.ready {
  color: var(--color-black);
}
```

**Exemples:** "Chargement...", "Traitement...", "Prêt"

---

## 🔒 Sécurité et Performance

### Headers HTTP de Sécurité

**Tous les projets doivent inclure ces headers de sécurité en production.**

**Configuration (next.config.js) :**

```javascript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        // Content Security Policy (CSP)
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
            "frame-ancestors 'none'",
          ].join('; '),
        },
        // Protection contre le clickjacking
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        // Protection XSS
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        // Politique de référent
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        // Permissions Policy (anciennement Feature Policy)
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
        },
        // Strict Transport Security (HTTPS uniquement)
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
      ],
    },
  ];
}
```

**Description des headers :**

| Header | Fonction | Protection contre |
|--------|----------|-------------------|
| **Content-Security-Policy** | Définit les sources autorisées pour chaque type de contenu | XSS, injection de code malveillant |
| **X-Frame-Options** | Empêche l'embedding dans iframe | Clickjacking |
| **X-Content-Type-Options** | Force le navigateur à respecter le MIME type | MIME type sniffing |
| **Referrer-Policy** | Contrôle les informations envoyées au referrer | Fuite d'informations sensibles |
| **Permissions-Policy** | Désactive les API navigateur non utilisées | Abus des permissions |
| **Strict-Transport-Security** | Force HTTPS pendant 1 an | Man-in-the-middle attacks |

**Conformité :**
- ✅ OWASP Top 10 (sécurité web)
- ✅ CSP Level 2
- ✅ WCAG 2.1 AA (accessibilité)

**Test des headers :**

```bash
# Vérifier les headers avec curl
curl -I https://your-domain.com

# Ou avec un outil en ligne
# https://securityheaders.com
```

**Règle absolue :** Ces headers sont **obligatoires** en production. Pas d'exception.

### Variables d'Environnement

**Fichiers de configuration :**

```
.env.local       # Development (jamais commit)
.env.staging     # Staging (jamais commit)
.env.production  # Production (jamais commit)
env.example.txt  # Template (commit OK)
```

**Template (env.example.txt) :**

```env
# ============================================
# SUPABASE
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your_anon_key
SUPABASE_SERVICE_KEY=eyJhbGc...your_service_key

# ============================================
# SENTRY (Monitoring)
# ============================================
NEXT_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/your-project
SENTRY_DSN=https://your-key@sentry.io/your-project
SENTRY_ORG=pixel-poule
SENTRY_PROJECT=once-minimal

# ============================================
# ENVIRONNEMENT
# ============================================
NEXT_PUBLIC_VERCEL_ENV=development
NODE_ENV=development

# ============================================
# API KEYS (IA)
# ============================================
ANTHROPIC_API_KEY=sk-ant-api03-xxx
OPENAI_API_KEY=sk-xxx
```

**Règles de nommage :**

| Préfixe | Usage | Exposition |
|---------|-------|------------|
| `NEXT_PUBLIC_` | Variables exposées au client (browser) | ⚠️ Publiques |
| Aucun préfixe | Variables serveur uniquement | ✅ Privées |

**Sécurité :**

```typescript
// ✅ BON - Variable exposée pour le client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// ❌ MAUVAIS - Clé privée exposée au client
const serviceKey = process.env.SUPABASE_SERVICE_KEY;  // Undefined côté client (bien)

// ✅ BON - Utilisé uniquement dans API Routes ou Server Components
export async function getServerSideProps() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;  // OK côté serveur
  // ...
}
```

**Git et Vercel :**

```.gitignore
# Variables d'environnement (ne JAMAIS commit)
.env
.env.local
.env.staging
.env.production
.env.*.local

# OK à commit
env.example.txt
```

**Règles absolues :**
- ❌ Jamais commit de fichiers `.env*` dans Git
- ✅ Toujours utiliser `env.example.txt` comme template
- ✅ Variables sensibles (clés API) sans préfixe `NEXT_PUBLIC_`
- ✅ Configurer les variables dans Vercel Dashboard pour staging/production

---

## 📱 Responsive Design

### Breakpoints

```css
/* Mobile */
@media (max-width: 768px) {
  /* Ajustements mobiles */
}

/* Tablet */
@media (min-width: 769px) and (max-width: 1024px) {
  /* Ajustements tablette */
}

/* Desktop */
@media (min-width: 1025px) {
  /* Styles par défaut */
}
```

### Adaptations Typographiques

**Desktop → Mobile:**

| Élément | Desktop | Mobile |
|---------|---------|--------|
| Titre héros | 5rem (80px) | 3rem (48px) |
| Titre page | 4rem (64px) | 3rem (48px) |
| Titre section | 2rem (32px) | 1.5rem (24px) |
| Texte standard | 1rem (16px) | 1rem (16px) |

### Adaptations Spatiales

**Desktop → Mobile:**

- Padding pages : `spacing-xl` (48px) → `spacing-md` (24px)
- Padding modales : `spacing-xl` (48px) → `spacing-lg` (32px)
- Gap entre sections : `calc(spacing-xl * 2)` (96px) → `spacing-xl` (48px)

---

## ♿ Accessibilité

### Contraste

**Ratio minimum WCAG AA:**

- Texte standard (16px+) : **4.5:1**
- Texte large (24px+, bold 19px+) : **3:1**

**Combinaisons validées:**

| Texte | Fond | Ratio | Statut |
|-------|------|-------|--------|
| `black` | `white` | 21:1 | ✅ AAA |
| `gray-600` | `white` | 7.4:1 | ✅ AAA |
| `gray-500` | `white` | 4.6:1 | ✅ AA |
| `white` | `black` | 21:1 | ✅ AAA |

### Focus States

**Obligatoire sur TOUS les éléments interactifs:**

```css
.element:focus-visible {
  outline: 2px solid var(--color-black);
  outline-offset: 2px;
}
```

### ARIA Labels

**Sur les éléments sans texte:**

```tsx
<button aria-label="Supprimer" title="Supprimer">
  ×
</button>
```

**Règle:** `aria-label` + `title` sur icônes, boutons symboliques.

---

## 📐 Layout & Grille

### Centrage de Contenu

```css
.container {
  max-width: 1200px;              /* Largeur max contenu */
  margin: 0 auto;                 /* Centrage horizontal */
  padding: 0 var(--spacing-xl);   /* Padding latéral */
}
```

### Grille de Sections

```css
.grid {
  display: grid;
  grid-template-columns: 300px 1fr;  /* Sidebar fixe + contenu fluide */
  gap: 0;                            /* Pas de gap, séparateurs visuels */
  height: 100vh;
}
```

### Flexbox pour Alignement

```css
.flexContainer {
  display: flex;
  justify-content: space-between;     /* Espace entre éléments */
  align-items: center;                /* Alignement vertical centré */
  gap: var(--spacing-md);
}
```

---

## 🧩 Patterns Graphiques Avancés

### Effet Glassmorphism (Modales)

```css
.modal {
  background-color: rgba(255, 255, 255, 0.65);  /* Blanc semi-transparent */
  backdrop-filter: blur(6px);                   /* Flou du contenu derrière */
  border: 1px solid var(--color-black);
}
```

**Effet:** Modale semi-transparente qui laisse deviner le contenu derrière elle.

### Descriptions Inline

**Pattern pour afficher une info principale + description:**

```html
<p class="content">
  Équilibrées <span class="description">(Équilibre entre concision et détails)</span>
</p>
```

```css
.content {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-regular);
  color: var(--color-black);
}

.description {
  font-size: 0.875rem;
  font-weight: var(--font-weight-thin);
  color: var(--color-gray-600);
  font-style: italic;
}
```

**Effet:** Texte principal + explication discrète sur la même ligne.

### Icônes Minimalistes

**Tailles standards:**

- Icônes header : 24px
- Icônes actions : 28px
- Icônes navigation : 20px
- Icônes décoratives : 16px

**Style:**

```css
.icon {
  color: var(--color-black);
  stroke-width: 2px;                 /* Trait fin mais visible */
  stroke-linecap: round;
  stroke-linejoin: round;
}
```

**Source recommandée:** Lucide Icons, Feather Icons (style minimaliste, stroke-based)

---

## 🎨 Checklist Minimalisme

### Avant de Valider un Design

**✅ Couleurs:**
- [ ] Uniquement noir/blanc/gris (+ 1 rouge pour danger)
- [ ] Pas de dégradés, pas de couleurs vives
- [ ] Contraste WCAG AA minimum

**✅ Typographie:**
- [ ] Police Nunito (3 poids max)
- [ ] Hiérarchie claire par taille + poids
- [ ] Interlignage généreux (1.6+)

**✅ Espacements:**
- [ ] Variables CSS utilisées (pas de valeurs hardcodées)
- [ ] Espaces blancs généreux
- [ ] Respiration entre sections

**✅ Animations:**
- [ ] < 200ms pour micro-interactions
- [ ] Uniquement transformations géométriques au hover
- [ ] Pas de changement de couleur/opacité au hover

**✅ Composants:**
- [ ] Modales sans bordures internes (uniquement contour)
- [ ] Inputs sans cadre (soulignement uniquement)
- [ ] Boutons minimalistes (texte ou fond noir)

**✅ Accessibilité:**
- [ ] Focus states visibles sur tous les éléments interactifs
- [ ] ARIA labels sur icônes/actions
- [ ] Textes contrastés

**✅ Responsive:**
- [ ] Adaptation mobile testée
- [ ] Typographie réduite sur petit écran
- [ ] Espacements ajustés

---

## 🎯 Exemples de Composants

### Carte Minimaliste

```css
.card {
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-200);
  padding: var(--spacing-lg);
  transition: transform var(--transition-fast);
  cursor: pointer;
}

.card:hover {
  transform: translateY(-2px);
}

.cardTitle {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-md) 0;
}

.cardContent {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-regular);
  color: var(--color-gray-600);
  line-height: var(--line-height-relaxed);
}
```

### Navigation Latérale

```css
.sidebar {
  width: 300px;
  height: 100vh;
  background-color: var(--color-white);
  border-right: 1px solid var(--color-black);
  padding: var(--spacing-xl);
}

.navList {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.navItem {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-regular);
  padding: var(--spacing-md) 0;
  transition: transform var(--transition-fast);
  cursor: pointer;
}

.navItem:hover {
  transform: translateX(4px);
}

.navItem.active {
  font-weight: var(--font-weight-bold);
}
```

### Statistique Héros

```css
.statContainer {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--spacing-md);
}

.statNumber {
  font-size: 8rem;                    /* 128px - Très gros */
  font-weight: var(--font-weight-bold);
  line-height: 0.9;
  letter-spacing: -0.02em;
  color: var(--color-black);
}

.statLabel {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-regular);
  color: var(--color-gray-600);
}
```

---

## 📚 Inspiration & Références

### Principes Philosophiques

**Dieter Rams - 10 Principes du Bon Design:**
1. Le bon design est innovant
2. Le bon design rend un produit utile
3. Le bon design est esthétique
4. Le bon design rend un produit compréhensible
5. Le bon design est discret
6. Le bon design est honnête
7. Le bon design est durable
8. Le bon design va jusqu'au dernier détail
9. Le bon design est écologique
10. **Le bon design est aussi peu de design que possible**

### Références Visuelles

- **Braun** (années 60-70) : Produits électroniques minimalistes
- **Apple** (2000s) : Interfaces épurées, espacements généreux
- **Notion** : Typographie comme design principal
- **Linear** : Animations subtiles, hiérarchie claire

### Anti-Exemples (Ce Qu'il Ne Faut PAS Faire)

❌ **Material Design** : Trop de couleurs, ombres prononcées  
❌ **Skeuomorphisme** : Imitation du réel, décorations  
❌ **Neumorphism** : Ombres complexes, ambiguïté visuelle  
❌ **Glassmorphism extrême** : Trop de transparence, illisibilité

---

## 🔧 Outils Recommandés

### Design

- **Figma** : Prototypage, design system
- **Contrast Checker** : Vérification WCAG
- **Coolors** : Génération de nuances de gris

### Développement

- **CSS Variables** : Gestion centralisée des tokens
- **CSS Modules** : Scoping des styles par composant
- **PostCSS** : Autoprefixer pour compatibilité

### Typographie

- **Google Fonts** : Nunito
- **Font Squirrel** : Optimisation de fonts
- **Wakamaifondue** : Analyse de fonts variables

### Icônes

- **Lucide Icons** : Icônes minimalistes stroke-based
- **Feather Icons** : Alternative légère
- **Heroicons** : Style épuré, bien dessinés

---

## 🎓 Bonnes Pratiques

### Design

1. **Commencer par le noir et blanc** - Ajouter des couleurs uniquement si absolument nécessaire
2. **Hiérarchie par la taille** - Ne pas utiliser la couleur pour différencier l'importance
3. **Espaces généreux** - Ne jamais avoir peur du vide
4. **Cohérence absolue** - Même spacing, même animation, partout

### Code

1. **Variables CSS** - Jamais de valeurs hardcodées
2. **Mobile-first** - Partir du mobile, étendre au desktop
3. **Accessibilité dès le début** - Focus states, ARIA, contraste
4. **Performance** - Animations GPU (`transform` uniquement)

### Process

1. **Wireframe d'abord** - Structure avant esthétique
2. **Prototype minimaliste** - Itérer en ajoutant, pas en retirant
3. **Test utilisateur** - Valider la clarté, pas la beauté
4. **Maintenance** - Revoir régulièrement le design system

---

## 📝 Template de Composant

**Utiliser ce template pour créer tout nouveau composant:**

```tsx
/**
 * [NomDuComposant] - Description en une ligne
 */

'use client';

import styles from './[NomDuComposant].module.css';

interface [NomDuComposant]Props {
  // Props ici
}

export default function [NomDuComposant]({ ...props }: [NomDuComposant]Props) {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Titre</h2>
      <p className={styles.content}>Contenu</p>
    </div>
  );
}
```

```css
/* [NomDuComposant].module.css */

.container {
  /* Layout */
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  
  /* Spacing */
  padding: var(--spacing-lg);
  
  /* Visuel */
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-200);
}

.title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-black);
  margin: 0;
}

.content {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-regular);
  color: var(--color-gray-600);
  line-height: var(--line-height-relaxed);
  margin: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .container {
    padding: var(--spacing-md);
  }
  
  .title {
    font-size: var(--font-size-lg);
  }
}
```

---

## 🎯 Conclusion

**Le minimalisme n'est pas un manque, c'est un choix.**

Chaque élément présent a été voulu, pensé, justifié. L'absence de couleur n'est pas une contrainte, c'est une discipline. L'espace blanc n'est pas du vide, c'est de la respiration.

**Principes à retenir:**

1. **Moins, mais mieux** - Peu d'éléments, mais parfaits
2. **Contraste par la hiérarchie** - Typographie, pas couleur
3. **Animations subtiles** - Feedback, pas spectacle
4. **Cohérence absolue** - Même langage visuel partout

**Questions à se poser avant d'ajouter un élément:**

- Est-ce **absolument nécessaire** ?
- Peut-on transmettre la même information **plus simplement** ?
- Est-ce **cohérent** avec le reste de l'interface ?
- L'utilisateur va-t-il **comprendre immédiatement** ?

Si la réponse à l'une de ces questions est "non", alors l'élément ne doit pas être ajouté.

---

**Créé avec rigueur par Pixel Poule**  
*L'élégance naît de la contrainte, la clarté naît du minimalisme.*

