# Gesture System

## Gesture Names

Defined in `shared/constants/gestures.js`:

```
HEAD_LEFT    HEAD_RIGHT    HEAD_UP    HEAD_DOWN
TILT_LEFT    TILT_RIGHT
EYES_CLOSED  EYES_HOLD
MOUTH_OPEN
NONE
```

## Detection Pipeline

```
Raw landmarks (30fps)
  → EMA smoothing (per axis)
    → computeYaw / computePitch / computeRoll / computeEAR / computeMouthRatio
      → threshold + hysteresis state machine
        → dwell counter (must hold N frames)
          → gesture event emitted
            → cooldown timer (per gesture)
              → action dispatched to YouTube
```

## Threshold → Hysteresis

Each gesture uses two thresholds:

- **ON threshold:** gesture activates when angle exceeds this
- **OFF threshold = ON − hysteresis gap:** gesture deactivates when angle drops below this

Without hysteresis, a head position exactly at the boundary would toggle on/off every frame.

```
Default values:
  yaw ON: 22°,    OFF: 22 - 7 = 15°
  pitch ON: 9°,   OFF: 9 - 7 = 2°
  roll ON: 15°,   OFF: 15 - 4 = 11°
```

## Dwell (activation delay)

User must hold the angle above threshold for N consecutive frames before the gesture fires:

| Gesture axis | Dwell |
|---|---|
| Yaw (left/right) | 4 frames |
| Pitch up | 3 frames |
| Pitch down | 2 frames |

Pitch down has shorter dwell intentionally (quicker volume response).

## Cooldowns (per-gesture lockout after firing)

Prevent the same gesture from repeating too fast:

| Gesture | Cooldown |
|---|---|
| HEAD_UP | 200ms |
| HEAD_DOWN | 200ms |
| HEAD_LEFT | 350ms |
| HEAD_RIGHT | 350ms |
| TILT_LEFT | 800ms |
| TILT_RIGHT | 800ms |
| EYES_CLOSED | 900ms |
| EYES_HOLD | 1500ms |
| MOUTH_OPEN | 600ms |

Browse mode additionally enforces `BROWSE_COMMAND_COOLDOWN_MS: 700` between any gesture commands.

## Gesture Maps (action routing)

Two separate maps: one for Player mode, one for Browse mode.

**Default Player map:**
```
HEAD_LEFT   → REWIND
HEAD_RIGHT  → SKIP
HEAD_UP     → VOL_UP
HEAD_DOWN   → VOL_DOWN
TILT_LEFT   → PREV
TILT_RIGHT  → NEXT
EYES_CLOSED → PLAY_PAUSE
EYES_HOLD   → NONE
MOUTH_OPEN  → MUTE
```

**Default Browse map:**
```
HEAD_LEFT   → (left navigation)
HEAD_RIGHT  → (right navigation)
HEAD_UP     → (up navigation)
HEAD_DOWN   → (down navigation)
EYES_CLOSED → (select card)
TILT_LEFT   → BACK
TILT_RIGHT  → NONE
EYES_HOLD   → NONE
MOUTH_OPEN  → NONE
```

Both maps are user-editable in the side panel and stored in `chrome.storage.local`.

## Tutorial Mode

During onboarding tutorial step, `NodexPersistent._tutorialMode = true`. When this is set:

- Gesture events route to `_overlayCommandListener` (OnboardingOverlay) instead of YouTube controllers
- Only HEAD_LEFT, HEAD_RIGHT, HEAD_UP, EYES_CLOSED are demonstrated
- EYES_HOLD, TILT_LEFT, TILT_RIGHT, MOUTH_OPEN are not shown
- Tutorial mode expires after 5 minutes (`_tutorialModeDeadline`)

## Blocked Mode

`GestureEngine.updateSettings({ blocked: true })` suppresses all gesture emission. Used by OnboardingOverlay during steps 0–3 to prevent accidental YouTube control during setup.

## Adding a New Gesture

1. Add name to `shared/constants/gestures.js`
2. Add detection logic in `GestureEngine.js` (new state variable + threshold check)
3. Add default cooldown in `shared/constants/defaults.js`
4. Add to both default gesture maps in `defaults.js`
5. Update side panel gesture picker UI in `sidepanel/App.jsx`
