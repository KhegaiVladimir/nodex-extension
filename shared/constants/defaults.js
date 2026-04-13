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
  [GESTURES.HEAD_UP]:     200,   // volume repeat — fast
  [GESTURES.HEAD_DOWN]:   200,   // volume repeat — fast
  [GESTURES.HEAD_LEFT]:   350,   // seek — slightly faster (was 400)
  [GESTURES.HEAD_RIGHT]:  350,   // seek — slightly faster (was 400)
  [GESTURES.TILT_LEFT]:   800,
  [GESTURES.TILT_RIGHT]:  800,
  [GESTURES.EYES_CLOSED]: 1200,
  [GESTURES.MOUTH_OPEN]:  600,
}

export const DEFAULT_THRESHOLDS = {
  /** Degrees past calibrated neutral to trigger head-left/right (seek). */
  yaw: 22,
  /** Degrees past neutral for head-up/down (volume). Kept at 13° — comfortable for webcam
   *  + glasses where pitch rarely exceeds 15°. */
  pitch: 13,
  /** Degrees of head tilt (roll) for prev/next. */
  roll: 15,
  earClose: 0.22,
  mouthOpen: 0.55,
  /** Hysteresis margin for roll and mouth (deg / unitless). */
  hysteresis: 4,
  /** Release HEAD_LEFT/RIGHT when |yaw| drops below threshold minus this. */
  hysteresisYaw: 7,
  /** Release HEAD_UP/DOWN when |pitch| drops below threshold minus this. */
  hysteresisPitch: 7,
}

/**
 * While head pose exceeds these bands (deg, relative to calibrated neutral),
 * eye-close detection is suppressed — turning the head skews EAR falsely.
 * Expressed as a fraction of the corresponding gesture threshold so these
 * scale automatically when sensitivity presets change.
 */
export const EYE_HEAD_CONFLICT_FRAC = {
  yaw:   0.48,
  pitch: 0.85,
  roll:  0.72,
}

// Eye close timing (informational — actual frame counts used in GestureEngine).
export const EYE_CLOSE_MIN_MS  = 150
export const EYE_CLOSE_MAX_MS  = 720
export const LONG_BLINK_MAX_MS = 2000

// Inline calibration via long blink removed — use side panel wizard instead.
// Kept as sentinels so any stale imports don't break.
export const CALIBRATION_BLINK_MIN_MS = Number.POSITIVE_INFINITY
export const CALIBRATION_BLINK_MAX_MS = Number.POSITIVE_INFINITY

export const SENSITIVITY_PRESETS = {
  low: {
    yaw:             26,
    pitch:           17,
    roll:            18,
    earClose:        0.16,
    mouthOpen:       0.62,
    hysteresis:      5,
    hysteresisYaw:   8,
    hysteresisPitch: 8,
  },
  medium: DEFAULT_THRESHOLDS,
  high: {
    yaw:             18,
    pitch:           11,
    roll:            12,
    earClose:        0.24,
    mouthOpen:       0.48,
    hysteresis:      3,
    hysteresisYaw:   5,
    hysteresisPitch: 5,
  },
}
