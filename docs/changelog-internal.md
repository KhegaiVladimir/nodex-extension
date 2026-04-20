# Internal Changelog

Developer-facing changes. Not the public store changelog.

---

## v1.1.0 — April 2026

### Added
- `OnboardingOverlay` — full Shadow DOM overlay replacing the side panel onboarding flow
  - 5-step flow: Welcome → Camera → Neutral Pose → Blink Calibration → Tutorial
  - Stability-based neutral pose detection (rolling 24-frame window, spread < 3.5°)
  - Live SVG eye animation driven by EAR values during blink calibration
  - Spring easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`) for step transitions
  - `prefers-reduced-motion` support
  - Back navigation per step with proper state cleanup
  - Gesture blocking via `updateSettings({ blocked: true })` during steps 0–3

### Changed
- `sidepanel/App.jsx` — removed `OnboardingFlow`, `OnboardStep1-4` components (~300 lines), removed `onboarded` state and related useEffect
- `content/index.js` — added `_overlayMetricsListener` hook on `NodexPersistent`, added gesture routing to `_overlayCommandListener` in tutorial mode, added onboarding check on init

### Fixed
- Neutral pose only detecting when user faces camera dead-on (replaced absolute angle check with stability window)
- Gestures firing on YouTube during all onboarding steps (block engine in `mount()`, not just during blink calibration)
- Empty card on back navigation (removed stale `_buildDots()` call from `_goStep()`)
- `loadCalibration` accidentally removed from App.jsx imports

---

## v1.0.1 — 2025

### Fixed
- Debugging RYR contacts and video frames
- Eye tracking reliability improvements

---

## v1.0.0 — 2025

Initial release.

- MediaPipe Face Mesh integration (MAIN world)
- GestureEngine with hysteresis state machine
- Player mode (keyboard shortcut dispatch)
- Browse mode (geometric grid navigation)
- HUD overlay (toast + metrics)
- Side panel settings UI (React 18)
- Two-phase blink calibration wizard
- Dynamic EAR auto-calibration
- SPA navigation awareness (`yt-navigate-finish`)
- Ad safety (VOL/MUTE only during ads)
