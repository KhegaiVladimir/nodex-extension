# Browse Mode

## When It Activates

`NodexPageScoped` checks the URL on creation. If path does not match `/watch`, `/shorts/`, `/live/`, `/clip/`, `/embed/` → Browse mode. Activates on home, search results, channel pages, playlists, etc.

## Card Discovery

`BrowseController` scans the page for navigable video cards using a priority-ordered selector list (see `docs/selectors.md`). Cards are re-scanned on `MutationObserver` events (debounced 800ms) and periodically every 15 seconds.

**Blacklist:** ad slots, promoted content, brand videos, commerce-badged items are excluded even if matched by selectors.

## Grid Layout Algorithm

Cards are sorted into a 2D grid by their `getBoundingClientRect()` positions:

1. **Row clustering:** cards within `Math.max(60, medianHeight × 0.5)` px vertically are grouped into rows. Fallback gap: 80px.
2. **Within each row:** cards sorted by left edge (ascending).
3. **Navigation:** weighted distance scoring picks the best next card.

```
Weighted distance = sqrt(Δprimary² + (Δorthogonal × 3)²)
```

Moving right → horizontal distance ×1, vertical ×3. This strongly prefers cards in the same row.

## Navigation Constants

| Constant | Value | Meaning |
|---|---|---|
| `ROW_BREAK_PX` | 48 | Vertical gap that separates rows |
| `ROW_SORT_TOL_PX` | 8 | Tolerance for "same row" classification |
| `GEOM_H_MIN` | 20px | Min horizontal separation for left/right picks |
| `GEOM_V_MIN` | 20px | Min vertical separation for up/down picks |
| `STICKY_COLUMN_IDLE_MS` | 2500 | Hold column index across vertical moves |
| `VERTICAL_SKIP_MS` | 1500 | Window for shelf-skip on rapid vertical moves |
| `BROWSE_COMMAND_COOLDOWN_MS` | 700 | Min gap between gesture commands |

## Focus Ring

A teal ring (`#64FFDA`) is positioned over the focused card using `getBoundingClientRect()` with `position: fixed`. It moves with animated CSS transitions (0.15s ease-out per dimension).

On navigation edge (no card in direction): border pulses red for 120ms.

## Card Scale

When a card is focused, `BrowseController` finds its container element (e.g. `ytd-rich-item-renderer`) and applies:
```css
transform: scale(1.05);
transition: transform 0.2s ease-out;
```

Previous card has its transform reset.

## Scroll Behavior

When focus moves to a card outside the viewport, the controller calls `card.scrollIntoView({ behavior: 'smooth', block: 'center' })`. Scroll position is tracked for `SCROLL_TRACK_MS: 400` to properly update focus ring position after scroll completes.

## Select (EYES_CLOSED)

Fires `card.click()` on the focused anchor element. YouTube's event handlers navigate to the video page.

## Back Navigation (TILT_LEFT)

Fires `window.history.back()`. Works on search and channel pages. On the home feed, it's a no-op (no history entry to go back to).

## Hint Toast

First time Browse mode activates, the HUD shows a brief hint toast explaining the gestures. Shown once per installation (gated by `nodex_browse_hint_shown` storage key).

## Adding a New Browse Action

1. Handle the gesture in `BrowseController.handleCommand(gesture)`
2. Add the gesture mapping to `DEFAULT_BROWSE_GESTURE_MAP` in `shared/constants/defaults.js`
3. Update side panel Browse mode gesture picker if needed
