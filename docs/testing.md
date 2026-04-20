# Testing

There are no automated tests. All testing is manual.

## Local Dev Workflow

```bash
npm run dev        # start Vite in watch mode
```

1. Load unpacked: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`
2. Navigate to `youtube.com`
3. Edit a source file — Vite rebuilds in ~100ms
4. Click the reload button on the extension at `chrome://extensions`
5. Refresh the YouTube tab

**Tip:** Pin `chrome://extensions` in a tab. After each build, one click reloads the extension.

## Console Access

| Context | How to open DevTools |
|---|---|
| Side panel | Right-click inside panel → Inspect |
| Content script (ISOLATED world) | YouTube tab DevTools (F12) → Console. Filter by "content" or "Nodex" |
| MAIN world (bridge) | Same YouTube tab DevTools |
| Service worker | `chrome://extensions` → Nodex → "Service Worker" link |

**Note:** MAIN and ISOLATED world logs both appear in the YouTube tab console. Distinguish by prefix: `[Nodex]` is used in most log calls.

## Things to Test After Any Change

### Gesture detection

1. Open any YouTube video (`/watch`)
2. Check HUD metrics panel (bottom-right) — verify YAW/PITCH/ROLL/EAR update in real time
3. Move head left/right/up/down — verify video rewinds/skips/volume changes
4. Blink slowly — verify play/pause triggers
5. Check no accidental triggers during head movement (EAR suppression working)

### Browse mode

1. Navigate to YouTube home feed
2. Verify focus ring appears on a card
3. Move head left/right/up/down — verify ring moves to adjacent cards
4. Blink to select — verify navigation to video
5. Tilt left — verify back navigation
6. Scroll down — verify new cards are discovered

### SPA navigation

1. While in Player mode, click "Home" — verify mode switches to Browse, HUD updates
2. Click a video — verify mode switches back to Player
3. Repeat 5 times — verify camera never restarts (no camera permission prompt)

### Onboarding

1. Clear `onboarding_complete` from storage: DevTools → Application → Storage → `chrome-extension://...` → Clear
2. Refresh YouTube — verify overlay appears
3. Complete all 5 steps
4. Verify overlay disappears and YouTube is usable
5. Verify `onboarding_complete: true` in storage

### After changing selectors

1. Open youtube.com home feed
2. DevTools Console: `document.querySelectorAll('YOUR_SELECTOR').length`
3. Expected: > 0
4. Navigate to a search results page and repeat

### After changing EAR thresholds

1. Open any video with HUD metrics visible
2. Blink slowly and deliberately — should register (PLAY_PAUSE fires)
3. Blink rapidly several times quickly — should NOT register each one (minClosed frames filter)
4. Hold eyes closed 2 seconds — EYES_HOLD should fire
5. Move head while blinking — blink should NOT register (head movement suppression)

## Known Flaky Scenarios

- **First load after install:** MediaPipe may take 2–3 seconds to initialize. HUD shows "no face" briefly. Normal.
- **Camera permission:** If user denies permission, NODEX_CAMERA_DENIED fires and nothing works. No retry without page reload.
- **Very dark room:** EAR values become unreliable. Dynamic calibration may misfire. Out of scope.
