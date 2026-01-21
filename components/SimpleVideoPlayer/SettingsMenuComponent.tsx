/**
 * SettingsMenuComponent - Menu de paramètres (audio, sous-titres)
 * 
 * Composant présentatif pour la sélection des pistes audio et sous-titres.
 * Peut être intégré progressivement au SimpleVideoPlayer.
 */

'use client'

import { memo } from 'react'
import menuStyles from './SettingsMenu.module.css'
import { 
  AudioTrack, 
  SubtitleTrack, 
  SettingsMenuProps, 
  getLanguageName 
} from './types'

/**
 * Menu de paramètres du lecteur vidéo
 */
const SettingsMenuComponent = memo(function SettingsMenuComponent({
  audioTracks,
  subtitleTracks,
  selectedAudio,
  selectedSubtitle,
  subtitleOffset,
  onAudioChange,
  onSubtitleChange,
  onSubtitleOffsetChange,
  onClose,
  isDownloadingSubtitles
}: SettingsMenuProps) {
  return (
    <div className={menuStyles.settingsMenu} onClick={(e) => e.stopPropagation()}>
      {/* En-tête */}
      <div className={menuStyles.menuHeader}>
        <span>Paramètres</span>
        <button className={menuStyles.closeButton} onClick={onClose}>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {/* Section Audio */}
      {audioTracks.length > 0 && (
        <div className={menuStyles.section}>
          <h4 className={menuStyles.sectionTitle}>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" fill="currentColor"/>
            </svg>
            Audio
          </h4>
          <div className={menuStyles.trackList}>
            {audioTracks.map((track, idx) => (
              <button
                key={`audio-${idx}`}
                className={`${menuStyles.trackButton} ${selectedAudio === idx ? menuStyles.selected : ''}`}
                onClick={() => onAudioChange(track, idx)}
              >
                <span className={menuStyles.trackLanguage}>
                  {getLanguageName(track.language)}
                </span>
                {track.title && (
                  <span className={menuStyles.trackTitle}>{track.title}</span>
                )}
                {track.codec && (
                  <span className={menuStyles.trackCodec}>{track.codec.toUpperCase()}</span>
                )}
                {selectedAudio === idx && (
                  <svg className={menuStyles.checkIcon} viewBox="0 0 24 24" width="18" height="18">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Section Sous-titres */}
      <div className={menuStyles.section}>
        <h4 className={menuStyles.sectionTitle}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z" fill="currentColor"/>
          </svg>
          Sous-titres
          {isDownloadingSubtitles && (
            <span className={menuStyles.downloadingBadge}>Chargement...</span>
          )}
        </h4>
        <div className={menuStyles.trackList}>
          {/* Option pour désactiver */}
          <button
            className={`${menuStyles.trackButton} ${selectedSubtitle === null ? menuStyles.selected : ''}`}
            onClick={() => onSubtitleChange(null)}
          >
            <span className={menuStyles.trackLanguage}>Désactivés</span>
            {selectedSubtitle === null && (
              <svg className={menuStyles.checkIcon} viewBox="0 0 24 24" width="18" height="18">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
              </svg>
            )}
          </button>
          
          {/* Pistes de sous-titres */}
          {subtitleTracks.map((track, idx) => (
            <button
              key={`subtitle-${idx}`}
              className={`${menuStyles.trackButton} ${selectedSubtitle === idx ? menuStyles.selected : ''}`}
              onClick={() => onSubtitleChange(idx)}
            >
              <span className={menuStyles.trackLanguage}>
                {getLanguageName(track.language)}
              </span>
              {track.title && (
                <span className={menuStyles.trackTitle}>{track.title}</span>
              )}
              {track.forced && (
                <span className={menuStyles.forcedBadge}>Forcé</span>
              )}
              {track.isDownloaded && (
                <span className={menuStyles.downloadedBadge}>Externe</span>
              )}
              {selectedSubtitle === idx && (
                <svg className={menuStyles.checkIcon} viewBox="0 0 24 24" width="18" height="18">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Décalage des sous-titres (si sous-titres sélectionnés) */}
      {selectedSubtitle !== null && (
        <div className={menuStyles.section}>
          <h4 className={menuStyles.sectionTitle}>
            Décalage sous-titres
          </h4>
          <div className={menuStyles.offsetControls}>
            <button 
              className={menuStyles.offsetButton}
              onClick={() => onSubtitleOffsetChange(subtitleOffset - 0.5)}
            >
              -0.5s
            </button>
            <span className={menuStyles.offsetValue}>
              {subtitleOffset > 0 ? '+' : ''}{subtitleOffset.toFixed(1)}s
            </span>
            <button 
              className={menuStyles.offsetButton}
              onClick={() => onSubtitleOffsetChange(subtitleOffset + 0.5)}
            >
              +0.5s
            </button>
            {subtitleOffset !== 0 && (
              <button 
                className={menuStyles.resetButton}
                onClick={() => onSubtitleOffsetChange(0)}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

export default SettingsMenuComponent
