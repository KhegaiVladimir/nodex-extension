import { GESTURES } from '../shared/constants/gestures.js'
import { COMMANDS } from '../shared/constants/commands.js'
import {
  DEFAULT_GESTURE_MAP,
  DEFAULT_COOLDOWNS,
  DEFAULT_THRESHOLDS,
  EYE_CLOSE_MIN_MS,
  EYE_CLOSE_MAX_MS,
  LONG_BLINK_MAX_MS,
  CALIBRATION_BLINK_MIN_MS,
  CALIBRATION_BLINK_MAX_MS,
} from '../shared/constants/defaults.js'
import { Cooldown } from '../shared/utils/cooldown.js'
import {
  computeYaw, computePitch, computeRoll, computeEAR, computeMouthRatio,
} from '../shared/utils/gestureLogic.js'

export class GestureEngine {
  constructor({
    thresholds = DEFAULT_THRESHOLDS,
    cooldowns  = DEFAULT_COOLDOWNS,
    gestureMap = DEFAULT_GESTURE_MAP,
    baseline   = null,
    onCommand  = null,
    onMetrics  = null,
    onCalibrationRequest = null,
  } = {}) {
    this._thresholds = { ...thresholds }
    this._gestureMap = { ...gestureMap }
    this._baseline   = baseline
    this._onCommand  = onCommand
    this._onMetrics  = onMetrics
    this._onCalibrationRequest = onCalibrationRequest

    this._active          = GESTURES.NONE
    this._eyeCloseStart   = null
    this._blocked         = false
    this._destroyed       = false

    this._cooldowns = {}
    for (const g of Object.values(GESTURES)) {
      if (g === GESTURES.NONE) continue
      this._cooldowns[g] = new Cooldown(cooldowns[g] ?? 600)
    }
  }

  processFrame(landmarks) {
    if (this._destroyed || !landmarks?.length) return

    const T   = this._thresholds
    const H   = T.hysteresis ?? 4
    const bl  = this._baseline

    let yaw   = computeYaw(landmarks)
    let pitch = computePitch(landmarks)
    let roll  = computeRoll(landmarks)
    const ear   = computeEAR(landmarks)
    const mouth = computeMouthRatio(landmarks)

    if (bl) {
      yaw   -= bl.yaw   ?? 0
      pitch -= bl.pitch ?? 0
      roll  -= bl.roll  ?? 0
    }

    const metrics = { yaw, pitch, roll, ear, mouth }
    this._onMetrics?.(metrics)

    if (this._blocked) return

    // --- Eye-close timing: fire on eyes OPEN based on closed duration ---
    const earThreshold = (bl?.ear > 0) ? bl.ear * 0.75 : T.earClose
    const eyesClosed = ear < earThreshold
    if (eyesClosed) {
      if (this._eyeCloseStart === null) this._eyeCloseStart = Date.now()
    } else if (this._eyeCloseStart !== null) {
      const duration = Date.now() - this._eyeCloseStart
      this._eyeCloseStart = null
      const cd = this._cooldowns[GESTURES.EYES_CLOSED]
      if (duration >= CALIBRATION_BLINK_MIN_MS && duration <= CALIBRATION_BLINK_MAX_MS) {
        this._onCalibrationRequest?.()
      } else if (cd && cd.fire()) {
        if (duration >= EYE_CLOSE_MAX_MS && duration <= LONG_BLINK_MAX_MS) {
          this._onCommand?.(COMMANDS.BACK, GESTURES.EYES_CLOSED, metrics)
        } else if (duration >= EYE_CLOSE_MIN_MS && duration < EYE_CLOSE_MAX_MS) {
          const cmd = this._gestureMap[GESTURES.EYES_CLOSED] ?? COMMANDS.NONE
          if (cmd !== COMMANDS.NONE) this._onCommand?.(cmd, GESTURES.EYES_CLOSED, metrics)
        }
      }
    }

    // --- Deactivation with hysteresis ---
    if (this._active !== GESTURES.NONE && this._active !== GESTURES.EYES_CLOSED) {
      const deactivate = this._shouldDeactivate(this._active, yaw, pitch, roll, mouth, T, H)
      if (deactivate) this._active = GESTURES.NONE
    }

    // --- Detection (only when idle) ---
    if (this._active === GESTURES.NONE) {
      const detected = this._detect(yaw, pitch, roll, mouth, T)
      if (detected !== GESTURES.NONE) {
        this._active = detected
        this._fire(detected, metrics)
      }
    }

    // --- Repeat while held ---
    if (
      this._active === GESTURES.HEAD_UP ||
      this._active === GESTURES.HEAD_DOWN ||
      this._active === GESTURES.HEAD_LEFT ||
      this._active === GESTURES.HEAD_RIGHT
    ) {
      this._fire(this._active, metrics)
    }
  }

  updateSettings({ thresholds, gestureMap, baseline, cooldowns, blocked } = {}) {
    if (thresholds) this._thresholds = { ...thresholds }
    if (gestureMap) this._gestureMap = { ...gestureMap }
    if (baseline !== undefined) this._baseline = baseline
    if (blocked !== undefined) this._blocked = blocked
    if (cooldowns) {
      for (const [g, ms] of Object.entries(cooldowns)) {
        if (this._cooldowns[g]) this._cooldowns[g].setInterval(ms)
      }
    }
  }

  destroy() {
    this._destroyed = true
    this._active = GESTURES.NONE
    this._eyeCloseStart = null
    this._onCommand = null
    this._onMetrics = null
    this._onCalibrationRequest = null
    for (const cd of Object.values(this._cooldowns)) cd.reset()
  }

  // --- internals ---

  _fire(gesture, metrics) {
    if (this._destroyed) return
    const cd = this._cooldowns[gesture]
    if (!cd || !cd.fire()) return
    const cmd = this._gestureMap[gesture] ?? COMMANDS.NONE
    if (cmd === COMMANDS.NONE) return
    this._onCommand?.(cmd, gesture, metrics)
  }

  _detect(yaw, pitch, roll, mouth, T) {
    if (yaw   < -T.yaw)       return GESTURES.HEAD_LEFT
    if (yaw   >  T.yaw)       return GESTURES.HEAD_RIGHT
    if (pitch >  T.pitch)     return GESTURES.HEAD_UP
    if (pitch < -T.pitch)     return GESTURES.HEAD_DOWN
    if (roll  < -T.roll)      return GESTURES.TILT_LEFT
    if (roll  >  T.roll)      return GESTURES.TILT_RIGHT
    if (mouth >  T.mouthOpen) return GESTURES.MOUTH_OPEN
    return GESTURES.NONE
  }

  _shouldDeactivate(active, yaw, pitch, roll, mouth, T, H) {
    switch (active) {
      case GESTURES.HEAD_LEFT:  return yaw   >= -(T.yaw   - H)
      case GESTURES.HEAD_RIGHT: return yaw   <=  (T.yaw   - H)
      case GESTURES.HEAD_UP:    return pitch <=  (T.pitch - H)
      case GESTURES.HEAD_DOWN:  return pitch >= -(T.pitch - H)
      case GESTURES.TILT_LEFT:  return roll  >= -(T.roll  - H)
      case GESTURES.TILT_RIGHT: return roll  <=  (T.roll  - H)
      case GESTURES.MOUTH_OPEN: return mouth <=  T.mouthOpen * 0.8
      default: return true
    }
  }
}
