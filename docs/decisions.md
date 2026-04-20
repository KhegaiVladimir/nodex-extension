# Architecture Decisions

Record of significant choices made during development — what was tried, what was rejected, and why.

---

## MAIN / ISOLATED world split for MediaPipe

**Decision:** Run MediaPipe in MAIN world, all other logic in ISOLATED world.

**Alternatives considered:**
- Single ISOLATED world script — rejected: YouTube Trusted Types CSP blocks WASM compilation in ISOLATED world.
- Single MAIN world script — rejected: MAIN world runs with page's JS context, no Chrome API isolation.

**Why this works:** Extension MAIN world uses its own CSP (`wasm-unsafe-eval`), bypassing YouTube's. ISOLATED world handles Chrome APIs and DOM manipulation safely.

---

## window.postMessage for MAIN ↔ ISOLATED communication

**Decision:** Use `window.postMessage` to pass landmarks from MAIN to ISOLATED world.

**Alternatives considered:**
- `chrome.runtime.sendMessage` — rejected: cannot be used for MAIN → ISOLATED direction within same tab without going through service worker round-trip.
- SharedArrayBuffer — rejected: requires COOP/COEP headers which YouTube doesn't set.

**Why this works:** Both worlds share the same `window` object. postMessage is the standard cross-world communication mechanism in Chrome extensions.

---

## No TypeScript

**Decision:** Vanilla JS throughout.

**Reasoning:** Faster iteration. JSDoc comments provide editor hints for the complex parts. MediaPipe types aren't packaged cleanly for TS anyway. Adding TS would require tsconfig maintenance and a more complex build pipeline for minimal benefit given the codebase size.

---

## Dynamic EAR auto-calibration + personal calibration

**Decision:** Run EMA-based auto-calibration at all times, but offer a personal calibration wizard.

**Alternatives considered:**
- Fixed thresholds only — rejected: too much variance between users (glasses, contacts, eye size, lighting).
- Calibration required before first use — rejected: bad onboarding UX.

**Why this works:** Dynamic calibration converges in ~12–25 frames using EMA. For 90% of users this is good enough. The wizard offers precision for edge cases or users with unusual EAR profiles.

---

## Stability-based neutral pose detection (not absolute angle)

**Decision:** Detect neutral pose by measuring head *stillness* over a rolling window, not by checking if the angle is near zero.

**Alternatives considered:**
- `Math.abs(yaw) < 5.5 && Math.abs(pitch) < 5.5` — rejected: forces user to face camera dead-on. Most users have a natural offset (tilted head, laptop below eye level).

**Why this works:** "Neutral pose" means the user's comfortable resting position — whatever angle that is. 24-frame window with spread < 3.5° detects stability at any angle. Baseline is captured as the median of the window.

---

## Onboarding as page overlay, not side panel flow

**Decision:** Show onboarding as a Shadow DOM overlay directly on the YouTube page.

**Alternatives considered:**
- Full onboarding in side panel — rejected: user must manually open side panel, awkward, disconnected from the actual YouTube context.
- New tab/popup — rejected: can't show live face tracking metrics, breaks the "everything on the page" mental model.

**Why this works:** Overlay lives on the YouTube page where the extension will be used. Camera and GestureEngine are already running, so we can show live EAR values, stability bars, and real blink detection without any extra plumbing. Shadow DOM isolation prevents YouTube styles from breaking the UI.

---

## Service worker as pure relay (no state)

**Decision:** Service worker holds no persistent state and only relays messages.

**Alternatives considered:**
- Service worker caching settings — rejected: MV3 service workers sleep unpredictably, module-level state resets on wake. Any state stored there would be unreliable.

**Why this works:** All state lives in `chrome.storage.local` (persistent) or content script memory (tab-scoped). Service worker just reads the tab ID from incoming messages and forwards to the right target.

---

## Hysteresis on all gesture thresholds

**Decision:** Every gesture has two thresholds — ON and OFF — separated by a hysteresis gap.

**Alternatives considered:**
- Single threshold with debounce — rejected: debounce adds latency and doesn't help with sustained boundary hovering.

**Why this works:** Prevents rapid toggling when the user's head angle hovers near the threshold. Gesture activates at the ON threshold and deactivates only when the angle drops to ON − gap. Classic control systems pattern.

---

## Gesture blocking during onboarding via `updateSettings({ blocked: true })`

**Decision:** Block gesture emission entirely during onboarding steps 0–3.

**Alternatives considered:**
- Filter gestures in `NodexPageScoped` — rejected: would require threading an "onboarding active" flag through multiple classes.
- Destroy `NodexPageScoped` during onboarding — rejected: can't recreate it mid-onboarding without losing the YouTube player state.

**Why this works:** `GestureEngine` already has an `updateSettings({ blocked })` path. Calling it from the overlay (same JS context, direct reference) is the simplest, most surgical approach.
