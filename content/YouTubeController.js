import { COMMANDS } from '../shared/constants/commands.js'

const DEFAULT_VOLUME_STEP = 5
const REWIND_SEC = 10
const SKIP_SEC = 10

export class YouTubeController {
  constructor() {
    this._volumeStep = DEFAULT_VOLUME_STEP / 100
  }

  /**
   * Finds the main YouTube video element.
   * Skips ads (.ad-showing) and videos that haven't loaded yet.
   * Never cached — called fresh every time.
   * @returns {HTMLVideoElement|null}
   */
  _getVideo() {
    if (document.querySelector('.ad-showing')) return null

    const videos = document.querySelectorAll('video')
    for (const v of videos) {
      if (v.readyState >= 2 && v.duration > 0) return v
    }
    return null
  }

  /**
   * Sets the volume adjustment step.
   * @param {number} percent - 1–100
   */
  setVolumeStep(percent) {
    this._volumeStep = Math.max(0.01, Math.min(1, percent / 100))
  }

  /**
   * Executes a media command on the current YouTube video.
   * @param {string} command - one of COMMANDS.*
   * @returns {boolean} true if the command was applied
   */
  execute(command) {
    const video = this._getVideo()

    if (command === COMMANDS.NEXT) return this._clickNav('.ytp-next-button')
    if (command === COMMANDS.PREV) return this._clickNav('.ytp-prev-button')

    if (!video) return false

    switch (command) {
      case COMMANDS.PLAY:
        video.play()
        return true

      case COMMANDS.PAUSE:
        video.pause()
        return true

      case COMMANDS.PLAY_PAUSE:
        video.paused ? video.play() : video.pause()
        return true

      case COMMANDS.VOL_UP:
        video.volume = Math.min(1, video.volume + this._volumeStep)
        return true

      case COMMANDS.VOL_DOWN:
        video.volume = Math.max(0, video.volume - this._volumeStep)
        return true

      case COMMANDS.MUTE:
        video.muted = !video.muted
        return true

      case COMMANDS.REWIND:
        video.currentTime = Math.max(0, video.currentTime - REWIND_SEC)
        return true

      case COMMANDS.SKIP:
        video.currentTime = Math.min(video.duration, video.currentTime + SKIP_SEC)
        return true

      default:
        return false
    }
  }

  /**
   * Clicks a YouTube player navigation button as fallback.
   * Falls back to video seek if the button isn't found.
   * @param {string} selector - CSS selector for the button
   * @returns {boolean}
   */
  _clickNav(selector) {
    const btn = document.querySelector(selector)
    if (btn) {
      btn.click()
      return true
    }
    return false
  }
}
