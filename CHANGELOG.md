# Changelog

All notable changes to Nodex are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — 2026-04-14

### Added

- **Live Metrics panel** (`sidepanel/MetricBar.jsx`) — animated progress bars for Yaw, Pitch, Roll (centered, bidirectional), EAR, and Mouth Ratio (fill). Each bar shows a threshold tick mark that updates in real time after re-calibration. EMA display smoothing (α = 0.14) keeps bars fluid without introducing perceptible lag at 30 FPS.
- **Cold-start indicator** — the Start button and status dot now show an amber "Loading model…" state during WASM warm-up. The status transitions to green only after the first frame of face data arrives (or after a 5-second fallback timer if the user is not in frame).
- **Browse Mode first-use hint** — a 5-second onboarding toast ("Browse Mode · Nod left/right to navigate · Tilt to go back") is shown exactly once when Browse Mode activates for the first time. The flag is persisted in `chrome.storage.local` (`nodex_browse_hint_shown`).
- **Two-variant blink calibration alert** — the Home screen now distinguishes between users who have never calibrated (`blinkCalibNeeded` + no EAR data in storage → prominent card with full-width CTA) and users whose calibration has merely expired (subtle re-calibrate banner). The alert auto-dismisses when calibration data is saved.
- **`SECURITY.md`** — responsible-disclosure policy covering architecture trust boundaries, in-scope attack surface, reporting address, response timeline, and severity guidance.
- **`ROADMAP.md`** — prioritised path-to-CWS checklist with blocker, high, medium, and low items.

### Changed

- **HEAD_DOWN gesture reliability** — dwell counter pre-warms when pitch enters a `pTh − 2°` zone, so a genuine nod already has streak credit when it crosses the fire threshold. Streak decay on off-frames reduced from −2 to −1 to tolerate single noisy frames.
- **Dynamic EAR warm-up** — `DYNAMIC_EAR_WARMUP_FRAMES` reduced from 30 to 12. The EMA is now seeded from the very first detected EAR sample (no blend-from-zero), so blink detection is reliable within ~0.4 s of camera start — significantly reducing cold-start false negatives for uncalibrated users.
- **Browse Mode periodic scan** — `PERIODIC_SCAN_MS` increased from 5 000 ms to 15 000 ms. The `MutationObserver` with debounce already handles real-time DOM changes; the periodic scan is a fallback only.
- **EAR threshold tick** — the MetricBar EAR tick now uses the user's personal `earCalibration.threshold` from storage when available, falling back to `DEFAULT_THRESHOLDS.earClose`.
- **Manifest version** bumped to `1.1.0`.

### Fixed

- MetricBar EAR false-positive "triggered" state on the first frame: the EMA is now seeded directly from the first non-null value instead of blending up from 0, preventing the bar from briefly showing a closed-eye state when tracking begins.
- `blinkCalibNeeded` stale state: the alert banner now clears immediately when `earCalibration` is written to storage, even if the user navigated to Calibrate without clicking the alert button.

---

## [1.0.0] — 2026-03-28

### Added

- Initial release.
- **MediaPipe Face Mesh** — 468-landmark on-device face tracking at ~30 FPS via local WASM bundle. Zero network egress; all assets ship with the extension.
- **Player Mode** — head gestures control YouTube playback: Yaw left/right (rewind/skip), Pitch up/down (volume up/volume down), Roll tilt (mute), Eyes closed (play/pause), Mouth open (next video). All gestures configurable.
- **Browse Mode** — automatic activation on the YouTube home/search/feed pages. Nod left/right to move between videos, tilt to navigate rows, look up/down to scroll, select with eyes-closed blink.
- **Gesture Engine** — hysteresis (on at threshold T, off at T − gap) prevents chatter. Dwell frames require the gesture to hold for N frames before firing. Configurable per gesture.
- **Calibration Wizard** — guided 3-step calibration: neutral-pose baseline for yaw/pitch/roll + blink EAR calibration with personal threshold computation. TTL: 7 days.
- **Live HUD overlay** — Shadow DOM toast notifications + real-time YAW / PITCH / ROLL / EAR metrics panel + Browse/Player mode badge.
- **Side Panel UI** — React 18 settings panel with gesture mapping table, sensitivity presets, MetricBar live view, and calibration wizard.
- **SPA navigation** — `yt-navigate-finish` + Navigation API + fallback polling keep the extension alive across YouTube's single-page-app route changes without restarting the camera.
- **Service Worker** — message relay between content scripts and Side Panel. Auto-opens Side Panel on extension icon click.
