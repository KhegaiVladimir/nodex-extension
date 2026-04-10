import { GESTURES } from './gestures.js'
import { COMMANDS } from './commands.js'

export const PLAYER_GESTURE_MAP = {
  [GESTURES.HEAD_LEFT]:   COMMANDS.REWIND,
  [GESTURES.HEAD_RIGHT]:  COMMANDS.SKIP,
  [GESTURES.HEAD_UP]:     COMMANDS.VOL_UP,
  [GESTURES.HEAD_DOWN]:   COMMANDS.VOL_DOWN,
  [GESTURES.TILT_LEFT]:   COMMANDS.PREV,
  [GESTURES.TILT_RIGHT]:  COMMANDS.NEXT,
  [GESTURES.EYES_CLOSED]: COMMANDS.PLAY_PAUSE,
  [GESTURES.MOUTH_OPEN]:  COMMANDS.MUTE,
}

export const BROWSE_GESTURE_MAP = {
  [GESTURES.HEAD_LEFT]:   COMMANDS.REWIND,
  [GESTURES.HEAD_RIGHT]:  COMMANDS.SKIP,
  [GESTURES.HEAD_UP]:     COMMANDS.VOL_UP,
  [GESTURES.HEAD_DOWN]:   COMMANDS.VOL_DOWN,
  [GESTURES.EYES_CLOSED]: COMMANDS.PLAY_PAUSE,
  [GESTURES.TILT_LEFT]:   COMMANDS.BACK,
  [GESTURES.TILT_RIGHT]:  COMMANDS.NONE,
  [GESTURES.MOUTH_OPEN]:  COMMANDS.NONE,
}

export const DEFAULT_GESTURE_MAP = PLAYER_GESTURE_MAP

export const DEFAULT_COOLDOWNS = {
  [GESTURES.HEAD_UP]:     200,
  [GESTURES.HEAD_DOWN]:   200,
  [GESTURES.HEAD_LEFT]:   400,
  [GESTURES.HEAD_RIGHT]:  400,
  [GESTURES.TILT_LEFT]:   800,
  [GESTURES.TILT_RIGHT]:  800,
  [GESTURES.EYES_CLOSED]: 1000,
  [GESTURES.MOUTH_OPEN]:  600,
}

export const DEFAULT_THRESHOLDS = {
  yaw: 15,
  pitch: 10,
  roll: 15,
  earClose: 0.22,
  mouthOpen: 0.55,
  hysteresis: 3,
}

// Eye close timing: fire on eyes-open, based on how long they were shut.
// [MIN, MAX): short blink → main command (PLAY_PAUSE by default).
// [MAX, LONG_MAX]: long blink → BACK.
// Anything longer: ignored (user just closed their eyes, not a gesture).
export const EYE_CLOSE_MIN_MS   = 150
export const EYE_CLOSE_MAX_MS   = 600
export const LONG_BLINK_MAX_MS  = 2000

// Inline calibration via long blink was removed — it conflicted with BACK
// and calibration is available from the side panel anyway. Keep the exports
// as sentinels so imports in GestureEngine don't break; the code path is gone.
export const CALIBRATION_BLINK_MIN_MS = Number.POSITIVE_INFINITY
export const CALIBRATION_BLINK_MAX_MS = Number.POSITIVE_INFINITY

export const SENSITIVITY_PRESETS = {
  low: {
    yaw: 19,
    pitch: 13,
    roll: 18,
    earClose: 0.16,
    mouthOpen: 0.62,
    hysteresis: 4,
  },
  medium: DEFAULT_THRESHOLDS,
  high: {
    yaw: 12,
    pitch: 7,
    roll: 12,
    earClose: 0.24,
    mouthOpen: 0.48,
    hysteresis: 2,
  },
}
