/**
 * PlayerSettingsMenu - Menu de reglages du lecteur video
 * Contient les sections Audio, Sous-titres, Synchronisation et OpenSubtitles
 */

'use client'

import { memo, RefObject } from 'react'
import menuStyles from './SettingsMenu.module.css'
import type { AudioTrack, SubtitleTrack } from './types'

interface PlayerSettingsMenuProps {
  // Audio
  audioTracks: AudioTrack[]
  selectedAudio: number
  onAudioChange: (track: AudioTrack, idx: number) => void
  // Sous-titres
  subtitleTracks: SubtitleTrack[]
  selectedSubtitle: number | null
  onSubtitleChange: (idx: number | null) => void
  // Synchronisation
  subtitleOffset: number
  onSubtitleOffsetChange: (delta: number) => void
  onSubtitleOffsetReset: () => void
  // OpenSubtitles
  isDownloadingSubtitles: boolean
  onDownloadSubtitles: () => void
  // Ref
  menuRef: RefObject<HTMLDivElement>
}

/**
 * Menu de reglages : pistes audio, sous-titres, synchronisation, OpenSubtitles
 */
const PlayerSettingsMenu = memo(function PlayerSettingsMenu({
  audioTracks,
  selectedAudio,
  onAudioChange,
  subtitleTracks,
  selectedSubtitle,
  onSubtitleChange,
  subtitleOffset,
  onSubtitleOffsetChange,
  onSubtitleOffsetReset,
  isDownloadingSubtitles,
  onDownloadSubtitles,
  menuRef
}: PlayerSettingsMenuProps) {
  const hasDownloadedSubtitles = subtitleTracks.some(
    t => (t as SubtitleTrack & { isDownloaded?: boolean }).isDownloaded
  )

  return (
    <div ref={menuRef} className={menuStyles.settingsMenu}>
      {/* Audio */}
      {audioTracks.length > 0 && (
        <div className={menuStyles.settingsSection}>
          <div className={menuStyles.settingsSectionTitle}>Audio</div>
          {audioTracks.map((track, idx) => (
            <div
              key={`audio-${track.index}`}
              className={`${menuStyles.settingsOption} ${selectedAudio === idx ? menuStyles.active : ''}`}
              onClick={() => onAudioChange(track, idx)}
            >
              <div className={menuStyles.settingsOptionInfo}>
                <span className={menuStyles.settingsOptionTitle}>
                  {track.language || `Piste ${idx + 1}`}
                </span>
                {track.title && (
                  <span className={menuStyles.settingsOptionSubtitle}>{track.title}</span>
                )}
              </div>
              {selectedAudio === idx && (
                <svg className={menuStyles.settingsCheckmark} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sous-titres */}
      <div className={menuStyles.settingsSection}>
        <div className={menuStyles.settingsSectionTitle}>Sous-titres</div>

        {/* Option "Desactives" */}
        <div
          className={`${menuStyles.settingsOption} ${selectedSubtitle === null ? menuStyles.active : ''}`}
          onClick={() => onSubtitleChange(null)}
        >
          <div className={menuStyles.settingsOptionInfo}>
            <span className={menuStyles.settingsOptionTitle}>Désactivés</span>
          </div>
          {selectedSubtitle === null && (
            <svg className={menuStyles.settingsCheckmark} viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
            </svg>
          )}
        </div>

        {/* Sous-titres integres */}
        {subtitleTracks.map((track, idx) => (
          <div
            key={`sub-${track.index}`}
            className={`${menuStyles.settingsOption} ${selectedSubtitle === idx ? menuStyles.active : ''}`}
            onClick={() => onSubtitleChange(idx)}
          >
            <div className={menuStyles.settingsOptionInfo}>
              <span className={menuStyles.settingsOptionTitle}>
                {track.language || `Sous-titre ${idx + 1}`}
              </span>
              {track.title && (
                <span className={menuStyles.settingsOptionSubtitle}>{track.title}</span>
              )}
            </div>
            {selectedSubtitle === idx && (
              <svg className={menuStyles.settingsCheckmark} viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
            )}
          </div>
        ))}

        {/* Controle de synchronisation des sous-titres telecharges */}
        {hasDownloadedSubtitles && selectedSubtitle !== null && (
          <div className={menuStyles.settingsSection}>
            <div className={menuStyles.settingsSectionTitle}>Synchronisation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 16px' }}>
              {/* Controles fins (+-0.5s) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => onSubtitleOffsetChange(-0.5)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  -0.5s
                </button>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', minWidth: '100px', textAlign: 'center', fontWeight: '500' }}>
                  {subtitleOffset !== 0 ? `${subtitleOffset > 0 ? '+' : ''}${subtitleOffset.toFixed(1)}s` : 'Synchronisé'}
                </span>
                <button
                  onClick={() => onSubtitleOffsetChange(0.5)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  +0.5s
                </button>
              </div>

              {/* Controles grossiers (+-5s) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => onSubtitleOffsetChange(-5)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.7)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  -5s
                </button>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', minWidth: '60px', textAlign: 'center' }}>
                  Ajustement grossier
                </span>
                <button
                  onClick={() => onSubtitleOffsetChange(5)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.7)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  +5s
                </button>
              </div>

              {/* Bouton Reset */}
              {subtitleOffset !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                  <button
                    onClick={onSubtitleOffsetReset}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'white',
                      padding: '6px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Réinitialiser
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Telecharger depuis OpenSubtitles */}
        <div
          className={`${menuStyles.settingsOption} ${isDownloadingSubtitles ? menuStyles.disabled : ''}`}
          onClick={onDownloadSubtitles}
          style={{ opacity: isDownloadingSubtitles ? 0.5 : 1 }}
        >
          <div className={menuStyles.settingsOptionInfo}>
            <span className={menuStyles.settingsOptionTitle}>
              {isDownloadingSubtitles ? 'Téléchargement...' : 'Télécharger depuis OpenSubtitles'}
            </span>
            <span className={menuStyles.settingsOptionSubtitle}>
              {isDownloadingSubtitles ? 'Recherche en cours...' : 'Français et Anglais'}
            </span>
          </div>
          {isDownloadingSubtitles && (
            <svg className={menuStyles.settingsCheckmark} viewBox="0 0 24 24" fill="currentColor" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
            </svg>
          )}
        </div>
      </div>
    </div>
  )
})

export default PlayerSettingsMenu
