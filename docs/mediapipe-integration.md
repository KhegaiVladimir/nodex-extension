# MediaPipe Integration

## Assets

All MediaPipe files are local — no CDN, no network requests.

```
assets/mediapipe/
├── face_mesh.js          ← main MediaPipe JS module
├── camera_utils.js       ← camera helper
└── *.wasm / *.task       ← WASM binaries and model files
```

Always reference via:
```js
chrome.runtime.getURL('assets/mediapipe/face_mesh.js')
```

Never use relative paths — Vite changes output paths during build.

## Feature Flag: REFINE_LANDMARKS

```js
// shared/constants/mediapipe.js
export const REFINE_LANDMARKS = false
```

| Value | Landmarks | Blink detection | Iris tracking |
|---|---|---|---|
| `false` | 468 | EAR (6-point eye formula) | Disabled |
| `true` | 478 (+ iris ring) | EAR or iris ratio | Enabled |

Currently `false` in production. Iris-based blink is more accurate but requires extra landmarks. If you enable this, update `computeBlinkThreshold` — it returns `signalType: 'iris'` automatically.

## Landmark Count Validation

The ISOLATED world validates incoming landmark arrays:
- Accepts 468 or 478 — anything else is dropped
- Each landmark must have numeric `x`, `y`, `z`
- Malformed frames are silently discarded

## Backend Selection

MediaPipe Face Mesh attempts GPU backend (WebGL) first, falls back to CPU WASM SIMD. This is MediaPipe's internal logic — Nodex does not override it.

## Camera Release

On extension deactivation or tab close, the bridge calls:
```js
video.srcObject.getTracks().forEach(track => track.stop())
```

This releases the hardware camera indicator. Always do this — failing to stop tracks leaves the camera LED on.

## WASM Patching (Build Time)

MediaPipe WASM files require patching to work in a Chrome extension context. The build script handles this automatically via the `buildContentScript()` Vite plugin (custom `closeBundle` hook). Do not manually edit WASM binaries.

## Frame Rate

MediaPipe targets ~30fps. Actual rate depends on machine performance and GPU availability. The `FRAME_BUDGET_MS: 20` constant in `content/index.js` is used for perf warnings.

## No-Face Handling

If landmarks stop arriving for `LANDMARK_TIMEOUT_MS: 5000`, the watchdog in `NodexPersistent` fires a recovery sequence:
1. Posts `BRIDGE_WINDOW.HEALTH_CHECK` to MAIN world
2. Waits for `HEALTH_CHECK_RESULT`
3. If no response after `WATCHDOG_INTERVAL_MS: 3000`, restarts the bridge
4. Max `MAX_RESTART_ATTEMPTS: 3` before giving up

The auto-pause feature separately pauses YouTube after `_noFaceTimeoutMs: 2000` of no face.
