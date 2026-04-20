# Player Mode

## When It Activates

URL path starts with `/watch`, `/shorts/`, `/live/`, `/clip/`, or `/embed/`. `NodexPageScoped` creates a `YouTubeController` instance.

## How Controls Work

Nodex dispatches synthetic `KeyboardEvent` objects targeting the YouTube player. YouTube's own keyboard listener handles everything — Nodex doesn't call any YouTube JS API directly.

```js
const event = new KeyboardEvent('keydown', {
  key, code, keyCode,
  bubbles: true,
  cancelable: true,
  composed: true,   // must cross Shadow DOM boundaries
})
target.dispatchEvent(event)
// then matching 'keyup' event
```

**Target priority:** `document.querySelector('#movie_player')` → `document.body`

## Keyboard Shortcut Reference

| Action | Key | keyCode |
|---|---|---|
| Play / Pause | `k` | 75 |
| Volume Up | `ArrowUp` | 38 |
| Volume Down | `ArrowDown` | 40 |
| Mute / Unmute | `m` | 77 |
| Rewind 10s | `j` | 74 |
| Skip 10s | `l` | 76 |
| Next video | `N` (Shift+N) | 78 |
| Previous video | `P` (Shift+P) | 80 |

## Ad Safety

During ads, most commands are suppressed to prevent disrupting ad playback (which could confuse YouTube's ad system):

**Allowed during ads:**
- VOL_UP, VOL_DOWN, MUTE

**Blocked during ads:**
- PLAY_PAUSE, REWIND, SKIP, NEXT, PREV

Ad detection:
```js
document.querySelector('#movie_player.ad-showing') !== null
|| document.querySelector('.ytp-ad-player-overlay') !== null
```

## Shadow DOM Penetration

The previous-video button may be inside a Shadow Root. `querySelectorDeep()` traverses open shadow trees recursively:

```js
function querySelectorDeep(root, selector) {
  const found = root.querySelector(selector)
  if (found) return found
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) {
      const inner = querySelectorDeep(el.shadowRoot, selector)
      if (inner) return inner
    }
  }
  return null
}
```

## Default Gesture Map (Player)

```
HEAD_LEFT   → Rewind 10s
HEAD_RIGHT  → Skip 10s
HEAD_UP     → Volume Up
HEAD_DOWN   → Volume Down
TILT_LEFT   → Previous video
TILT_RIGHT  → Next video
EYES_CLOSED → Play/Pause
EYES_HOLD   → (none)
MOUTH_OPEN  → Mute
```

All mappings are user-editable in the side panel.

## Auto-Pause on Face Loss

If no landmarks arrive for `_noFaceTimeoutMs: 2000`, the player is automatically paused (PLAY_PAUSE dispatched). Resumes when face is detected again. Only fires if Nodex itself detects the face loss (not from manual tab switch).
