# YouTube Integration

## SPA Navigation

YouTube is a Polymer/Custom Elements SPA. Key rules:

- `DOMContentLoaded` fires **once** on initial tab load. Useless for detecting page changes.
- `yt-navigate-finish` fires on every client-side navigation (search, video click, home, etc.)
- On `yt-navigate-finish`: destroy `NodexPageScoped`, recreate it for the new URL context.
- Camera (`NodexPersistent`) **never** restarts on navigation — only once per tab.

## URL Routing

```js
const PLAYER_PATHS = ['/watch', '/shorts/', '/live/', '/clip/', '/embed/']
```

If `window.location.pathname` starts with any of these → **Player Mode**.
Everything else (home, search, channel pages, playlists) → **Browse Mode**.

Mode is determined at `NodexPageScoped` creation time.

## Player Mode — Keyboard Shortcuts

YouTube's player listens for keyboard events on `#movie_player` or `document.body`. Nodex dispatches synthetic events:

```js
const ev = new KeyboardEvent('keydown', {
  key, code, keyCode,
  bubbles: true,
  cancelable: true,
  composed: true,   // crosses shadow DOM boundaries
})
```

Events are dispatched to `#movie_player` first, falling back to `document.body`.

**Shortcut map:**

| Action | Key |
|---|---|
| Play / Pause | `k` |
| Volume Up | `ArrowUp` |
| Volume Down | `ArrowDown` |
| Mute | `m` |
| Rewind 10s | `j` |
| Skip 10s | `l` |
| Next video | `N` (Shift+N) |
| Previous video | `P` (Shift+P) |

Both `keydown` and `keyup` are dispatched per action.

## Ad Safety

During ads (`#movie_player.ad-showing` or `.ytp-ad-player-overlay`):

- **Allowed:** VOL_UP, VOL_DOWN, MUTE
- **Blocked:** PLAY_PAUSE, REWIND, SKIP, NEXT, PREV

This prevents accidental ad skip or playback interference.

## Shadow DOM Penetration

The previous-video button (`<ytp-prev-button>`) may be inside a Shadow Root. `BrowseController` and `YouTubeController` use a `querySelectorDeep()` helper that traverses open Shadow Roots recursively.

## Browse Mode — Feed Selectors

See `docs/selectors.md` for the complete, dated selector list.

## MutationObserver Usage

`BrowseController` uses a `MutationObserver` on feed containers to detect new cards loaded by infinite scroll:

- Observer roots: `ytd-rich-grid-renderer`, `ytd-section-list-renderer`, `ytd-watch-next-secondary-results-renderer`
- Debounced: `MUTATION_DEBOUNCE_MS: 800` — prevents locking the main thread
- Periodic fallback scan: `PERIODIC_SCAN_MS: 15000` for edge cases

## Event for Page Transitions

```js
window.addEventListener('yt-navigate-finish', () => {
  // destroy old NodexPageScoped, create new one
})
```

This is the **only** reliable hook for YouTube navigation. Do not use `popstate`, `hashchange`, or `MutationObserver` on the page title.
