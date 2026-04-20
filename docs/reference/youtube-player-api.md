# YouTube Player — How Nodex Controls It

Nodex does **not** use the YouTube IFrame Player API or any YouTube JS object. All control is via synthetic keyboard events, which is more reliable and doesn't require accessing YouTube internals.

## Keyboard-Based Control

YouTube's player listens for `keydown` events. Nodex dispatches:

```js
const event = new KeyboardEvent('keydown', {
  key: 'k',
  code: 'KeyK',
  keyCode: 75,
  bubbles: true,
  cancelable: true,
  composed: true,   // crosses Shadow DOM boundaries
})
document.querySelector('#movie_player').dispatchEvent(event)
// followed immediately by matching 'keyup'
```

## Full Shortcut Reference

| Key | keyCode | Action |
|---|---|---|
| `k` | 75 | Toggle play/pause |
| `j` | 74 | Rewind 10 seconds |
| `l` | 76 | Skip forward 10 seconds |
| `ArrowUp` | 38 | Volume +5% |
| `ArrowDown` | 40 | Volume −5% |
| `m` | 77 | Toggle mute |
| `N` (Shift+N) | 78 | Next video in queue |
| `P` (Shift+P) | 80 | Previous video |
| `f` | 70 | Toggle fullscreen (not used by Nodex) |
| `c` | 67 | Toggle captions (not used by Nodex) |

## Event Target Priority

1. `document.querySelector('#movie_player')` — preferred
2. `document.body` — fallback if player element not found

Both `keydown` and `keyup` are dispatched for each action.

## Why Not YouTube's JS API?

- YouTube's global `ytInitialPlayerResponse` and `ytplayer` objects are not stable across YouTube versions
- The IFrame API requires an embedded player (Nodex operates on the main YouTube page)
- Keyboard events are officially documented YouTube shortcuts and are unlikely to change
- No risk of breaking when YouTube updates its internal JS

## Ad Detection

```js
const inAd = document.querySelector('#movie_player.ad-showing') !== null
          || document.querySelector('.ytp-ad-player-overlay') !== null
```

During ads, only VOL_UP, VOL_DOWN, MUTE are dispatched. All others are suppressed.

## Previous Video Button (Shadow DOM)

`.ytp-prev-button` may be inside a Shadow Root. `querySelectorDeep()` in `YouTubeController.js` traverses open shadow trees recursively to find it. If not found, falls back to Shift+P keyboard shortcut.
