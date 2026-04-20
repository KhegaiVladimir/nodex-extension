# Storage

All persistence uses `chrome.storage.local`. Zero network calls. All wrappers live in `shared/storage.js`.

## Keys

| Key | Type | Description |
|---|---|---|
| `nodex_settings` | Object | User settings (thresholds, sensitivity, flags) |
| `nodex_calibration` | Object | Neutral pose calibration (yaw/pitch/roll offsets) |
| `nodex_player_gesture_map` | Object | Player mode gesture → action mapping |
| `nodex_browse_gesture_map` | Object | Browse mode gesture → action mapping |
| `nodex_gesture_map` | Object | Legacy key (migrated to player map on first load) |
| `earCalibration` | Object | EAR blink calibration from wizard |
| `onboarding_complete` | Boolean | Whether user finished onboarding |
| `nodex_browse_hint_shown` | Boolean | Whether browse mode hint toast was shown |
| `calibrationCompleted` | Boolean | Whether CalibrationWizard was completed |
| `calibrationCompletedAt` | Number | Timestamp of last calibration |

## Settings Object Schema

Loaded via `loadSettings(defaults)` — merges with defaults, so missing keys get defaults automatically.

```js
{
  // Head pose thresholds (degrees)
  yaw: 22,
  pitch: 9,
  roll: 15,

  // Blink
  earClose: 0.22,

  // Mouth
  mouthOpen: 0.55,

  // Hysteresis gaps (degrees)
  hysteresis: 4,
  hysteresisYaw: 7,
  hysteresisPitch: 7,

  // Misc flags
  onboarding_complete: false,
}
```

## EAR Calibration Object

Stored under key `earCalibration`. Written by `saveCalibration()`.

```js
{
  ok: true,
  earOpen: number,
  earClosed: number,
  range: number,
  threshold: number,
  exitThreshold: number,
  noiseFloor: number,
  samplesOpen: number,
  samplesClosed: number,
  calibratedAt: number,         // Date.now() timestamp
  signalType: 'iris' | 'ear',
}
```

TTL: 7 days (`EAR_CALIB_TTL_MS` in GestureEngine). After expiry, dynamic auto-calibration takes over.

## Neutral Pose Calibration

Stored under key `nodex_calibration`:

```js
{
  yaw: number,    // baseline yaw offset (degrees)
  pitch: number,  // baseline pitch offset
  roll: number,   // baseline roll offset
}
```

The OnboardingOverlay captures the median yaw/pitch from a 24-frame stability window and stores it here. GestureEngine subtracts these offsets from raw angles before applying thresholds.

## Serialized Writes

`saveSettings(patch)` uses an internal write queue — concurrent saves are serialized, not dropped. This prevents race conditions when multiple parts of the UI write settings simultaneously.

## Gesture Map Schema

```js
{
  HEAD_LEFT:   'REWIND',     // action key from actions enum
  HEAD_RIGHT:  'SKIP',
  HEAD_UP:     'VOL_UP',
  HEAD_DOWN:   'VOL_DOWN',
  TILT_LEFT:   'PREV',       // player default
  TILT_RIGHT:  'NEXT',
  EYES_CLOSED: 'PLAY_PAUSE',
  EYES_HOLD:   'NONE',
  MOUTH_OPEN:  'MUTE',
}
```

Browse mode defaults differ — see `shared/constants/defaults.js`.

## Legacy Key Migration

On first `loadPlayerGestureMap()` call, if `nodex_player_gesture_map` is missing but `nodex_gesture_map` exists, the legacy key is migrated automatically.

## Adding a New Setting

1. Add default value to `DEFAULT_THRESHOLDS` in `shared/constants/defaults.js`
2. `loadSettings()` will include it automatically via object spread
3. Update side panel UI in `sidepanel/App.jsx`
4. Update this file with the new key

## Race Conditions

`saveSettings` is the only write that's serialized. Other keys (`earCalibration`, `onboarding_complete`) are written directly with `chrome.storage.local.set()`. If multiple contexts write the same key simultaneously, the last write wins. See `docs/debugging/storage-race-conditions.md` if this causes issues.
