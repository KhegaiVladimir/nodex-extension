import { COMMANDS } from '../shared/constants/commands.js'

/**
 * `document.querySelector` does not pierce open ShadowRoots. YouTube nests the
 * html5 chrome (`.ytp-prev-button`, etc.) under custom elements, so a flat query
 * often returns null even when the control is visible — PREV appeared "broken".
 * @param {ParentNode | null} root
 * @param {string} selector
 * @returns {Element | null}
 */
function querySelectorDeep(root, selector) {
  if (!root) return null
  try {
    if (root.nodeType === 1 && root.matches(selector)) return /** @type {Element} */ (root)
  } catch (_e) {
    return null
  }
  try {
    const hit = root.querySelector?.(selector)
    if (hit) return hit
  } catch (_e) {
    return null
  }
  if (root.shadowRoot) {
    const inShadow = querySelectorDeep(root.shadowRoot, selector)
    if (inShadow) return inShadow
  }
  for (const child of root.children || []) {
    const nested = querySelectorDeep(child, selector)
    if (nested) return nested
  }
  return null
}

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

    // Previous playlist / queue video: prefer the real control (works when visible),
    // then Shift+P (YouTube Help — same idea as Shift+N for NEXT). Flat
    // `querySelector('.ytp-prev-button')` misses controls inside Shadow DOM.
    if (command === COMMANDS.PREV) {
      const host = document.querySelector('#movie_player') ?? document.body

      // Try the real in-player prev button (playlist context).
      const prevBtn = querySelectorDeep(host, '.ytp-prev-button')
      const canClick =
        prevBtn &&
        !prevBtn.disabled &&
        prevBtn.getAttribute('aria-disabled') !== 'true'
      if (canClick) {
        try {
          prevBtn.click()
          return true
        } catch (e) {
          console.error('[Nodex] Prev button click failed:', e)
        }
      }

      // Shift+P: YouTube playlist shortcut (no-op outside playlists).
      this._sendKey({ key: 'P', code: 'KeyP', keyCode: 80, shiftKey: true })

      // Final fallback: browser history.back() so TILT_LEFT always "goes back"
      // even when there is no playlist prev button (the common single-video case).
      window.history.back()
      return true
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
