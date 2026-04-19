import { COMMANDS } from '../shared/constants/commands.js'

/**
 * YouTube keyboard shortcut map.
 * BACK is intercepted in NodexPageScoped.handleCommand() and never reaches here.
 * PREV and PLAY/PAUSE are handled inline in execute() before reaching KEY_MAP.
 */
const KEY_MAP = {
  [COMMANDS.PLAY]:       { key: 'k',       code: 'KeyK',    keyCode: 75 },
  [COMMANDS.PAUSE]:      { key: 'k',       code: 'KeyK',    keyCode: 75 },
  [COMMANDS.PLAY_PAUSE]: { key: 'k',       code: 'KeyK',    keyCode: 75 },
  [COMMANDS.VOL_UP]:     { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  [COMMANDS.VOL_DOWN]:   { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  [COMMANDS.MUTE]:       { key: 'm',       code: 'KeyM',    keyCode: 77 },
  [COMMANDS.REWIND]:     { key: 'j',       code: 'KeyJ',    keyCode: 74 },
  [COMMANDS.SKIP]:       { key: 'l',       code: 'KeyL',    keyCode: 76 },
  // Shift+N = next video in playlist (YouTube's native shortcut)
  [COMMANDS.NEXT]:       { key: 'N',       code: 'KeyN',    keyCode: 78, shiftKey: true },
}

/**
 * Commands that are safe to fire during ad playback.
 * Seek / skip / play-pause are blocked — they interfere with the ad player.
 * Volume and mute are allowed — user still needs to control audio during ads.
 */
const AD_SAFE_COMMANDS = new Set([
  COMMANDS.VOL_UP,
  COMMANDS.VOL_DOWN,
  COMMANDS.MUTE,
])

/**
 * Returns true when an ad is currently playing or transitioning.
 * Two-selector approach:
 *   .ad-showing        — set on #movie_player during active video-ad playback
 *   .ytp-ad-player-overlay — the "Ad • X remaining" overlay (covers transition gaps
 *                            where .ad-showing briefly disappears before content starts)
 */
function isAdPlaying() {
  return (
    document.querySelector('#movie_player.ad-showing') !== null ||
    document.querySelector('.ytp-ad-player-overlay') !== null
  )
}

export class YouTubeController {
  execute(command) {
    // During ads: only pass through volume / mute — block everything else.
    // This prevents accidental seek/skip while still letting the user control audio.
    if (isAdPlaying() && !AD_SAFE_COMMANDS.has(command)) return false

    // PREV clicks the player's previous-video button — only present in playlists.
    // Do NOT fall through to _sendKey: there is no reliable keyboard shortcut for this
    // in YouTube, and the old code called _safeGoBack() which navigated away from the page.
    if (command === COMMANDS.PREV) {
      const prevBtn = document.querySelector('.ytp-prev-button')
      if (prevBtn) {
        prevBtn.click()
        return true
      }
      return false // Not in a playlist — do nothing rather than navigate away
    }

    // PLAY and PAUSE use the video element directly so they are not toggles —
    // 'k' key always toggles regardless of current state, which makes PLAY behave
    // identically to PAUSE. The video element API gives us true one-way control.
    if (command === COMMANDS.PLAY || command === COMMANDS.PAUSE) {
      const video = document.querySelector('video')
      if (video) {
        if (command === COMMANDS.PLAY) video.play().catch(() => {})
        else video.pause()
        return true
      }
      // No video element found — fall through to key dispatch as best-effort.
    }

    const mapping = KEY_MAP[command]
    if (!mapping) return false

    return this._sendKey(mapping)
  }

  /**
   * Dispatch both keydown + keyup on the best available target.
   *
   * Target priority:
   *   1. #movie_player (the player container — most reliable for YouTube's listeners)
   *   2. document.body  (fallback)
   *
   * Both events are dispatched so YouTube's key-hold detection and
   * single-press handlers both fire correctly.
   */
  _sendKey({ key, code, keyCode, shiftKey = false }) {
    try {
      // Prefer the player container; fall back to body.
      const target = document.querySelector('#movie_player') ?? document.body

      const opts = {
        key,
        code,
        keyCode,
        which: keyCode,
        shiftKey,
        bubbles:    true,
        cancelable: true,
        composed:   true,   // cross Shadow DOM boundary when needed
      }

      target.dispatchEvent(new KeyboardEvent('keydown', opts))
      // keyup must follow immediately so YouTube's release listeners run.
      target.dispatchEvent(new KeyboardEvent('keyup', opts))

      return true
    } catch (e) {
      console.error('[Nodex] Keyboard dispatch failed:', e)
      return false
    }
  }
}
