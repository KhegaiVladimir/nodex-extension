# Content Scripts — MAIN / ISOLATED World Split

## Why the Split Exists

YouTube enforces Trusted Types CSP. MediaPipe WASM requires `eval`-like compilation that Trusted Types blocks. Extension MAIN world scripts bypass the page CSP (they use the extension's own `wasm-unsafe-eval` policy). ISOLATED world scripts run inside the page CSP and cannot load MediaPipe.

**Rule:** MediaPipe lives in MAIN. Everything else lives in ISOLATED.

## MAIN World (`content/mediapipe-bridge.js`)

- Loads MediaPipe Face Mesh from `chrome.runtime.getURL('assets/mediapipe/...')`
- Runs camera via `getUserMedia`
- Processes ~30 FPS frames
- Posts landmark arrays to ISOLATED via `window.postMessage`
- Never touches the YouTube DOM directly
- Injected by manifest and by service worker on tab update

**Never import Chrome APIs here.** MAIN world has `chrome` available, but messaging between worlds must go through `window.postMessage` — not `chrome.runtime.sendMessage`.

## ISOLATED World (`content/index.js`)

Main orchestrator. Two class lifetimes:

### `NodexPersistent` — once per tab

Created when the content script first runs. Destroyed only if camera fails or tab closes.

- Receives landmarks via `window.addEventListener('message', ...)`
- Validates and routes landmarks to `GestureEngine`
- Hosts `_overlayMetricsListener` hook (OnboardingOverlay listens here)
- Runs watchdog: checks for landmark silence every `3000 ms`, triggers bridge recovery
- `MAX_RESTART_ATTEMPTS: 3` before giving up
- `RESTART_COOLDOWN_MS: 2000` between restart attempts
- `LANDMARK_TIMEOUT_MS: 5000` — silence before watchdog fires

### `NodexPageScoped` — recreated each SPA navigation

Created after `NodexPersistent` is ready, destroyed on each `yt-navigate-finish`.

- Instantiates `HUD`, `YouTubeController` or `BrowseController` based on URL
- Routes gesture events from `GestureEngine` to the appropriate controller
- `BROWSE_COMMAND_COOLDOWN_MS: 700` — min gap between gesture commands
- Cleans up all DOM nodes and listeners on destroy

## window.postMessage Protocol

All messages use `{ source: 'NODEX_*', data: ... }` shape and are validated on the receiving side.

| Message | Direction | Payload |
|---|---|---|
| `NODEX_START_CAMERA` | ISOLATED → MAIN | `{ extensionBaseUrl }` |
| `NODEX_STOP_CAMERA` | ISOLATED → MAIN | — |
| `NODEX_LANDMARKS` | MAIN → ISOLATED | `{ landmarks: LandmarkList }` |
| `NODEX_CAMERA_DENIED` | MAIN → ISOLATED | — |
| `NODEX_BRIDGE_ERROR` | MAIN → ISOLATED | `{ error: string }` |
| `NODEX_INJECT_MEDIAPIPE` | MAIN → Service Worker | — |
| `NODEX_INJECT_SCRIPT` | MAIN → Service Worker | `{ path, requestId }` |
| `BRIDGE_WINDOW.NO_FACE` | MAIN → ISOLATED | — |
| `BRIDGE_WINDOW.HEALTH_CHECK` | ISOLATED → MAIN | — |
| `BRIDGE_WINDOW.HEALTH_CHECK_RESULT` | MAIN → ISOLATED | — |

**Landmark validation:** accepts arrays of 468 or 478 objects (478 when `REFINE_LANDMARKS: true`). Each landmark must have numeric `x`, `y`, `z`.

## chrome.runtime.sendMessage Protocol

Content ↔ Service Worker ↔ Side Panel.

| Message type | Direction | Description |
|---|---|---|
| `CONTENT_TO_SIDEPANEL` | Content → SW → Panel | Engine status, metrics, calibration results |
| `SIDEPANEL_TO_CONTENT` | Panel → SW → Content | Settings update, start/stop engine |
| `REQUEST_STATUS` | Panel → SW → Content | Request current engine status |

The service worker is a pure relay — it reads the tab ID and forwards to the right target.

## Metrics Interval

`METRICS_SEND_INTERVAL: 5` — metrics are forwarded to the side panel every 5 landmark frames (not every frame) to reduce message overhead.

## Frame Budget

`FRAME_BUDGET_MS: 20` — expected time per landmark processing cycle at 30fps. Used for performance warnings, not enforced as a hard limit.
