import { GESTURES } from './gestures.js'
import { COMMANDS } from './commands.js'

export const DEFAULT_GESTURE_MAP = {
  [GESTURES.HEAD_LEFT]:   COMMANDS.REWIND,
  [GESTURES.HEAD_RIGHT]:  COMMANDS.SKIP,
  [GESTURES.HEAD_UP]:     COMMANDS.VOL_UP,
  [GESTURES.HEAD_DOWN]:   COMMANDS.VOL_DOWN,
  [GESTURES.TILT_LEFT]:   COMMANDS.PREV,
  [GESTURES.TILT_RIGHT]:  COMMANDS.NEXT,
  [GESTURES.EYES_CLOSED]: COMMANDS.PAUSE,
  [GESTURES.MOUTH_OPEN]:  COMMANDS.MUTE,
}

export const DEFAULT_COOLDOWNS = {
  [GESTURES.HEAD_UP]:     300,
  [GESTURES.HEAD_DOWN]:   300,
  [GESTURES.HEAD_LEFT]:   600,
  [GESTURES.HEAD_RIGHT]:  600,
  [GESTURES.TILT_LEFT]:   800,
  [GESTURES.TILT_RIGHT]:  800,
  [GESTURES.EYES_CLOSED]: 1200,
  [GESTURES.MOUTH_OPEN]:  600,
}

export const DEFAULT_THRESHOLDS = {
  yaw: 18,
  pitch: 12,
  roll: 15,
  earClose: 0.18,
  mouthOpen: 0.55,
  hysteresis: 4,
}

export const EYE_CLOSE_MIN_MS = 350

export const SENSITIVITY_PRESETS = {
  low: {
    yaw: 22,
    pitch: 15,
    roll: 18,
    earClose: 0.16,
    mouthOpen: 0.62,
    hysteresis: 5,
  },
  medium: DEFAULT_THRESHOLDS,
  high: {
    yaw: 14,
    pitch: 9,
    roll: 12,
    earClose: 0.20,
    mouthOpen: 0.48,
    hysteresis: 3,
  },
}
