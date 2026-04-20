# Debug: Performance Issues (FPS Drop)

## Symptoms

- HUD metrics panel updates sluggishly (values freeze then jump)
- Gesture response feels laggy (>500ms between head movement and YouTube action)
- Chrome task manager shows high CPU for the YouTube tab
- Tracking loops stutter even when the video is paused

## Quick Check

1. Open Chrome task manager: `Shift+Esc`
2. Find the YouTube tab row and the extension rows
3. Check CPU %. A healthy Nodex installation: < 15% CPU on modern hardware

## Known Performance Constraints

### Zero-Allocation Rule in rAF Loops

Code inside `requestAnimationFrame` callbacks (gesture tracking, HUD updates, focus ring positioning) must not allocate new objects, arrays, or functions. Garbage collection in a 30fps loop causes stutters.

**Find violations:**
```js
// BAD — allocates new array each frame
const pts = landmarks.map(l => [l.x, l.y])

// GOOD — pre-allocate in constructor, mutate in-place
this._pts = new Float32Array(landmarks.length * 2)
// ...in loop:
for (let i = 0; i < landmarks.length; i++) {
  this._pts[i * 2] = landmarks[i].x
  this._pts[i * 2 + 1] = landmarks[i].y
}
```

Also avoid: inline arrow functions `() => {}`, object literals `{}`, spread `...`, inside rAF loops.

### MutationObserver Overfire

If the debounce (`MUTATION_DEBOUNCE_MS: 800`) is removed or reduced, the card scan can run dozens of times per second during scroll, blocking the main thread.

Check: is `MUTATION_DEBOUNCE_MS` still 800ms in `BrowseController.js`?

### MediaPipe GPU vs CPU

MediaPipe tries GPU backend first. If GPU is unavailable (e.g. display scaling issues, headless), it falls back to CPU WASM which is ~3× slower.

**Check which backend is active:**
```js
// Run in DevTools console on YouTube tab
// Look for MediaPipe backend logs in console
```

GPU fallback is MediaPipe's internal decision — Nodex doesn't control it.

### window.postMessage Overhead

Landmark arrays are ~478 objects × 3 numbers each, posted 30× per second. This is ~43,000 numbers/sec over postMessage.

`METRICS_SEND_INTERVAL: 5` — only forward metrics to side panel every 5 frames. If you reduce this to 1, side panel updates 30×/sec and message overhead increases significantly.

## Profiling

1. YouTube tab → DevTools → Performance tab
2. Record 5–10 seconds while moving head
3. Look for long tasks (red bars in main thread timeline)
4. Check flame chart: is time concentrated in MediaPipe WASM? In `processLandmarks`? In `BrowseController.scanCards()`?

## Common Causes

| Symptom | Likely Cause |
|---|---|
| Stutter every ~1s | GC pressure from object allocation in rAF loop |
| Stutter on scroll | MutationObserver debounce too short |
| Constant high CPU | MediaPipe fell back to CPU mode |
| Lag only in Browse mode | `scanCards()` running too often |
| Lag only in metrics panel | `METRICS_SEND_INTERVAL` set too low |

## FRAME_BUDGET_MS

`FRAME_BUDGET_MS: 20` in `content/index.js` is used for perf warnings in logs. If you see `[Nodex] frame over budget` in the console, the processing pipeline exceeded 20ms. This is a symptom indicator, not an enforced limit.
