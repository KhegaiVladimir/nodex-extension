# Gotchas

Non-obvious problems encountered in development. Add new entries here whenever something took more than 30 minutes to diagnose.

---

## Trusted Types blocks MediaPipe in ISOLATED world

**Symptom:** MediaPipe WASM fails to compile; console shows Trusted Types violation.

**Why:** YouTube enforces Trusted Types CSP on the page. ISOLATED world content scripts inherit this policy. MediaPipe uses `eval`-equivalent patterns internally.

**Fix:** Run MediaPipe exclusively in MAIN world (`content/mediapipe-bridge.js`). The extension's own CSP (`wasm-unsafe-eval`) applies to MAIN world scripts, not the page's policy.

**Never move MediaPipe loading to ISOLATED world.**

---

## DOMContentLoaded fires only on first YouTube load

**Symptom:** Nodex works on initial load but stops working after navigating to another video.

**Why:** YouTube is a SPA. After the first load, subsequent navigation doesn't reload the page — `DOMContentLoaded` never fires again.

**Fix:** Listen for `yt-navigate-finish` instead. Recreate `NodexPageScoped` on each event.

---

## `chrome.runtime.sendMessage` throws if side panel is closed

**Symptom:** Uncaught error in content script when side panel isn't open.

**Why:** `sendMessage` throws if there's no registered listener on the other side.

**Fix:** Wrap every `sendMessage` call from content scripts in try-catch:

```js
try {
  chrome.runtime.sendMessage({ ... })
} catch (e) {
  // panel not open, ignore
}
```

---

## Neutral pose threshold rejects natural head angle

**Symptom:** Neutral pose step in onboarding only confirms when user faces camera dead-on. Any natural tilt fails.

**Why:** Original code used `Math.abs(yaw) < 5.5 && Math.abs(pitch) < 5.5` — absolute angle check from zero. Users naturally tilt their head or look slightly down at a laptop camera.

**Fix:** Use rolling-window spread detection instead. The user is "neutral" when their head is *still* for ~0.8s, regardless of what angle they're at. Window: 24 frames, spread < 3.5° both axes.

---

## Gestures fire on YouTube during onboarding

**Symptom:** While the onboarding overlay is showing, head movements still control YouTube video in the background.

**Why:** `GestureEngine` was only blocked during the blink calibration phase, not during earlier onboarding steps.

**Fix:** Call `updateSettings({ blocked: true })` in `OnboardingOverlay.mount()`. Unblock in `_buildTutorial()` (tutorial uses `_tutorialMode` to intercept gestures). `unmount()` also unblocks.

---

## Back button in overlay shows empty card

**Symptom:** Clicking back in onboarding shows a dark block with no content.

**Why:** `_goStep()` was calling `this._buildDots()` which had been renamed to `_buildHeader()`. The call threw `TypeError` before any content rendered.

**Fix:** Remove stale `_buildDots()` call from `_goStep()`.

---

## MutationObserver fires excessively on YouTube infinite scroll

**Symptom:** Browse mode card scan runs 50+ times per second when scrolling fast.

**Why:** YouTube's infinite scroll triggers many rapid DOM mutations.

**Fix:** Debounce the `MutationObserver` callback with `MUTATION_DEBOUNCE_MS: 800`. Combine with periodic scan fallback (`PERIODIC_SCAN_MS: 15000`) to catch mutations that occur during debounce window.

---

## Previous-video button not found

**Symptom:** PREV gesture does nothing on some video pages.

**Why:** The `.ytp-prev-button` element is inside a Shadow Root on some YouTube builds.

**Fix:** Use `querySelectorDeep()` which recursively traverses open Shadow Roots.

---

## EAR calibration goes stale over 7 days

**Symptom:** Blink detection becomes unreliable after a week.

**Why:** `EAR_CALIB_TTL_MS` is 7 days. After expiry, GestureEngine falls back to dynamic auto-calibration which may need a few seconds to converge.

**Fix:** This is expected behavior. If blink detection feels wrong right after loading, wait 15–30 seconds for auto-calibration to converge. Recalibrate from the side panel for immediate precision.

---

## `loadCalibration` removed accidentally from App.jsx imports

**Symptom:** `CalibrationScreen` throws `loadCalibration is not defined`.

**Why:** During App.jsx cleanup (removing old onboarding flow), the `loadCalibration` import was removed — but `CalibrationScreen` still uses it.

**Fix:** Keep `loadCalibration` in the import from `shared/storage.js` even if the top-level App code doesn't use it.

---

## MediaPipe asset paths change after Vite build

**Symptom:** MediaPipe fails to load in production build but works in dev.

**Why:** Vite may fingerprint/rename asset files during build.

**Fix:** MediaPipe assets are in `web_accessible_resources` and copied verbatim by `copyStaticFiles()` plugin. Always reference via `chrome.runtime.getURL('assets/mediapipe/filename')` — never hardcode paths.

---

## Wide-eyed staring inflates EAR calibration

**Symptom:** After calibration, blink threshold is too high — blinking doesn't register.

**Why:** If user stares wide-eyed during the "open eye" calibration phase, the top percentile of EAR samples is inflated.

**Fix:** `filterOpenSamples()` drops the top 35% of sorted EAR samples. This removes the staring frames and takes the 15th–65th percentile as the representative open-eye baseline.