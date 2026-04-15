# Nodex — context for AI and developers

In short: a **Chrome MV3 extension** for hands-free YouTube control with head/face gestures. **MediaPipe Face Mesh** runs in the content script, **React** in the side panel, and the **service worker** only relays messages.

## Three contexts (do not mix)

| Context | Folder | Role |
|---------|--------|------|
| Content | `content/` | Camera, MediaPipe, gestures, HUD, player and Browse control. |
| Side panel | `sidepanel/` | React UI: calibration, settings, gesture mapping. |
| Background | `background/` | Service worker: message bridge, no business logic. |

Messages only via constants in `shared/constants/messages.js`. Storage is `chrome.storage.local` through `shared/storage.js`, not `localStorage`.

## Important files (by role)

### Root

| File | Purpose |
|------|---------|
| `manifest.json` | MV3: permissions, content scripts (MAIN + ISOLATED), side panel, web_accessible_resources (MediaPipe). |
| `vite.config.js` | Two bundles: content → single-file IIFE; side panel → React. |
| `package.json` | Scripts: `build`, `dev`, `zip`, `prod`, `zip:source`. |

### Content script (main logic on YouTube)

| File | Purpose |
|------|---------|
| `content/index.js` | Entry: engine orchestration, Player/Browse modes, messaging. |
| `content/mediapipe-bridge.js` | MAIN world: load MediaPipe via `chrome.runtime.getURL`, no CDN. |
| `content/FaceEngine.js` | Face Mesh wrapper, camera frames. |
| `content/GestureEngine.js` | Gesture detection, hysteresis, cooldowns, command mapping. |
| `content/YouTubeController.js` | Player commands only via `HTMLVideoElement` (not `.ytp-*` selectors). |
| `content/BrowseController.js` | Browse mode: thumbnail grid, focus ring, rows/shelves, left/right/up/down gestures. |
| `content/HUD.js` | Metrics overlay in Shadow DOM. |

### Background

| File | Purpose |
|------|---------|
| `background/service-worker.js` | Relay `MSG.*` between tab and side panel + `webNavigation` if needed. |

### Side panel (React)

| File | Purpose |
|------|---------|
| `sidepanel/index.html` | UI entry. |
| `sidepanel/main.jsx` | React mount. |
| `sidepanel/App.jsx` | Screens: calibration, settings, gesture mapping (`useState`, no Router). |

### Shared (utils/constants have no Chrome API deps)

| File | Purpose |
|------|---------|
| `shared/constants/messages.js` | Message type enum. |
| `shared/constants/commands.js` | Commands (play, seek, browse…). |
| `shared/constants/gestures.js` | Gesture identifiers. |
| `shared/constants/defaults.js` | Default thresholds, cooldowns, mapping, constants like EYE_CLOSE_MIN_MS. |
| `shared/storage.js` | Wrapper over `chrome.storage.local`. |
| `shared/utils/gestureLogic.js` | yaw/pitch/roll, EAR, mouth ratio. |
| `shared/utils/thresholds.js` | Re-exports `DEFAULT_THRESHOLDS` / `SENSITIVITY_PRESETS` from `defaults.js` (single source of truth). |
| `shared/utils/cooldown.js` | Cooldown class. |

### Assets

| Path | Purpose |
|------|---------|
| `assets/mediapipe/*` | Face Mesh WASM/JS/tflite — local only, paths via `getURL`. |
| `assets/icons/*` | Extension icons. |

### Docs and misc

| File | Purpose |
|------|---------|
| `README.md` | Install, dev, build, privacy and license links. |
| `PRIVACY.md` | Privacy policy. |
| `LICENSE` | MIT. |
| `SUBMISSION.md` | Store submission notes (if present). |
| `devtools/browse-console-debug.js` | Browse grid debugging in page console (not in bundle). |
| `.cursorrules` | Cursor project rules (if present in archive). |

## Build and zip

- `npm install` — dependencies.
- `npm run build` — output in `dist/` (load unpacked from `dist/`).
- `npm run prod` — clean build + `nodex.zip` from **contents of `dist/`** (ready-to-ship extension package).
- `npm run zip:source` — **sources** in `nodex-extension-source.zip` without `node_modules`, `dist`, `.git` (handy for AI or repo handoff).

## Constraints (short)

- Do not use `localStorage`, CDN for MediaPipe, or `document.querySelector` for YouTube play/pause UI.
- Resolve `HTMLVideoElement` per `.cursorrules` / code (`readyState`, `duration`, not in ad overlay).
- Gestures: hysteresis, separate blink vs long eye-close logic, cooldowns.

When architecture changes, update this file and `README.md` if needed.
