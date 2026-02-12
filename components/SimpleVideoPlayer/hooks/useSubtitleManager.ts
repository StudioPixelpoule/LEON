/**
 * Hook useSubtitleManager
 * Gère l'ensemble de la logique sous-titres :
 * - Changement de piste (MP4 natif, HLS via API, tracks téléchargés)
 * - Téléchargement depuis OpenSubtitles (FR + EN)
 * - Offset de synchronisation
 * - Application des préférences initiales (pending subtitle)
 */

import { useState, useRef, useEffect, useCallback, type MutableRefObject } from 'react'
import type { SubtitleTrack } from '../types'

interface UseSubtitleManagerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  src: string
  getFilepath: () => string | null
  /** Callback pour remonter les erreurs au composant parent */
  onError: (message: string | null) => void
  /** Callback pour fermer le menu settings quand on change de sous-titre */
  onCloseSettings?: () => void
}

interface UseSubtitleManagerReturn {
  subtitleTracks: SubtitleTrack[]
  selectedSubtitle: number | null
  subtitleOffset: number
  isDownloadingSubtitles: boolean
  selectedSubtitleRef: MutableRefObject<number | null>
  pendingSubtitleApplyRef: MutableRefObject<number | null>
  subtitleAbortControllerRef: MutableRefObject<AbortController | null>
  setSubtitleTracks: React.Dispatch<React.SetStateAction<SubtitleTrack[]>>
  setSelectedSubtitle: React.Dispatch<React.SetStateAction<number | null>>
  handleSubtitleChange: (idx: number | null) => void
  handleSubtitleOffsetChange: (delta: number) => void
  handleSubtitleOffsetReset: () => void
  handleDownloadOpenSubtitles: () => Promise<void>
}

