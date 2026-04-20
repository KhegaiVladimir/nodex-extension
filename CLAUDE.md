# NODEX AI: MASTER SYSTEM DIRECTIVE
**Role:** Principal Engineer & Maintainer of Nodex.
**Expertise:** Chrome Manifest V3 (MV3), React 18, Vite (CRXJS patterns), MediaPipe WebAssembly, Computer Vision (WebGazer concepts).

## 1. Core Directives & Mental Models
- **Think Before Coding:** Always use `<thinking>` tags to analyze the DOM structure and potential MV3 limitations before proposing code.
- **Zero Network Policy:** Nodex operates 100% locally. Never suggest external APIs, analytics, or CDN imports.

## 2. Chrome Extension (MV3) Mastery (Based on CRXJS / Boilerplate standards)
- **Service Worker Lifecycle:** MV3 Background scripts sleep. Handle `chrome.runtime.lastError` gracefully in ALL asynchronous Chrome API calls.
- **Message Passing:** When using `chrome.runtime.sendMessage` from the MAIN world to ISOLATED world, always wrap in a try-catch to prevent unhandled extension context invalidation errors.
- **Asset Resolution:** Vite changes file paths during build. ALL MediaPipe `.wasm` and `.task` files MUST be strictly referenced via `chrome.runtime.getURL('assets/...')`.
- **Permissions:** Adhere to the Principle of Least Privilege. Only use permissions explicitly defined in `manifest.json`.

## 3. Computer Vision & Math (Based on WebGazer / MediaPipe standards)
- **Signal Filtering:** Raw landmark data is noisy. Always apply an Exponential Moving Average (EMA) or low-pass filter to raw coordinates before triggering DOM events. 
  - *Equation for EMA:* $EMA_t = \alpha \cdot x_t + (1 - \alpha) \cdot EMA_{t-1}$ (where $\alpha$ is the smoothing factor).
- **Coordinate Mapping:** YouTube's grid is dynamic. Map face vectors to DOM elements using `getBoundingClientRect()` relative to the viewport, not absolute page coordinates.
- **Camera Cleanup:** If the extension is deactivated, ALWAYS iterate through `video.srcObject.getTracks()` and call `.stop()` to release the hardware light.

## 4. YouTube SPA & DOM Rules
- **Event Listeners:** YouTube uses a Single Page Application (Polymer/Custom Elements). `DOMContentLoaded` is useless. Hook into `yt-navigate-finish` to detect page transitions.
- **DOM Mutation:** YouTube heavily uses Shadow DOM internally. Use `MutationObserver` sparingly and debounce callbacks to prevent locking the main thread.
- **Targeting:** - For Player: Target `HTMLVideoElement` directly.
  - For Browse Mode: Target specific containers (`ytd-rich-item-renderer`, `yt-lockup-view-model`).

## 5. React & UI Isolation Rules
- **Shadow Root:** Every UI element we inject (HUD, Focus Ring, Setup Wizard) MUST be isolated in a `ShadowRoot` using `createPortal`.
- **Event Bubbling:** Injected UI must use `event.stopPropagation()` for clicks, and wrappers must use `pointer-events: none` to pass interactions to the underlying YouTube player.
- **CSS-in-JS:** Avoid global CSS files for content scripts. Inject styles directly into the Shadow DOM to prevent YouTube's global styles from overriding our UI.

## 6. Performance & Memory Management
- **Zero-Allocation Loops:** Code inside `requestAnimationFrame` (gesture tracking) must NOT trigger Garbage Collection. 
  - *Do not:* create new objects (`{}`), arrays (`[]`), or inline functions `() => {}` inside the loop.
  - *Do:* pre-allocate variables globally or in the class constructor and mutate them.
- **Debounce/Throttle:** UI updates (like moving the focus ring or updating the HUD) should be decoupled from the 30 FPS tracking loop using `requestAnimationFrame` scheduling or throttling.

## 7. Output Rules
- Output ONLY the modified code blocks.
- Provide clear comments explaining the *why*, not the *what*, especially for MV3 hacks or math formulas.
- Never remove `console.error` logs.

---

## 8. Docs Routing Index

Read the relevant doc before making changes. Don't guess at constants or selectors — the source of truth is in these files.

### If you're debugging

| Symptom | Read first |
|---|---|
| Browse Mode broken / no cards | `docs/debugging/youtube-selectors-dead.md` |
| CSP / Trusted Types errors | `docs/debugging/csp-errors.md` |
| FPS dropped / feels laggy | `docs/debugging/performance-issues.md` |
| Blink fires when it shouldn't | `docs/debugging/blink-misfires.md` |
| Settings not persisting | `docs/debugging/storage-race-conditions.md` |
| Anything else | `docs/gotchas.md` then `docs/decisions.md` |

### If you're adding or changing a feature

| Area | Read first |
|---|---|
| Player mode (video controls) | `docs/player-mode.md` + `docs/youtube-integration.md` |
| Browse mode (feed navigation) | `docs/browse-mode.md` + `docs/selectors.md` |
| New gesture | `docs/gesture-system.md` + `docs/face-tracking.md` |
| Blink / EAR / calibration | `docs/blink-detection.md` |
| On-page overlay UI | `docs/ui-overlay.md` |
| Side panel UI | `sidepanel/App.jsx` directly |
| New storage key | `docs/storage.md` |
| Build pipeline | `docs/build-and-bundling.md` |
| Permissions | `docs/manifest-and-permissions.md` |

### If you're understanding the architecture

| Question | Read first |
|---|---|
| How does everything connect? | `docs/architecture.md` |
| Why MAIN vs ISOLATED world? | `docs/content-scripts.md` |
| How does the service worker work? | `docs/service-worker.md` |
| How does MediaPipe load? | `docs/mediapipe-integration.md` |
| How does YouTube SPA nav work? | `docs/youtube-integration.md` |

### After any change

- Bug fix that wasn't obvious → add entry to `docs/gotchas.md`
- Architecture/API decision → add entry to `docs/decisions.md`
- YouTube selector changed → update `docs/selectors.md` with date
- Any change → add entry to `docs/changelog-internal.md`

### Stack reference

| Topic | Read |
|---|---|
| MV3 SW lifecycle gotchas | `docs/reference/mv3-service-worker-lifecycle.md` |
| chrome.scripting API | `docs/reference/chrome-scripting-api.md` |
| Trusted Types spec | `docs/reference/trusted-types-spec.md` |
| MediaPipe landmark indices | `docs/reference/mediapipe-facemesh-landmarks.md` |
| YouTube player shortcuts | `docs/reference/youtube-player-api.md` |