/**
 * Selecteurs centralises pour les tests E2E
 * Evite la duplication et facilite la maintenance
 */

// -- Auth --
export const AUTH = {
  emailInput: '#email',
  passwordInput: '#password',
  confirmPasswordInput: '#confirmPassword',
  displayNameInput: '#displayName',
  submitButton: 'button[type="submit"]',
  errorMessage: '[class*="error"]',
  loginLink: 'a[href="/login"]',
  registerLink: 'a[href="/register"]',
} as const

// -- Header --
export const HEADER = {
  logo: 'a[href="/films"]',
  navFilms: 'a[href="/films"]',
  navSeries: 'a[href="/series"]',
  navMaListe: 'a[href="/ma-liste"]',
  userMenu: '[class*="userMenu"]',
  avatar: '[class*="avatar"]',
  dropdown: '[class*="dropdown"]',
  logoutButton: 'text=Déconnexion',
} as const

// -- Catalogue --
export const CATALOG = {
  heroSection: '[class*="hero"], [class*="Hero"]',
  movieRow: '[class*="movieRow"], [class*="MovieRow"]',
  movieCard: '[class*="movieCard"], [class*="MediaCard"], [class*="poster"]',
  searchInput: 'input[type="search"], input[placeholder*="Rechercher"]',
  favoriteButton: '[class*="favorite"], [class*="Favorite"]',
  modal: '[class*="modal"], [class*="Modal"]',
  modalClose: '[class*="close"], [class*="Close"]',
} as const

// -- Lecteur Video --
export const PLAYER = {
  container: '[class*="playerContainer"], [class*="videoPlayer"]',
  video: 'video',
  controls: '[class*="controls"]',
  playPauseButton: '[class*="playPause"], button[aria-label*="play" i], button[aria-label*="pause" i]',
  skipBackButton: '[class*="skip"] button:first-child, button[aria-label*="reculer" i], button[aria-label*="-10" i]',
  skipForwardButton: '[class*="skip"] button:last-child, button[aria-label*="avancer" i], button[aria-label*="+10" i]',
  progressBar: '[class*="progress"], [class*="timeline"], input[type="range"][class*="progress"]',
  volumeButton: '[class*="volume"], button[aria-label*="volume" i], button[aria-label*="son" i], button[aria-label*="mute" i]',
  volumeSlider: 'input[type="range"][class*="volume"]',
  fullscreenButton: 'button[aria-label*="plein" i], button[aria-label*="fullscreen" i]',
  settingsButton: 'button[aria-label*="audio" i], button[aria-label*="sous-titre" i], button[aria-label*="paramètre" i]',
  settingsMenu: '[class*="settingsMenu"], [class*="SettingsMenu"]',
  closeButton: '[class*="closeButton"], button[aria-label*="fermer" i]',
  loadingSpinner: '[class*="loading"], [class*="spinner"]',
  errorOverlay: '[class*="error"]',
  nextEpisodeOverlay: '[class*="nextEpisode"], [class*="NextEpisode"]',
  episodesButton: 'button[aria-label*="épisode" i], button[aria-label*="episode" i]',
  episodesModal: '[class*="episodesModal"], [class*="EpisodesModal"]',
  titleBar: '[class*="titleBar"], [class*="topBar"]',
  timeDisplay: '[class*="time"], [class*="duration"]',
  seekWarning: '[class*="seekWarning"], [class*="warning"]',
} as const

// -- Admin --
export const ADMIN = {
  container: '[class*="admin"], [class*="Admin"]',
  tabs: '[class*="tab"], [class*="Tab"]',
  tabTranscode: 'text=Transcodage',
  tabScan: 'text=Scan',
  tabLibrary: 'text=Bibliothèque',
  tabActivity: 'text=Activité',
  tabPosters: 'text=Jaquettes',
} as const