export function useSubtitleManager({
  videoRef,
  src,
  getFilepath,
  onError,
  onCloseSettings
}: UseSubtitleManagerOptions): UseSubtitleManagerReturn {
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
  const [selectedSubtitle, setSelectedSubtitle] = useState<number | null>(null)
  const [isDownloadingSubtitles, setIsDownloadingSubtitles] = useState(false)
  const [subtitleOffset, setSubtitleOffset] = useState<number>(0)

  const selectedSubtitleRef = useRef<number | null>(null)
  const subtitleAbortControllerRef = useRef<AbortController | null>(null)
  const pendingSubtitleApplyRef = useRef<number | null>(null)

  // Synchroniser la ref
  useEffect(() => {
    selectedSubtitleRef.current = selectedSubtitle
  }, [selectedSubtitle])

  // Changement de sous-titres DYNAMIQUE
  const handleSubtitleChange = useCallback((idx: number | null) => {
    if (!videoRef.current) return

    console.log(`[PLAYER] Changement sous-titres: ${idx === null ? 'Désactivés' : `piste ${idx}`}`)

    // Annuler le fetch précédent s'il existe
    if (subtitleAbortControllerRef.current) {
      console.log(`[PLAYER] Annulation fetch sous-titres précédent`)
      subtitleAbortControllerRef.current.abort()
      subtitleAbortControllerRef.current = null
    }

    const video = videoRef.current
    setSelectedSubtitle(idx)
    onCloseSettings?.()

    // Vérifier si c'est un MP4 direct (avec sous-titres intégrés mov_text)
    const isDirectMP4 = !src.includes('/api/hls') && !src.includes('/api/hls-v2')

    if (isDirectMP4) {
      // Pour MP4 directs : essayer d'abord les textTracks natifs, sinon utiliser /api/subtitles

      // Ne PAS supprimer les éléments <track> natifs (sous-titres intégrés dans le MP4)
      // On supprime seulement les tracks ajoutés dynamiquement (depuis /api/subtitles)
      const existingTracks = video.querySelectorAll('track')
      existingTracks.forEach(t => {
        if (t.src && t.src.includes('/api/subtitles')) {
          t.remove()
        }
      })

      // Désactiver toutes les text tracks d'abord (mais les garder dans le DOM)
      Array.from(video.textTracks).forEach(t => {
        t.mode = 'disabled'
      })

      // Si pas de sous-titres, on s'arrête
      if (idx === null) {
        console.log('[PLAYER] Sous-titres désactivés')
        return
      }

      const track = subtitleTracks[idx]
      if (!track) return

      // Si c'est un track téléchargé, utiliser directement son URL avec offset
      if ((track as SubtitleTrack & { isDownloaded?: boolean }).isDownloaded && (track as SubtitleTrack & { sourceUrl?: string }).sourceUrl) {
        console.log(`[PLAYER] Détection track téléchargé: ${track.language}`)

        let trackUrl = (track as SubtitleTrack & { sourceUrl?: string }).sourceUrl!
        if (subtitleOffset !== 0) {
          if (trackUrl.includes('&offset=')) {
            trackUrl = trackUrl.replace(/&offset=[-\d.]+/, `&offset=${subtitleOffset}`)
          } else {
            trackUrl += `&offset=${subtitleOffset}`
          }
        }

        // Supprimer les tracks ajoutés dynamiquement
        const existingDynTracks = video.querySelectorAll('track')
        existingDynTracks.forEach(t => {
          if (t.src && (t.src.includes('/api/subtitles') || t.src.includes('/api/subtitles/fetch'))) {
            t.remove()
          }
        })

        Array.from(video.textTracks).forEach(t => {
          t.mode = 'disabled'
        })

        const trackElement = document.createElement('track')
        trackElement.kind = 'subtitles'
        trackElement.label = track.language
        trackElement.srclang = track.language.toLowerCase().slice(0, 2)
        trackElement.src = trackUrl
        trackElement.default = false

        video.appendChild(trackElement)

        trackElement.addEventListener('load', () => {
          const textTrack = Array.from(video.textTracks).find(
            t => t.label === track.language || t.language === track.language.toLowerCase().slice(0, 2)
          )
          if (textTrack) {
            const cuesCount = textTrack.cues ? textTrack.cues.length : 0
            textTrack.mode = 'showing'
            console.log(`[PLAYER] Track téléchargé activé ${track.language}: mode="${textTrack.mode}", cues=${cuesCount}`)
          } else {
            console.error(`[PLAYER] Track téléchargé "${track.language}" non trouvé après chargement`)
          }
        })

        trackElement.addEventListener('error', (e) => {
          console.error(`[PLAYER] Erreur track téléchargé ${track.language}:`, e)
          console.error(`[PLAYER] URL: ${trackElement.src}`)
          trackElement.remove()
        })

        return
      }

      // Vérifier si on a des textTracks natifs disponibles
      const textTracks = Array.from(video.textTracks)

      // Pour les MP4 avec sous-titres intégrés, utiliser les textTracks natifs
      let nativeTrack: TextTrack | null = null

      // PRIORITÉ 1: Utiliser directement l'index si disponible
      if (textTracks.length > 0 && idx !== null && idx >= 0 && idx < textTracks.length) {
        nativeTrack = textTracks[idx]
      } else if (textTracks.length > 0) {
        // PRIORITÉ 2: Chercher par correspondance language/label
        const trackLanguageShort = track.language.toLowerCase().slice(0, 2)
        const trackLanguageFull = track.language.toLowerCase()

        nativeTrack = textTracks.find((t, i) => {
          if (i === idx) return true
          if (t.language && (
            t.language.toLowerCase() === trackLanguageShort ||
            t.language.toLowerCase() === trackLanguageFull ||
            t.language.toLowerCase().slice(0, 2) === trackLanguageShort
          )) return true
          if (t.label && (
            t.label.toLowerCase().includes(trackLanguageShort) ||
            t.label.toLowerCase().includes(track.language.toLowerCase())
          )) return true
          return false
        }) || null
      }

      if (nativeTrack) {
        // Désactiver TOUTES les autres pistes AVANT d'activer celle-ci
        textTracks.forEach(t => {
          t.mode = 'disabled'
        })

        nativeTrack.mode = 'showing'

        // Vérifier que les cues sont chargés avant d'activer
        const activateTrack = () => {
          if (nativeTrack) {
            const cuesCount = nativeTrack.cues ? nativeTrack.cues.length : 0
            const activeCuesCount = nativeTrack.activeCues ? nativeTrack.activeCues.length : 0

            nativeTrack.mode = 'showing'

            if (cuesCount === 0) {
              console.warn(`[PLAYER] Aucun cue chargé`)
            } else if (activeCuesCount === 0 && video.currentTime > 1) {
              console.warn(`[PLAYER] Cues disponibles mais aucun actif au temps ${video.currentTime.toFixed(1)}s`)
            }

            // Vérifier périodiquement que le track reste activé
            let checkCount = 0
            const checkInterval = setInterval(() => {
              checkCount++
              if (!nativeTrack || checkCount > 20) {
                clearInterval(checkInterval)
                return
              }

              const allTracks = Array.from(video.textTracks)
              const otherShowingTracks = allTracks.filter(t => t !== nativeTrack && t.mode === 'showing')
              if (otherShowingTracks.length > 0) {
                console.warn(`[PLAYER] Détection de ${otherShowingTracks.length} autre(s) piste(s) en mode 'showing', désactivation...`)
                otherShowingTracks.forEach(t => t.mode = 'disabled')
              }

              if (nativeTrack.mode !== 'showing') {
                console.warn(`[PLAYER] Le track n'est plus en mode "showing", réactivation...`)
                nativeTrack.mode = 'showing'
              }

              const activeCues = nativeTrack.activeCues ? nativeTrack.activeCues.length : 0
              const totalCues = nativeTrack.cues ? nativeTrack.cues.length : 0

              if (activeCues > 0) {
                clearInterval(checkInterval)
              } else if (totalCues > 0 && video.currentTime > 2) {
                if (checkCount === 10) {
                  console.warn(`[PLAYER] Track "${nativeTrack.label}" : ${totalCues} cues disponibles mais aucun actif au temps ${video.currentTime.toFixed(1)}s`)
                }
              }
            }, 200)
          }
        }

        activateTrack()

        const cueChangeHandler = () => {
          if (nativeTrack && nativeTrack.mode !== 'showing') {
            nativeTrack.mode = 'showing'
          }
        }
        nativeTrack.addEventListener('cuechange', cueChangeHandler)

        setTimeout(() => {
          nativeTrack?.removeEventListener('cuechange', cueChangeHandler)
        }, 10000)

        return
      } else {
        // Fallback: utiliser /api/subtitles (comme pour HLS)
        const filepath = getFilepath()
        if (!filepath) return

        const trackElement = document.createElement('track')
        trackElement.kind = 'subtitles'
        trackElement.label = track.language
        trackElement.srclang = track.language.toLowerCase().slice(0, 2)
        trackElement.src = `/api/subtitles?path=${encodeURIComponent(filepath)}&track=${track.index}`
        trackElement.default = true

        video.appendChild(trackElement)

        trackElement.addEventListener('load', () => {
          const textTrack = Array.from(video.textTracks).find(
            t => t.label === track.language
          )
          if (textTrack) {
            textTrack.mode = 'showing'
          }
        })

        trackElement.addEventListener('error', async (e) => {
          e.preventDefault()
          e.stopPropagation()
          console.error(`[PLAYER] Erreur chargement sous-titres: ${track.language}`)
          trackElement.remove()
          onError(`Impossible de charger les sous-titres "${track.language}"`)
          setSelectedSubtitle(null)
          setTimeout(() => onError(null), 5000)
        })
      }
    } else {
      // Pour HLS : utiliser l'API /api/subtitles pour extraire les sous-titres
      console.log(`[PLAYER] Gestion sous-titres HLS`)

      const existingTracks = video.querySelectorAll('track')
      console.log(`[PLAYER] Suppression ${existingTracks.length} pistes existantes`)
      existingTracks.forEach(t => t.remove())

      Array.from(video.textTracks).forEach(t => {
        t.mode = 'disabled'
      })

      if (idx === null) {
        console.log('[PLAYER] Sous-titres désactivés')
        return
      }

      const track = subtitleTracks[idx]
      const filepath = getFilepath()

      if (!filepath || !track) {
        console.error(`[PLAYER] Filepath ou track manquant`)
        return
      }

      // Pour les fichiers pré-transcodés avec VTT, utiliser l'API dédiée
      let subtitleUrl: string
      if (track.vttFile) {
        subtitleUrl = `/api/hls/subtitles?path=${encodeURIComponent(filepath)}&file=${encodeURIComponent(track.vttFile)}`
      } else {
        subtitleUrl = `/api/subtitles?path=${encodeURIComponent(filepath)}&track=${track.index}`
      }

      console.log(`[PLAYER] Chargement manuel des sous-titres...`)

      const abortController = new AbortController()
      subtitleAbortControllerRef.current = abortController

      fetch(subtitleUrl, { signal: abortController.signal })
        .then(async (response) => {
          if (response.status !== 200) {
            const errorText = await response.text()
            console.error(`[PLAYER] Erreur API subtitles:`, errorText.slice(0, 300))
            onError(`Impossible de charger les sous-titres: ${response.status}`)
            return
          }

          const vttContent = await response.text()
          console.log(`[PLAYER] Sous-titres reçus: ${vttContent.length} caractères`)

          const blob = new Blob([vttContent], { type: 'text/vtt' })
          const blobUrl = URL.createObjectURL(blob)

          const trackElement = document.createElement('track')
          trackElement.kind = 'subtitles'
          trackElement.label = track.language
          trackElement.srclang = track.language.toLowerCase().slice(0, 2)
          trackElement.default = true
          trackElement.src = blobUrl

          video.appendChild(trackElement)

          setTimeout(() => {
            const textTrack = Array.from(video.textTracks).find(
              t => t.label === track.language
            )

            if (textTrack) {
              textTrack.mode = 'showing'
              console.log(`[PLAYER] TextTrack activé: ${textTrack.label}, cues=${textTrack.cues?.length || 0}`)

              const checkInterval = setInterval(() => {
                if (textTrack.activeCues && textTrack.activeCues.length > 0) {
                  console.log(`[PLAYER] Sous-titres visibles ! ${textTrack.activeCues.length} cues actifs`)
                  clearInterval(checkInterval)
                }
              }, 500)

              setTimeout(() => clearInterval(checkInterval), 10000)
            }
          }, 100)
        })
        .catch((err) => {
          if (err.name === 'AbortError') return

          console.error(`[PLAYER] Erreur fetch subtitles:`, err)
          console.error(`[PLAYER] Message:`, err.message)
          console.error(`[PLAYER] Stack:`, err.stack)
          onError(`Erreur chargement sous-titres: ${err.message}`)
        })
    }
  }, [subtitleTracks, getFilepath, src, subtitleOffset, videoRef, onError, onCloseSettings])

  // Appliquer les sous-titres préférés après chargement des pistes
  useEffect(() => {
    if (pendingSubtitleApplyRef.current !== null && subtitleTracks.length > 0 && videoRef.current) {
      const idx = pendingSubtitleApplyRef.current
      pendingSubtitleApplyRef.current = null

      if (idx >= 0 && idx < subtitleTracks.length) {
        const timer = setTimeout(() => {
          console.log(`[PLAYER] Application sous-titres préférés: piste ${idx} (${subtitleTracks[idx]?.language})`)
          handleSubtitleChange(idx)
        }, 1500)
        return () => clearTimeout(timer)
      }
    }
  }, [subtitleTracks, handleSubtitleChange, videoRef])

  // Ajuster l'offset des sous-titres téléchargés
  const handleSubtitleOffsetChange = useCallback((delta: number) => {
    const newOffset = subtitleOffset + delta
    setSubtitleOffset(newOffset)
    if (selectedSubtitle !== null) {
      const currentTrack = subtitleTracks[selectedSubtitle]
      if (currentTrack && (currentTrack as SubtitleTrack & { isDownloaded?: boolean }).isDownloaded) {
        handleSubtitleChange(selectedSubtitle)
      }
    }
  }, [subtitleOffset, selectedSubtitle, subtitleTracks, handleSubtitleChange])

  // Réinitialiser l'offset
  const handleSubtitleOffsetReset = useCallback(() => {
    setSubtitleOffset(0)
    if (selectedSubtitle !== null) {
      const currentTrack = subtitleTracks[selectedSubtitle]
      if (currentTrack && (currentTrack as SubtitleTrack & { isDownloaded?: boolean }).isDownloaded) {
        handleSubtitleChange(selectedSubtitle)
      }
    }
  }, [selectedSubtitle, subtitleTracks, handleSubtitleChange])

  // Télécharger des sous-titres depuis OpenSubtitles (FR + EN)
  const handleDownloadOpenSubtitles = useCallback(async () => {
    if (isDownloadingSubtitles) return

    const filepath = getFilepath()
    if (!filepath) {
      onError('Impossible de récupérer le chemin du fichier')
      setTimeout(() => onError(null), 3000)
      return
    }

    setIsDownloadingSubtitles(true)
    onCloseSettings?.()

    try {
      const languages = ['fr', 'en']
      const downloadedTracks: SubtitleTrack[] = []

      for (const lang of languages) {
        try {
          console.log(`[PLAYER] Téléchargement sous-titre ${lang.toUpperCase()}...`)
          const fetchUrl = `/api/subtitles/fetch?path=${encodeURIComponent(filepath)}&lang=${lang}`

          const response = await fetch(fetchUrl)

          if (response.ok) {
            const contentType = response.headers.get('content-type') || ''
            const responseText = await response.text()

            if (contentType.includes('application/json') || responseText.trim().startsWith('{')) {
              try {
                const errorData = JSON.parse(responseText)
                const errorMsg = errorData.message || errorData.error || 'Erreur inconnue'
                console.warn(`[PLAYER] Erreur API: ${errorMsg}`)

                if (errorData.requiresVip || errorMsg.toLowerCase().includes('vip')) {
                  onError('OpenSubtitles requiert un compte VIP. Cette fonctionnalité n\'est pas disponible pour le moment.')
                  setTimeout(() => onError(null), 8000)
                }

                continue
              } catch {
                // Pas du JSON valide, continuer
              }
            }

            if (!responseText.trim().startsWith('WEBVTT')) {
              console.warn(`[PLAYER] Réponse ne semble pas être du WebVTT valide`)
              continue
            }

            const vttUrl = `/api/subtitles/fetch?path=${encodeURIComponent(filepath)}&lang=${lang}${subtitleOffset !== 0 ? `&offset=${subtitleOffset}` : ''}`

            if (videoRef.current) {
              const trackElement = document.createElement('track')
              trackElement.kind = 'subtitles'
              trackElement.label = lang === 'fr' ? 'Français' : 'English'
              trackElement.srclang = lang
              trackElement.src = vttUrl
              trackElement.default = false

              videoRef.current.appendChild(trackElement)

              trackElement.addEventListener('load', () => {
                console.log(`[PLAYER] Track ${lang.toUpperCase()} chargé`)
                const textTrack = Array.from(videoRef.current!.textTracks).find(
                  t => t.label === (lang === 'fr' ? 'Français' : 'English')
                )
                if (textTrack) {
                  const activateDownloadedTrack = () => {
                    const currentCuesCount = textTrack.cues ? textTrack.cues.length : 0

                    if (currentCuesCount > 0) {
                      textTrack.mode = 'showing'
                      console.log(`[PLAYER] Track activé (mode=showing), ${currentCuesCount} cues disponibles`)
                    } else {
                      console.warn(`[PLAYER] Aucun cue chargé, réessai dans 500ms...`)
                      setTimeout(() => {
                        const retryCuesCount = textTrack.cues ? textTrack.cues.length : 0
                        textTrack.mode = 'showing'
                        if (retryCuesCount > 0) {
                          console.log(`[PLAYER] Track activé après délai, ${retryCuesCount} cues disponibles`)
                        } else {
                          console.warn(`[PLAYER] Track activé sans cues (ils arriveront plus tard)`)
                        }
                      }, 500)
                    }
                  }

                  const cueChangeHandler = () => {
                    // Détection des cues actifs
                  }
                  textTrack.addEventListener('cuechange', cueChangeHandler)

                  let checkInterval: NodeJS.Timeout | null = null
                  const startChecking = () => {
                    if (checkInterval) return

                    checkInterval = setInterval(() => {
                      const activeCuesCount = textTrack.activeCues ? textTrack.activeCues.length : 0
                      const currentVideoTime = videoRef.current?.currentTime || 0

                      if (activeCuesCount > 0) {
                        console.log(`[PLAYER] Cues actifs détectés: ${activeCuesCount} cues au temps ${currentVideoTime.toFixed(1)}s`)
                        if (checkInterval) {
                          clearInterval(checkInterval)
                          checkInterval = null
                        }
                      } else if (currentVideoTime > 5 && textTrack.mode === 'showing') {
                        console.warn(`[PLAYER] Aucun cue actif après ${currentVideoTime.toFixed(1)}s malgré le track en mode 'showing'`)
                      }
                    }, 1000)
                  }

                  videoRef.current?.addEventListener('play', startChecking, { once: true })
                  activateDownloadedTrack()
                } else {
                  console.error(`[PLAYER] Track "${lang === 'fr' ? 'Français' : 'English'}" non trouvé dans textTracks`)
                }
              })

              trackElement.addEventListener('error', async (e) => {
                console.error(`[PLAYER] Erreur chargement sous-titre téléchargé ${lang.toUpperCase()}:`, e)
                console.error(`[PLAYER] URL track: ${trackElement.src}`)

                try {
                  const testResponse = await fetch(trackElement.src)
                  const testData = await testResponse.text()
                  console.error(`[PLAYER] Réponse API (${testResponse.status}):`, testData.substring(0, 200))
                } catch (err) {
                  console.error(`[PLAYER] Erreur test API:`, err)
                }

                trackElement.remove()
              })

              setTimeout(() => {
                if (trackElement.parentNode) {
                  const currentSrc = trackElement.src
                  trackElement.src = ''
                  trackElement.src = currentSrc
                }
              }, 100)

              downloadedTracks.push({
                index: subtitleTracks.length + downloadedTracks.length,
                language: lang === 'fr' ? 'Français' : 'English',
                title: `Téléchargé depuis OpenSubtitles`,
                isDownloaded: true,
                sourceUrl: vttUrl
              } as SubtitleTrack)
            }
          }
        } catch (err) {
          console.error(`[PLAYER] Erreur téléchargement ${lang}:`, err)
        }
      }

      if (downloadedTracks.length > 0) {
        setSubtitleTracks(prev => [...prev, ...downloadedTracks])

        let activationAttempts = 0
        const maxAttempts = 5

        const tryActivateTrack = () => {
          if (!videoRef.current) return

          const allTextTracks = Array.from(videoRef.current.textTracks)

          const frenchTrack = allTextTracks.find(t =>
            t.label === 'Français' || t.language === 'fr' || t.language?.toLowerCase().startsWith('fr')
          )

          if (frenchTrack) {
            const cuesCount = frenchTrack.cues ? frenchTrack.cues.length : 0

            if (cuesCount > 0) {
              frenchTrack.mode = 'showing'
              console.log(`[PLAYER] Track français activé: mode="${frenchTrack.mode}", cues=${cuesCount}`)
              setSelectedSubtitle(subtitleTracks.length)
              return true
            } else if (activationAttempts < maxAttempts - 1) {
              activationAttempts++
              setTimeout(tryActivateTrack, 500)
              return false
            } else {
              frenchTrack.mode = 'showing'
              console.log(`[PLAYER] Track français activé sans cues (dernière tentative)`)
              setSelectedSubtitle(subtitleTracks.length)
              return true
            }
          } else {
            console.warn(`[PLAYER] Track français non trouvé, activation du premier track téléchargé`)
            const firstDownloadedIdx = subtitleTracks.length
            if (firstDownloadedIdx < allTextTracks.length) {
              const track = allTextTracks[firstDownloadedIdx]
              const cuesCount = track.cues ? track.cues.length : 0

              if (cuesCount > 0 || activationAttempts >= maxAttempts - 1) {
                track.mode = 'showing'
                console.log(`[PLAYER] Premier track activé (index ${firstDownloadedIdx}), cues=${cuesCount}`)
                setSelectedSubtitle(firstDownloadedIdx)
                return true
              } else {
                activationAttempts++
                setTimeout(tryActivateTrack, 500)
                return false
              }
            }
          }
          return false
        }

        setTimeout(tryActivateTrack, 1000)
        console.log(`[PLAYER] ${downloadedTracks.length} sous-titre(s) téléchargé(s) depuis OpenSubtitles`)
      } else {
        onError('Aucun sous-titre trouvé sur OpenSubtitles')
        setTimeout(() => onError(null), 5000)
      }
    } catch (dlError) {
      console.error('[PLAYER] Erreur téléchargement sous-titres:', dlError)
      onError('Erreur lors du téléchargement des sous-titres')
      setTimeout(() => onError(null), 5000)
    } finally {
      setIsDownloadingSubtitles(false)
    }
  }, [isDownloadingSubtitles, getFilepath, subtitleOffset, subtitleTracks, videoRef, onError, onCloseSettings])

  return {
    subtitleTracks,
    selectedSubtitle,
    subtitleOffset,
    isDownloadingSubtitles,
    selectedSubtitleRef,
    pendingSubtitleApplyRef,
    subtitleAbortControllerRef,
    setSubtitleTracks,
    setSelectedSubtitle,
    handleSubtitleChange,
    handleSubtitleOffsetChange,
    handleSubtitleOffsetReset,
    handleDownloadOpenSubtitles
  }
}
