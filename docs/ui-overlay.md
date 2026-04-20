# UI Overlays

All Nodex UI injected into YouTube pages uses Shadow DOM isolation to prevent YouTube's global styles from leaking in.

## HUD (`content/HUD.js`)

Minimal always-on heads-up display for the active user.

### Toast Notifications

- Position: `fixed`, centered, `top: 68px`
- Timing: visible `1400ms`, fade out `200ms`
- Background: `rgba(8, 8, 12, 0.72)` + `backdrop-filter: blur(20px) saturate(160%)`
- Border: `1px solid rgba(255, 255, 255, 0.10)`
- Border radius: `20px`

**Warning toast:** `rgba(30, 8, 8, 0.82)` background, red border/shadow.
**Browse hint toast:** `rgba(6, 18, 14, 0.82)` background, teal border/shadow.

### Metrics Panel

Developer/power-user overlay showing live tracking data.

- Position: `fixed`, `bottom: 16px`, `right: 16px`
- `z-index: 2147483647`
- Displays: YAW (1 decimal), PITCH (1 decimal), ROLL (1 decimal), EAR (2 decimals)
- EAR dot: teal (`#64FFDA`) when open, red (`#ff6b6b`) when `ear < 0.15`
- Mode badge: Player = dark bg, Browse = `rgba(100, 255, 218, 0.12)` bg

## Focus Ring (`content/BrowseController.js`)

Visual indicator for the currently selected card in Browse mode.

```css
position: fixed;
z-index: 2147483647;
border: 3px solid #64FFDA;
border-radius: 12px;
box-shadow: 0 0 0 4px rgba(100, 255, 218, 0.2);
transition: top 0.15s ease-out, left 0.15s ease-out,
            width 0.15s ease-out, height 0.15s ease-out;
```

**Edge pulse** (when navigation hits a boundary):
- Border color: `#ff4444`
- Shadow: `rgba(255, 68, 68, 0.35)`
- Resets to teal after `120ms`

**Card scale on focus:**
- `transform: scale(1.05)` on the focused card container
- `transition: transform 0.2s ease-out`

## Onboarding Overlay (`content/OnboardingOverlay.js`)

Full-viewport guided setup flow shown once on first use.

- Shadow DOM attached to `document.documentElement`
- `position: fixed; inset: 0; z-index: 2147483647`
- Survives SPA navigation (not tied to `NodexPageScoped`)
- Accent color: `#5bffd8`
- Card max-width: `480px`
- Spring easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` for step transitions
- Respects `prefers-reduced-motion` (animation durations drop to 120ms)

### Steps

| Step | Content |
|---|---|
| 0 | Welcome screen |
| 1 | Camera permission request |
| 2 | Neutral pose calibration (stability detection) |
| 3 | Blink calibration (open + closed eye phases) |
| 4 | Gesture tutorial (interactive) |

### Gesture Blocking

The overlay blocks YouTube gestures during steps 0–3 by calling:
```js
this._p._gestureEngine?.updateSettings({ blocked: true })
```

The tutorial step (4) unblocks and enables `_tutorialMode` instead, so gestures route to the overlay's command listener rather than YouTube controllers.

### Neutral Pose Detection

Uses rolling-window stability (not absolute angle):
- Window: last 24 frames (~0.8s at 30fps)
- Stable = spread (max−min) < 3.5° for both yaw and pitch, with ≥12 frames in window
- Countdown starts after 2000ms of stability
- Baseline captured as median of window

### Blink Calibration

- Phase 1 (open): 3100ms sampling
- Phase 2 (closed): 3200ms sampling + countdown speech at 700ms intervals
- Calls `computeBlinkThreshold()` from `shared/utils/blinkCalibration.js`
- Saves result via `saveCalibration()`

## Shadow DOM Rules

1. All injected UI must use `attachShadow({ mode: 'open' })`
2. All styles go inside the shadow root — no global CSS
3. `pointer-events: none` on the host element for overlays that don't intercept input
4. `pointer-events: auto` on interactive child elements (buttons, etc.)
5. `event.stopPropagation()` on all clicks inside injected UI
